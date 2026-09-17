import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { logAdminAction, getAdminFromCookie, getRequestInfo } from '@/lib/adminLog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function splitSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inQuote: string | null = null;
    let isEscaped = false;
    let inLineComment = false;
    let inBlockComment = false;

    const len = sql.length;
    for (let i = 0; i < len; i++) {
        const char = sql[i];
        const nextChar = i + 1 < len ? sql[i + 1] : '';

        // Handle line comment (--, #)
        if (!inQuote && !inBlockComment) {
            if (char === '#' || (char === '-' && nextChar === '-')) {
                inLineComment = true;
            }
        }
        if (inLineComment) {
            if (char === '\n') {
                inLineComment = false;
            }
            continue;
        }

        // Handle block comment (/* ... */)
        if (!inQuote && !inLineComment) {
            if (char === '/' && nextChar === '*') {
                inBlockComment = true;
                i++; // skip *
                continue;
            }
        }
        if (inBlockComment) {
            if (char === '*' && nextChar === '/') {
                inBlockComment = false;
                i++; // skip /
            }
            continue;
        }

        // Handle quotes
        if (!isEscaped) {
            if (char === '\\') {
                isEscaped = true;
                current += char;
                continue;
            }
            if (char === "'" || char === '"' || char === '`') {
                if (inQuote === char) {
                    inQuote = null;
                } else if (!inQuote) {
                    inQuote = char;
                }
            }
        } else {
            isEscaped = false;
        }

        // End of statement
        if (char === ';' && !inQuote) {
            const trimmed = current.trim();
            if (trimmed.length > 0) {
                statements.push(trimmed);
            }
            current = '';
        } else {
            current += char;
        }
    }

    const lastTrimmed = current.trim();
    if (lastTrimmed.length > 0) {
        statements.push(lastTrimmed);
    }

    return statements;
}

export async function POST(request: Request) {
    const startTime = Date.now();
    try {
        await dbReady;

        let sqlContent = '';
        let wipeOldData = true;
        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            const file = formData.get('file') as File | null;
            if (!file) {
                return NextResponse.json({ error: 'Vui lòng chọn file .sql để tải lên!' }, { status: 400 });
            }
            sqlContent = await file.text();
            if (formData.has('wipeOldData')) {
                wipeOldData = formData.get('wipeOldData') === 'true' || formData.get('wipeOldData') === '1';
            }
        } else {
            const body = await request.json().catch(() => ({}));
            sqlContent = body.sqlContent || body.sql || '';
            if (typeof body.wipeOldData === 'boolean') {
                wipeOldData = body.wipeOldData;
            }
        }

        if (!sqlContent || !sqlContent.trim()) {
            return NextResponse.json({ error: 'Nội dung file SQL rỗng hoặc không hợp lệ!' }, { status: 400 });
        }

        const statements = splitSqlStatements(sqlContent);
        if (statements.length === 0) {
            return NextResponse.json({ error: 'Không tìm thấy câu lệnh SQL nào trong file!' }, { status: 400 });
        }

        const adminName = (await getAdminFromCookie(request)) || 'Admin';
        const connection = await pool.getConnection();

        let executedCount = 0;
        let droppedTablesCount = 0;
        let errors: string[] = [];

        try {
            await connection.query('SET NAMES utf8mb4');
            await connection.query('SET FOREIGN_KEY_CHECKS = 0');
            await connection.query("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO'");

            // 1. XÓA TOÀN BỘ DATA CŨ NẾU wipeOldData = true
            if (wipeOldData) {
                const [tableRows] = await connection.query<any[]>("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
                const tableNames = tableRows
                    .map((row) => String(Object.values(row)[0] || ''))
                    .filter(Boolean);

                for (const tbl of tableNames) {
                    try {
                        await connection.query(`DROP TABLE IF EXISTS \`${tbl.replace(/`/g, '``')}\``);
                        droppedTablesCount++;
                    } catch (dropErr: any) {
                        console.warn(`[SQL_IMPORT] Warning dropping table ${tbl}:`, dropErr.message);
                    }
                }
            }

            // 2. NẠP TOÀN BỘ CÂU LỆNH SQL MỚI
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                // Skip basic session directives already handled
                if (statement.match(/^(SET NAMES|SET FOREIGN_KEY_CHECKS|SET time_zone|SET SQL_MODE)/i)) {
                    continue;
                }
                try {
                    await connection.query(statement);
                    executedCount++;
                } catch (stmtErr: any) {
                    console.warn(`[SQL_IMPORT_WARNING] Statement ${i + 1} failed:`, stmtErr.message);
                    if (errors.length < 5) {
                        errors.push(`Lệnh #${i + 1}: ${stmtErr.message}`);
                    }
                }
            }

            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        } finally {
            connection.release();
        }

        // Run migrations check to ensure database health
        try {
            const { runPendingMigrations } = await import('@/lib/dbMigrations');
            await runPendingMigrations(pool);
        } catch (migErr) {
            console.warn('[SQL_IMPORT] Post-migration check warning:', migErr);
        }

        const elapsedMs = Date.now() - startTime;

        await logAdminAction({
            adminName,
            action: 'UPDATE',
            targetType: 'SYSTEM',
            details: {
                action: 'DATABASE_IMPORT_WIPE_AND_RELOAD',
                wipeOldData,
                droppedTablesCount,
                totalStatements: statements.length,
                executedCount,
                errorsCount: errors.length,
                elapsedMs
            },
            request
        });

        const successMessage = wipeOldData
            ? `Đã xóa sạch toàn bộ data cũ (${droppedTablesCount} bảng) và nạp mới hoàn toàn ${executedCount}/${statements.length} câu lệnh SQL thành công (${elapsedMs}ms)!`
            : `Đã nạp thành công ${executedCount}/${statements.length} câu lệnh SQL vào CSDL (${elapsedMs}ms)!`;

        return NextResponse.json({
            success: true,
            message: successMessage,
            droppedTablesCount,
            executedCount,
            totalStatements: statements.length,
            errors: errors.length > 0 ? errors : undefined,
            elapsedMs
        });

    } catch (error: any) {
        console.error('[DATABASE_IMPORT_ERROR]:', error);
        return NextResponse.json({
            error: error.message || 'Lỗi xử lý và cập nhật CSDL từ file SQL!'
        }, { status: 500 });
    }
}
