import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold tracking-tight transition-[colors,transform,box-shadow] duration-pos active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-primary text-brand-on-primary shadow-glow hover:bg-brand-primary-hover hover:shadow-lift active:bg-brand-primary-active',
        secondary:
          'border border-line/90 bg-surface-raised/90 text-ink shadow-soft hover:border-brand-primary/30 hover:bg-brand-tint/40 active:bg-surface-muted',
        ghost: 'bg-transparent text-ink-muted hover:bg-brand-tint/50 hover:text-brand-primary',
        danger: 'bg-danger text-danger-on shadow-soft hover:opacity-90 active:opacity-80',
      },
      size: {
        sm: 'h-9 px-3.5 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean
  }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : null}
      {children}
    </button>
  ),
)

Button.displayName = 'Button'
