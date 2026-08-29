"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { NotificationBell } from "./NotificationBell";
import { useLanguage } from "../../contexts/LanguageContext";
import { LogOut, User, ChevronDown, Command } from "lucide-react";

export function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useLanguage();
    const [showDropdown, setShowDropdown] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    // Simple mapping or dynamic translation
    const currentPath = pathname || "/";
    const key = currentPath === "/" ? "dashboard" : currentPath.split("/")[1];
    const pageName = t(`sidebar.${key}`) || (currentPath === "/" ? "Dashboard" : key.charAt(0).toUpperCase() + key.slice(1));

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
        <header className="sticky top-0 z-30 flex h-[4.5rem] w-full items-center justify-between border-b border-zinc-200/80 bg-[#fafbf8]/90 px-4 backdrop-blur-xl md:px-8">
            {/* Page Title */}
            <div className="flex items-center gap-3 pl-12 md:pl-0">
                <div className="hidden h-8 w-8 items-center justify-center rounded-lg border border-zinc-200/80 bg-zinc-100/80 md:flex">
                    <Command className="h-4 w-4 text-emerald-700" />
                </div>
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Không gian quản trị</p>
                    <h2 className="text-sm font-semibold tracking-tight text-zinc-900">{pageName}</h2>
                </div>
            </div>
            
            {/* Header Actions */}
            <div className="flex items-center gap-2.5">
                <NotificationBell />
                <LanguageSwitcher />
                
                {/* User Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-100/80 px-2.5 text-sm text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-200/70 active:scale-[0.98]"
                    >
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10">
                            <User className="h-3 w-3 text-emerald-700" />
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                    </button>

                    {showDropdown && (
                        <>
                            {/* Dismiss overlay */}
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowDropdown(false)}
                            />
                            
                            {/* Glass Dropdown list */}
                            <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white/95 py-1.5 shadow-[0_18px_50px_-20px_rgba(0,0,0,.8)] backdrop-blur-xl">
                                <div className="px-3 py-2 border-b border-zinc-200/70 text-xs text-zinc-500 font-medium">
                                    Phiên quản trị
                                </div>
                                <button
                                    onClick={handleLogout}
                                    disabled={loggingOut}
                                    className="w-full px-3 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2.5 disabled:opacity-50 transition-colors"
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

