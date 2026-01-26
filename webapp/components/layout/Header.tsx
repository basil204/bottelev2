"use client";

import { ModeToggle } from "@/components/mode-toggle";
import { usePathname } from "next/navigation";

export function Header() {
    const pathname = usePathname();
    const pageName = pathname === "/" ? "Dashboard" : pathname.split("/")[1].charAt(0).toUpperCase() + pathname.split("/")[1].slice(1);

    return (
        <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 w-full flex items-center justify-between px-6 md:px-8">
            <div className="flex items-center gap-4 md:pl-0 pl-12">
                <h2 className="text-lg font-semibold tracking-tight">{pageName}</h2>
            </div>
            <div className="flex items-center gap-4">
                <ModeToggle />
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-semibold">
                    A
                </div>
            </div>
        </header>
    );
}
