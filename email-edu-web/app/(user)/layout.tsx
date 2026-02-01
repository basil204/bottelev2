'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    PlusCircle,
    Mail,
    User,
    LogOut,
    Menu,
    X,
    Clock,
    Key
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

const navItems = [
    { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { href: '/dashboard/create-email', label: 'Tạo Email mới', icon: PlusCircle },
    { href: '/dashboard/my-emails', label: 'Email của tôi', icon: Mail },
    { href: '/dashboard/tmail', label: 'tMail (Temp)', icon: Clock },
    { href: '/dashboard/2fa', label: 'Quản lý 2FA', icon: Key },
    { href: '/dashboard/profile', label: 'Tài khoản', icon: User },
];

export default function UserLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    };

    return (
        <div className="min-h-screen flex">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={clsx(
                "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-300 ease-in-out",
                sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}>
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center justify-between h-16 px-6 border-b">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-500 to-blue-600">
                                Email EDU
                            </span>
                        </Link>
                        <button
                            className="lg:hidden text-muted-foreground hover:text-foreground"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={clsx(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                                        isActive
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Logout */}
                    <div className="px-4 py-4 border-t">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                            <LogOut className="h-5 w-5" />
                            <span>Đăng xuất</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col">
                {/* Top bar */}
                <header className="h-16 border-b bg-card flex items-center px-6 gap-4">
                    <button
                        className="lg:hidden text-muted-foreground hover:text-foreground"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                    <h1 className="text-lg font-semibold">Tạo Email EDU</h1>
                </header>

                {/* Page content */}
                <main className="flex-1 p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
