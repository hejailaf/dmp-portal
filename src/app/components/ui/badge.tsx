import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// PM DataCare badge: 24px pill, 12.5px/600, 7px status dot in the text color.
// Tint/text pairs come from the brand vars in styles.css (they flip in .dark).
const badgeVariants = cva(
  'inline-flex h-6 items-center gap-[7px] whitespace-nowrap rounded-full px-[11px] text-[12.5px] font-semibold',
  {
    variants: {
      variant: {
        neutral: 'bg-secondary text-[#5F6369] dark:text-[#A0A099]',
        blue: 'bg-[var(--sky-tint)] text-primary',
        green: 'bg-[var(--teal-tint)] text-[var(--teal)]',
        amber: 'bg-[var(--warning-tint)] text-[var(--warning)]',
        red: 'bg-[var(--danger-tint)] text-destructive',
        outline: 'border border-[var(--border-strong)] bg-transparent text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {variant !== 'outline' && <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full bg-current" />}
      {children}
    </span>
  )
}
