import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/**
 * Skeleton — shimmer-animated placeholder block.
 * Use for loading states instead of generic spinners on layout-heavy pages.
 */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('vos-skeleton', className)} aria-hidden {...rest} />;
}

/** Multiple skeleton lines simulating a paragraph */
export function SkeletonText({
  lines = 3,
  className,
}: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-vos-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

/** Card-shaped skeleton for grid placeholders */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('vos-glass-2 p-vos-6 rounded-vos-xl', className)}>
      <Skeleton className="h-3 w-24 mb-vos-4" />
      <Skeleton className="h-8 w-32 mb-vos-3" />
      <SkeletonText lines={2} />
    </div>
  );
}
