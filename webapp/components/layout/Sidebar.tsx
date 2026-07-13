"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
    LayoutDashboard,
    Users,
    Package,
    Folder,
    ShoppingCart,
    Wallet,
    Settings,
    LogOut,
    Menu,
    Bell,
    Landmark,
    Mail,
    CheckCircle,
    Archive,
    Activity,
    UserCog,
    BarChart3,
    Bot,
    Globe,
    Shield
} from "lucide-react";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

import { useLanguage } from "../../contexts/LanguageContext";

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [adminRole, setAdminRole] = useState<string>('admin');
    const { t, language, setLanguage } = useLanguage();

    useEffect(() => {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'admin_role') {
                setAdminRole(value);
                break;
            }
        }
    }, []);

    const navItems = [
        { name: t('sidebar.dashboard'), href: "/", icon: LayoutDashboard },
        { name: t('sidebar.users'), href: "/users", icon: Users },
        { name: t('sidebar.products'), href: "/products", icon: Package },
        { name: "Thư mục", href: "/categories", icon: Folder },
        { name: "Gmail EDU", href: "/gmail-edu", icon: Mail },
        { name: "Check Live Gmail", href: "/check-gmail", icon: CheckCircle },
        { name: "ChatGPT", href: "/chatgpt", icon: Bot },
        { name: t('sidebar.orders'), href: "/orders", icon: ShoppingCart },
        { name: t('sidebar.deposits'), href: "/deposits", icon: Wallet },
        { name: "Lịch sử Bank", href: "/bank-history", icon: Landmark },
        { name: "Kho", href: "/stored-accounts", icon: Archive },
        { name: "Nhật ký", href: "/admin-logs", icon: Activity },
        { name: "Thống kê Admin", href: "/admin-stats", icon: BarChart3 },
        { name: t('sidebar.notifications'), href: "/notifications", icon: Bell },
        { name: "Quản lý Admin", href: "/admin-accounts", icon: UserCog, superAdminOnly: true },
        { name: t('sidebar.settings'), href: "/settings", icon: Settings },
    ];

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
        <>
            {/* Mobile Sidebar Trigger */}
            <div className="md:hidden fixed top-4 left-4 z-50">
                <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setIsOpen(!isOpen)}
                    className="bg-zinc-950/80 backdrop-blur-md border-white/10 hover:bg-white/5"
                >
                    <Menu className="h-4 w-4 text-white" />
                </Button>
            </div>

            {/* Sidebar Navigation */}
            <div className={clsx(
                "fixed inset-y-0 left-0 z-40 w-64 bg-zinc-950/40 border-r border-white/5 backdrop-blur-xl transition-transform duration-300 ease-in-out md:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex flex-col h-full">
                    {/* Sidebar Header Brand */}
                    <div className="h-16 flex items-center gap-3 border-b border-white/5 px-6">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                            <Shield className="h-4 w-4 text-white" />
                        </div>
                        <h1 className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                            Admin Portal
                        </h1>
                    </div>

                    {/* Navigation Links */}
                    <div className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
                        <nav className="space-y-1">
                            {navItems
                                .filter(item => !(item as any).superAdminOnly || adminRole === 'super_admin')
                                .map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={clsx(
                                                "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group",
                                                isActive
                                                    ? "bg-gradient-to-r from-violet-600/20 to-indigo-600/10 border-l-2 border-violet-500 text-violet-200 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                                                    : "text-slate-400 hover:bg-white/[0.02] hover:text-white"
                                            )}
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <item.icon className={clsx(
                                                "h-4 w-4 transition-transform group-hover:scale-110",
                                                isActive ? "text-violet-400" : "text-slate-500 group-hover:text-slate-300"
                                            )} />
                                            {item.name}
                                        </Link>
                                    );
                                })}
                        </nav>
                    </div>

                    {/* Sidebar Footer Controls */}
                    <div className="p-4 border-t border-white/5 space-y-2 bg-zinc-950/20">
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.02] transition-colors"
                            onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
                        >
                            <Globe className="h-4 w-4 text-violet-400" />
                            {language === 'vi' ? '🇻🇳 Tiếng Việt' : '🇺🇸 English'}
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                            onClick={handleLogout}
                            disabled={loggingOut}
                        >
                            <LogOut className="h-4 w-4" />
                            {loggingOut ? 'Đang đăng xuất...' : t('sidebar.logout')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}

