import clsx from 'clsx';
import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
    children: React.ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
    return (
        <div className={clsx("rounded-2xl border border-zinc-200/80 bg-white text-card-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_22px_60px_-48px_rgba(0,0,0,.9)]", className)} {...props}>
            {children}
        </div>
    );
}

export function CardHeader({ className, children }: CardProps) {
    return (
        <div className={clsx("flex flex-col space-y-1.5 p-5 sm:p-6", className)}>
            {children}
        </div>
    );
}

export function CardDescription({ className, children }: CardProps) {
    return (
        <p className={clsx("text-sm leading-6 text-zinc-500", className)}>
        </p>
    );
}

export function CardTitle({ className, children }: CardProps) {
    return (
        <h3 className={clsx("font-semibold leading-none tracking-[-0.02em] text-zinc-900", className)}>
            {children}
        </h3>
    );
}

export function CardContent({ className, children }: CardProps) {
    return (
        <div className={clsx("p-5 pt-0 sm:p-6 sm:pt-0", className)}>
            {children}
        </div>
    );
}
