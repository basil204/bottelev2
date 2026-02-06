"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { useLanguage } from "../../contexts/LanguageContext";
import { LogOut, User } from "lucide-react";

export function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useLanguage();
    const [showDropdown, setShowDropdown] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    // Simple mapping or dynamic translation
    const key = pathname === "/" ? "dashboard" : pathname.split("/")[1];
    const pageName = t(`sidebar.${key}`) || (pathname === "/" ? "Dashboard" : pathname.split("/")[1].charAt(0).toUpperCase() + pathname.split("/")[1].slice(1));

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setLoggingOut(false);
        }
    };

    return (
        <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 w-full flex items-center justify-between px-6 md:px-8">
            <div className="flex items-center gap-4 md:pl-0 pl-12">
                <h2 className="text-lg font-semibold tracking-tight">{pageName}</h2>
            </div>
            <div className="flex items-center gap-4">
                <LanguageSwitcher />
                <div className="relative">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-semibold hover:ring-2 hover:ring-blue-500 transition-all"
                    >
                        <User className="w-4 h-4" />
                    </button>
                    {showDropdown && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowDropdown(false)}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-50 py-1">
                                <button
                                    onClick={handleLogout}
                                    disabled={loggingOut}
                                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50"
                                >
                                    <LogOut className="w-4 h-4" />
                                    {loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}

