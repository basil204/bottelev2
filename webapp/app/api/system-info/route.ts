import { NextResponse } from 'next/server';
import os from 'os';

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

        return NextResponse.json({
            total: totalMemory,
            used: usedMemory,
            free: freeMemory,
            usagePercent,
            totalGB,
            usedGB,
            freeGB,
        });
    } catch (error) {
        console.error('Error getting system info:', error);
        return NextResponse.json({ error: 'Failed to get system info' }, { status: 500 });
    }
}
