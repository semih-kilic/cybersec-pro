import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * EmptyState — friendly placeholder for empty lists / first-run experiences.
 *
 * Usage:
 *   <EmptyState
 *     icon={<ScanIcon />}
 *     title="No scans yet"
 *     description="Run your first security scan to see results here."
 *     action={<Button variant="primary">Start a scan</Button>}
 *   />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'vos-glass-1 flex flex-col items-center justify-center text-center gap-vos-4 px-vos-8 py-vos-16 rounded-vos-xl',
        className,
      )}
    >
      {icon && (
        <div
          className="size-14 rounded-vos-full bg-vos-glass-2 flex items-center justify-center text-vos-text-2"
          style={{ boxShadow: 'var(--vos-highlight)' }}
        >
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-vos-2 max-w-md">
        <h3 className="vos-h4">{title}</h3>
        {description && (
          <p className="text-vos-sm text-vos-text-3">{description}</p>
        )}
      </div>
      {action && <div className="mt-vos-2">{action}</div>}
    </div>
  );
}
