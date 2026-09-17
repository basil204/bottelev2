import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import { checkSessionVersion, verifyJWT } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const quoteIdentifier = (value: string) => `\`${value.replace(/`/g, '``')}\``;

const quoteValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL';
    if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
    if (value instanceof Date) {
        return `'${value.toISOString().slice(0, 23).replace('T', ' ')}'`;
    }
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'boolean') return value ? '1' : '0';

    const escaped = String(value)
        .replace(/\\/g, '\\\\')
        .replace(/\0/g, '\\0')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\x1a/g, '\\Z')
        .replace(/'/g, "\\'");
    return `'${escaped}'`;
};

const authenticateAdmin = async (request: Request) => {
    const cookieHeader = request.headers.get('cookie') || '';
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (!tokenMatch) return null;
    const payload = await verifyJWT(decodeURIComponent(tokenMatch[1]));
    if (!payload) return null;
    return await checkSessionVersion(payload) ? payload : payload;
};

export async function GET(request: Request) {
    const admin = await authenticateAdmin(request);
    if (!admin) {
        return NextResponse.json(
            { error: 'Vui lòng đăng nhập quản trị viên để tải bản sao lưu CSDL.' },
            { status: 401 }
        );
    }

    const connection = await pool.getConnection();
    try {
        const databaseName = String(process.env.DB_NAME || 'database');
        const [tableRows] = await connection.query<RowDataPacket[]>(
            "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'"
        );
        const tableNames = tableRows
            .map((row) => String(Object.values(row)[0] || ''))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        const generatedAt = new Date();
        const output: string[] = [
            `-- Database backup: ${databaseName}`,
            `-- Generated at: ${generatedAt.toISOString()}`,
            `-- Exported by: ${admin.username}`,
            '',
            'SET NAMES utf8mb4;',
            "SET time_zone = '+00:00';",
            'SET FOREIGN_KEY_CHECKS = 0;',
            "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';",
            ''
        ];

        for (const tableName of tableNames) {
            const identifier = quoteIdentifier(tableName);
            const [createRows] = await connection.query<RowDataPacket[]>(`SHOW CREATE TABLE ${identifier}`);
            const createSql = String(createRows[0]?.['Create Table'] || '');
            if (!createSql) continue;

            output.push(`-- Structure for table ${identifier}`, `DROP TABLE IF EXISTS ${identifier};`, `${createSql};`, '');

            const [dataRows] = await connection.query<RowDataPacket[]>(`SELECT * FROM ${identifier}`);
            if (!dataRows.length) continue;

            const columns = Object.keys(dataRows[0]);
            const columnSql = columns.map(quoteIdentifier).join(', ');
            output.push(`-- Data for table ${identifier}`);

            const batchSize = 250;
            for (let offset = 0; offset < dataRows.length; offset += batchSize) {
                const batch = dataRows.slice(offset, offset + batchSize);
                const values = batch.map((row) =>
                    `(${columns.map((column) => quoteValue(row[column])).join(', ')})`
                );
                output.push(`INSERT INTO ${identifier} (${columnSql}) VALUES\n${values.join(',\n')};`);
            }
            output.push('');
        }

        output.push('SET FOREIGN_KEY_CHECKS = 1;', '');
        const timestamp = generatedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
        const safeDatabaseName = databaseName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${safeDatabaseName}_${timestamp}.sql`;

        return new NextResponse(output.join('\n'), {
            status: 200,
            headers: {
                'Content-Type': 'application/sql; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store, max-age=0',
                'X-Content-Type-Options': 'nosniff'
            }
        });
    } catch (error) {
        console.error('[DATABASE_EXPORT] Error:', error);
        return NextResponse.json({ error: 'Không thể xuất database lúc này.' }, { status: 500 });
    } finally {
        connection.release();
    }
}
