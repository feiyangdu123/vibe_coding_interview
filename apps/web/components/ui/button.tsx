import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variants = {
      default: 'border border-primary bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(22,119,255,0.18)] hover:bg-primary/92',
      destructive: 'border border-destructive bg-destructive text-destructive-foreground shadow-[0_1px_2px_rgba(220,38,38,0.16)] hover:bg-destructive/92',
      outline: 'border border-input bg-background text-foreground hover:border-slate-300 hover:bg-slate-50',
      secondary: 'border border-transparent bg-secondary text-secondary-foreground hover:bg-slate-200',
      ghost: 'border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      link: 'border border-transparent bg-transparent text-primary underline-offset-4 hover:underline',
    }

    const sizes = {
      default: 'h-9 px-4',
      sm: 'h-8 px-3 text-xs',
      lg: 'h-10 px-5',
      icon: 'h-9 w-9',
    }

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-[color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
