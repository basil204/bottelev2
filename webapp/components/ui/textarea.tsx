import * as React from "react"
import { clsx } from "clsx"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                className={clsx(
                    "flex min-h-24 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 shadow-sm transition-all placeholder:text-zinc-400 focus-visible:border-emerald-700/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/[0.07] disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Textarea.displayName = "Textarea"

export { Textarea }
