import * as React from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { Button } from './button';

interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
    title?: string;
    description?: string;
    className?: string; // Content classname
}

export function Dialog({ open, onOpenChange, children, title, description, className }: DialogProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in-0">
            <div
                className={clsx(
                    "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg md:w-full",
                    className
                )}
            >
                <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                    {title && <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>}
                    {description && <p className="text-sm text-muted-foreground">{description}</p>}
                </div>

                {children}

                <button
                    onClick={() => onOpenChange(false)}
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>
            </div>
        </div>
    );
}
