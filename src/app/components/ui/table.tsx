import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// border-separate (not collapse): collapsed borders don't travel with
// position:sticky cells (freeze panes). Cells draw right+bottom borders,
// the table draws the outer top+left frame — visually identical gridlines.
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table
        className={cn('w-full border-separate border-spacing-0 border-l border-t caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

export function TableHeader(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-accent/50', className)} {...props} />
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-7 border-b border-r bg-muted px-1 text-left align-middle text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-r p-1 align-middle', className)} {...props} />
}
