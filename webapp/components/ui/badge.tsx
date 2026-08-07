import * as React from "react"
import { clsx } from "clsx"

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "secondary" | "destructive" | "outline"
}

function Badge({
    className,
    variant = "default",
    ...props
}: BadgeProps) {
    return (
        <div
            className={clsx(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-700/20",
                variant === "default" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                variant === "secondary" && "border-zinc-200 bg-zinc-100 text-zinc-700",
                variant === "destructive" && "border-red-200 bg-red-50 text-red-700",
                variant === "outline" && "border-zinc-200 bg-white text-zinc-700",
                className
            )}
            {...props}
        />
    )
}

export { Badge }
