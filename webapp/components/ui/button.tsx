import clsx from 'clsx';
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function Button({ className, variant = 'default', size = 'default', ...props }: ButtonProps) {
    return (
        <button
            className={clsx(
                "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/10 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]",
                {
                    'bg-[#17623f] text-white shadow-[0_10px_25px_-16px_rgba(23,98,63,.8)] hover:bg-[#1d714a]': variant === 'default',
                    'bg-red-600 text-white shadow-sm hover:bg-red-700': variant === 'destructive',
                    'border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950': variant === 'outline',
                    'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80': variant === 'secondary',
                    'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950': variant === 'ghost',
                    'text-primary underline-offset-4 hover:underline': variant === 'link',
                    'h-10 px-4 py-2': size === 'default',
                    'h-9 rounded-lg px-3 text-xs': size === 'sm',
                    'h-10 rounded-md px-8': size === 'lg',
                    'h-9 w-9': size === 'icon',
                },
                className
            )}
            {...props}
        />
    );
}
