import clsx from 'clsx';
import React from 'react';

interface CardProps {
    className?: string;
    children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
    return (
        <div className={clsx("rounded-xl border bg-card text-card-foreground shadow-sm", className)}>
            {children}
        </div>
    );
}

export function CardHeader({ className, children }: CardProps) {
    return (
        <div className={clsx("flex flex-col space-y-1.5 p-6", className)}>
            {children}
        </div>
    );
}

export function CardDescription({ className, children }: CardProps) {
    return (
        <p className={clsx("text-sm text-muted-foreground", className)}>
            {children}
        </p>
    );
}

export function CardTitle({ className, children }: CardProps) {
    return (
        <h3 className={clsx("font-semibold leading-none tracking-tight", className)}>
            {children}
        </h3>
    );
}

export function CardContent({ className, children }: CardProps) {
    return (
        <div className={clsx("p-6 pt-0", className)}>
            {children}
        </div>
    );
}
