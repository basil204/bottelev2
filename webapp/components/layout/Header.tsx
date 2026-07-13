"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { useLanguage } from "../../contexts/LanguageContext";
import { LogOut, User, ChevronDown } from "lucide-react";

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
        <header className="h-16 border-b border-white/5 bg-zinc-950/20 backdrop-blur-md sticky top-0 z-30 w-full flex items-center justify-between px-6 md:px-8">
            {/* Page Title */}
            <div className="flex items-center gap-4 md:pl-0 pl-12">
                <h2 className="text-md font-semibold tracking-wide text-slate-200 uppercase">{pageName}</h2>
            </div>
            
            {/* Header Actions */}
            <div className="flex items-center gap-4">
                <LanguageSwitcher />
                
                {/* User Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all text-sm text-slate-300 hover:text-white"
                    >
                        <div className="w-5 h-5 rounded-full bg-violet-600/20 flex items-center justify-center border border-violet-500/20">
                            <User className="w-3 h-3 text-violet-400" />
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
                            <div className="absolute right-0 mt-2 w-48 bg-zinc-950/90 border border-white/10 backdrop-blur-xl rounded-xl shadow-xl z-50 py-1.5 overflow-hidden">
                                <div className="px-3 py-2 border-b border-white/5 text-xs text-slate-500 font-medium">
                                    Admin Session
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

