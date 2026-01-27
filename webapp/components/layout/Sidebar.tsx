"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
    LayoutDashboard,
    Users,
    Package,
    ShoppingCart,
    Wallet,
    Settings,
    LogOut,
    Menu,
    Bell,
    Landmark
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

import { useLanguage } from "../../contexts/LanguageContext";

export function Sidebar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useLanguage();

    const navItems = [
        { name: t('sidebar.dashboard'), href: "/", icon: LayoutDashboard },
        { name: t('sidebar.users'), href: "/users", icon: Users },
        { name: t('sidebar.products'), href: "/products", icon: Package },
        { name: t('sidebar.orders'), href: "/orders", icon: ShoppingCart },
        { name: t('sidebar.deposits'), href: "/deposits", icon: Wallet },
        { name: "Lịch sử Bank", href: "/bank-history", icon: Landmark },
        { name: t('sidebar.notifications'), href: "/notifications", icon: Bell },
        { name: t('sidebar.settings'), href: "/settings", icon: Settings },
    ];

    return (
        <>
            <div className="md:hidden fixed top-4 left-4 z-50">
                <Button variant="outline" size="icon" onClick={() => setIsOpen(!isOpen)}>
                    <Menu className="h-4 w-4" />
                </Button>
            </div>

            <div className={clsx(
                "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r transition-transform duration-300 ease-in-out md:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex flex-col h-full">
                    <div className="h-16 flex items-center justify-center border-b px-6">
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                            Admin Panel
                        </h1>
                    </div>

                    <div className="flex-1 overflow-y-auto py-4">
                        <nav className="space-y-1 px-3">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={clsx(
                                            "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                                            isActive
                                                ? "bg-primary text-primary-foreground"
                                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                        )}
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <item.icon className="h-5 w-5" />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="p-4 border-t">
                        <Button variant="ghost" className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10">
                            <LogOut className="h-5 w-5" />
                            {t('sidebar.logout')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
