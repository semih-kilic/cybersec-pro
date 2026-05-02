import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Chip — smaller, denser badge alternative for filters / tags / inline meta.
 * Supports an optional remove-button slot via `onRemove`.
 */
export function Chip({
  className,
  children,
  leftIcon,
  onRemove,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & {
  leftIcon?: ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className={cn('vos-chip', className)} {...rest}>
      {leftIcon && <span className="opacity-80">{leftIcon}</span>}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="-mr-1 ml-0.5 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Remove"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  );
}
