import * as React from "react"
import { clsx } from "clsx"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={clsx(
                    "flex h-10 w-full rounded-lg border border-zinc-200 bg-zinc-100/70 px-3 text-sm text-zinc-800 shadow-sm transition-all placeholder:text-zinc-600 focus-visible:border-emerald-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
