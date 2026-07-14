import { NextResponse } from 'next/server';
import os from 'os';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
    try {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const usagePercent = Math.round((usedMemory / totalMemory) * 100);

        // Convert to GB for display
        const totalGB = (totalMemory / (1024 * 1024 * 1024)).toFixed(2);
        const usedGB = (usedMemory / (1024 * 1024 * 1024)).toFixed(2);
        const freeGB = (freeMemory / (1024 * 1024 * 1024)).toFixed(2);

        // Get bot_username from DB
        let botUsername = 'autobasilbot';
        try {
            const [rows] = await pool.query<RowDataPacket[]>(
                "SELECT `value` FROM settings WHERE `key` = 'bot_username'"
            );
            if (rows && rows.length > 0 && rows[0].value) {
                botUsername = rows[0].value;
            }
        } catch (dbErr) {
            console.error('Error fetching bot_username from DB:', dbErr);
        }

        return NextResponse.json({
            total: totalMemory,
            used: usedMemory,
            free: freeMemory,
            usagePercent,
            totalGB,
            usedGB,
            freeGB,
            botUsername
        });
    } catch (error) {
        console.error('Error getting system info:', error);
        return NextResponse.json({ error: 'Failed to get system info' }, { status: 500 });
    }
}
