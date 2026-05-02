import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
  children?: ReactNode;
}

const toneClass: Record<NonNullable<BadgeProps['tone']>, string> = {
  default: 'bg-vos-glass-1 text-vos-text-2 border-vos-border-2',
  accent:  'bg-vos-accent-soft text-vos-accent-2 border-transparent',
  success: 'bg-vos-success-soft text-vos-success border-transparent',
  warning: 'bg-vos-warning-soft text-vos-warning border-transparent',
  danger:  'bg-vos-danger-soft text-vos-danger border-transparent',
  info:    'bg-vos-info-soft text-vos-info border-transparent',
};

const dotToneClass: Record<NonNullable<BadgeProps['tone']>, string> = {
  default: 'bg-vos-text-3',
  accent:  'bg-vos-accent',
  success: 'bg-vos-success',
  warning: 'bg-vos-warning',
  danger:  'bg-vos-danger',
  info:    'bg-vos-info',
};

export function Badge({
  tone = 'default',
  size = 'md',
  dot,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-vos-full border font-medium tracking-[-0.005em] backdrop-blur-vos-1',
        size === 'sm' ? 'px-2 py-0.5 text-vos-2xs' : 'px-2.5 py-1 text-vos-xs',
        toneClass[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className={cn('size-1.5 rounded-full', dotToneClass[tone])} />}
      {children}
    </span>
  );
}

/* ─── SeverityBadge — security-domain helper ───────────────────── */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

const sevConfig: Record<Severity, { label: string; bg: string; fg: string }> = {
  critical: { label: 'Critical', bg: 'bg-[color:var(--vos-sev-critical)]/15', fg: 'text-[color:var(--vos-sev-critical)]' },
  high:     { label: 'High',     bg: 'bg-[color:var(--vos-sev-high)]/15',     fg: 'text-[color:var(--vos-sev-high)]' },
  medium:   { label: 'Medium',   bg: 'bg-[color:var(--vos-sev-medium)]/15',   fg: 'text-[color:var(--vos-sev-medium)]' },
  low:      { label: 'Low',      bg: 'bg-[color:var(--vos-sev-low)]/15',      fg: 'text-[color:var(--vos-sev-low)]' },
  info:     { label: 'Info',     bg: 'bg-[color:var(--vos-sev-info)]/15',     fg: 'text-[color:var(--vos-sev-info)]' },
};

export function SeverityBadge({
  severity,
  score,
  className,
}: {
  severity: Severity;
  score?: number | string;
  className?: string;
}) {
  const c = sevConfig[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-vos-full border border-transparent px-2.5 py-1 text-vos-xs font-semibold tracking-[-0.005em] backdrop-blur-vos-1',
        c.bg,
        c.fg,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {c.label}
      {score !== undefined && (
        <span className="vos-mono text-vos-2xs opacity-80">{score}</span>
      )}
    </span>
  );
}
