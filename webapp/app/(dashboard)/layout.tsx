import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';
import pool from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
        redirect('/login');
    }

    const payload = await verifyJWT(token);
    if (!payload) {
        redirect('/login');
    }

    // Check auth_version for global logout
    try {
        const [rows] = await pool.query<any[]>(
            "SELECT `value` FROM settings WHERE `key` = 'admin_auth_version'"
        );
        const currentVersion = rows.length > 0 ? parseInt(rows[0].value) || 0 : 0;

        if (payload.auth_version !== currentVersion) {
            redirect('/login');
        }
    } catch (e) {
        console.error('Layout auth version check failed:', e);
        // Fallback: allow if DB is down but token is valid
    }

    return (
        <div className="flex min-h-[100dvh] overflow-hidden bg-background">
            <Sidebar />
            <div className="relative flex min-w-0 flex-1 flex-col md:pl-[17rem] transition-all duration-300 w-full">
                <Header />
                <main className="app-content flex-1 overflow-y-auto px-4 py-6 md:px-7 md:py-8 lg:px-10">
                    <div className="mx-auto max-w-[1400px] space-y-7">
                        {children}
                    </div>
                </main>
                <Footer />
            </div>
        </div>
    );
}
