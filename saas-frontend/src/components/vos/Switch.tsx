import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Switch — accessible toggle. Controlled component.
 *
 *   <Switch checked={on} onCheckedChange={setOn} label="Enable notifications" />
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  description,
  className,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-vos-2 ease-vos-out',
        'border border-vos-border-2',
        checked ? 'bg-vos-accent' : 'bg-vos-glass-2',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
      style={{ boxShadow: 'var(--vos-highlight)' }}
    >
      <span
        className={cn(
          'inline-block size-4 rounded-full bg-white shadow transition-transform duration-vos-2 ease-vos-spring',
          checked ? 'translate-x-[18px]' : 'translate-x-1',
        )}
      />
    </button>
  );

  if (!label && !description) return <span className={className}>{toggle}</span>;

  return (
    <label className={cn('flex items-start gap-vos-3 cursor-pointer', disabled && 'cursor-not-allowed', className)}>
      {toggle}
      <span className="flex flex-col gap-0.5 -mt-0.5">
        {label && <span className="text-vos-sm font-medium text-vos-text">{label}</span>}
        {description && <span className="text-vos-xs text-vos-text-3">{description}</span>}
      </span>
    </label>
  );
}
