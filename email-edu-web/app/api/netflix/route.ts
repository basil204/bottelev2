import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const NETFLIX_API_URL = 'https://script.google.com/macros/s/AKfycbxtMd6l2TN2OL4C7DTGzMnscn61TQCjskZmLzAMbtrPyi8lJGDebmbZ9BTyE0AnfXn3/exec';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search')?.toLowerCase() || '';

        // Fetch data from Google Sheets
        const response = await fetch(NETFLIX_API_URL, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch Netflix data');
        }

        const rawData = await response.json();

        // Parse data - skip header row and empty rows
        // Only include entries that have BOTH email and password
        const data: { code: string; info: string }[] = [];

        if (Array.isArray(rawData)) {
            // Iterate from bottom to top (newest first)
            for (let i = rawData.length - 1; i >= 1; i--) {
                const row = rawData[i];
                if (Array.isArray(row) && row[0] && row[1]) {
                    const code = String(row[0]).trim();
                    const info = String(row[1]).trim();

                    // Skip empty entries
                    if (!code || !info) continue;

                    // Skip entries without email (must contain @)
                    if (!info.includes('@')) continue;

                    // Skip entries that are only password/number without email
                    // Must have format: email password (e.g., "linda49jaramillos8y@hotmail.com 0103022")
                    const parts = info.split(/\s+/);
                    const hasEmail = parts.some(p => p.includes('@'));
                    const hasPassword = parts.some(p => !p.includes('@') && p.match(/^[a-zA-Z0-9]+$/));

                    if (!hasEmail || !hasPassword) continue;

                    // Apply search filter
                    if (search) {
                        const searchLower = search.toLowerCase();
                        if (!code.toLowerCase().includes(searchLower) &&
                            !info.toLowerCase().includes(searchLower)) {
                            continue;
                        }
                    }

                    data.push({ code, info });
                }
            }
        }

        return NextResponse.json({
            success: true,
            data,
            total: data.length
        });
    } catch (error) {
        console.error('Error fetching Netflix data:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
