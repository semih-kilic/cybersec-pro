import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Stat — single hero metric card.
 *   <Stat label="Active Scans" value="247" delta={{ value: '+12%', tone: 'success' }} />
 */
export function Stat({
  label,
  value,
  hint,
  icon,
  delta,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  delta?: { value: ReactNode; tone?: 'success' | 'danger' | 'default' };
  className?: string;
}) {
  const deltaColor =
    delta?.tone === 'success' ? 'text-vos-success'
    : delta?.tone === 'danger' ? 'text-vos-danger'
    : 'text-vos-text-3';

  return (
    <div
      className={cn(
        'vos-glass-2 vos-lift rounded-vos-xl p-vos-6 flex flex-col gap-vos-3',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="vos-eyebrow">{label}</span>
        {icon && (
          <span className="size-9 rounded-vos-md bg-vos-glass-2 flex items-center justify-center text-vos-text-2">
            {icon}
          </span>
        )}
      </div>
      <div className="vos-num text-vos-3xl font-semibold tracking-[-0.02em] text-vos-text">
        {value}
      </div>
      <div className="flex items-center gap-vos-2 min-h-[1.25rem]">
        {delta && (
          <span className={cn('text-vos-xs font-medium', deltaColor)}>
            {delta.value}
          </span>
        )}
        {hint && <span className="text-vos-xs text-vos-text-muted">{hint}</span>}
      </div>
    </div>
  );
}

/** Responsive grid container for Stat cards */
export function StatGroup({
  children,
  cols = 4,
  className,
}: { children?: ReactNode; cols?: 2 | 3 | 4; className?: string }) {
  const gridCols =
    cols === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
    : cols === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-1 sm:grid-cols-2';
  return <div className={cn('grid gap-vos-4', gridCols, className)}>{children}</div>;
}
