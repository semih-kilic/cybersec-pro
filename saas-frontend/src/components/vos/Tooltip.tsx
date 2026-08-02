import { useState, type ReactNode, cloneElement, isValidElement, type ReactElement } from 'react';
import { cn } from '../../lib/cn';

/**
 * Tooltip — minimal, no dependencies.
 * Wrap a single child element. Shows label on hover/focus.
 */
export function Tooltip({
  children,
  label,
  side = 'top',
  className,
}: {
  children: ReactElement;
  label: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const sideClass = {
    top:    'bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2',
    bottom: 'top-[calc(100%+8px)]    left-1/2 -translate-x-1/2',
    left:   'right-[calc(100%+8px)]  top-1/2  -translate-y-1/2',
    right:  'left-[calc(100%+8px)]   top-1/2  -translate-y-1/2',
  }[side];

  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement, {
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
        onFocus:      () => setOpen(true),
        onBlur:       () => setOpen(false),
      } as any)
    : children;

  return (
    <span className="relative inline-flex">
      {trigger}
      {open && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-vos-tooltip whitespace-nowrap rounded-vos-md border border-vos-border-2 bg-vos-glass-3 px-2.5 py-1.5 text-vos-xs text-vos-text-2 shadow-vos-3 backdrop-blur-vos-2',
            sideClass,
            className,
          )}
          style={{ animation: 'vos-fade-in 160ms var(--vos-ease-out) both' }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
