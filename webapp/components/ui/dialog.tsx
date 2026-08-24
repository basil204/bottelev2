'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
    title?: string;
    description?: string;
    className?: string; // Content classname
    hideCloseButton?: boolean;
}

export function Dialog({ open, onOpenChange, children, title, description, className, hideCloseButton }: DialogProps) {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    React.useEffect(() => {
        if (!open) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onOpenChange(false);
        };
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, onOpenChange]);

    if (!open || !mounted || typeof document === 'undefined') return null;

    // Automatically hide default close button if p-0 is passed (indicating custom header) or explicitly requested
    const shouldShowCloseButton = !hideCloseButton && !className?.includes('p-0');

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-md animate-in fade-in-0">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? 'dialog-title' : undefined}
                className={clsx(
                    "relative z-[99999] my-auto flex max-h-[calc(100vh-4rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_30px_90px_-35px_rgba(0,0,0,.45)] duration-200",
                    className
                )}
            >
                {(title || description) && (
                    <div className="shrink-0 border-b border-zinc-100 px-5 py-5 pr-14 sm:px-6">
                        {title && <h2 id="dialog-title" className="text-lg font-semibold leading-none tracking-tight text-zinc-900">{title}</h2>}
                        {description && <p className="text-sm leading-6 text-zinc-500">{description}</p>}
                    </div>
                )}

                <div className={clsx("min-h-0 flex-1 overflow-y-auto overscroll-contain", !className?.includes('p-0') && "px-5 pb-5 sm:px-6 sm:pb-6")}>
                    {children}
                </div>

                {shouldShowCloseButton && (
                    <button
                        onClick={() => onOpenChange(false)}
                        className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Đóng</span>
                    </button>
                )}
            </div>
        </div>,
        document.body
    );
}
