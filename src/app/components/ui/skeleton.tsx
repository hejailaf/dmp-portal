import { cn } from '@/lib/utils'

/** Pulsing placeholder block shown while a screen's data loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}
