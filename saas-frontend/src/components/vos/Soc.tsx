/**
 * SOC Primitives — V21 Enhanced. CrowdStrike/SentinelOne-class building blocks.
 *
 * V21 Enhancements:
 * - Improved PageHeader with animations
 * - Enhanced StatusPill with pulse animation
 * - Better FilterChip hover states
 * - Improved CommandBar styling
 * - Better SearchField focus states
 * - Enhanced Section component
 * - Improved DenseTable row interactions
 * - Better KeyValueGrid layout
 * - Enhanced RiskScore animation
 * - Improved SeverityHeatmap visual
 */

import {
  type ReactNode,
  type ComponentType,
  type InputHTMLAttributes,
  forwardRef,
  useId,
} from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

/* ════════════════════════════════════════════════════════════════════ *
 *  PageHeader — V21 Enhanced. Apple-grade page hero
 * ════════════════════════════════════════════════════════════════════ */

export function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  badge,
  actions,
  animated = true,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  animated?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-vos-6 sm:flex-row sm:items-end sm:justify-between',
        animated && 'vos-rise-in',
        className,
      )}
    >
      <div className="flex items-start gap-vos-4 min-w-0">
        {icon && (
          <span className="size-12 rounded-vos-lg bg-vos-bg-elev-2 border border-vos-border-1 flex items-center justify-center text-vos-text-2 shrink-0 transition-colors duration-200 group-hover:text-vos-accent">
            {icon}
          </span>
        )}
        <div className="flex flex-col gap-vos-2 min-w-0">
          {eyebrow && (
            <span className="text-vos-xs font-medium text-vos-text-3 uppercase tracking-vos-wide">
              {eyebrow}
            </span>
          )}
          <div className="flex items-center gap-vos-3 flex-wrap">
            <h1 className="text-vos-4xl font-semibold tracking-vos-tight leading-vos-tight text-vos-text">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-vos-sm text-vos-text-3 max-w-2xl">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-vos-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}

/* ════════════════════════════════════════════════════════════════════ *
 *  CommandBar — V21 Enhanced. Search + filters + actions row
 * ════════════════════════════════════════════════════════════════════ */

export function CommandBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-vos-2 flex-wrap',
        'p-vos-2 rounded-vos-lg border border-vos-border-1 bg-vos-bg-elev-2',
        'transition-all duration-200',
        className,
      )}
    >
      {children}
    </div>
  );
}

export const SearchField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function SearchField({ className, placeholder = 'Search…', ...rest }, ref) {
    const id = useId();
    return (
      <label
        htmlFor={id}
        className={cn(
          'flex items-center gap-2 px-vos-3 h-9 rounded-vos-md',
          'bg-vos-bg-elev-3 border border-vos-border-1',
          'focus-within:border-vos-accent focus-within:shadow-[0_0_0_3px_var(--vos-accent-soft)]',
          'transition-all duration-200 min-w-[260px] flex-1',
          className,
        )}
      >
        <Search size={14} className="text-vos-text-3 shrink-0" />
        <input
          ref={ref}
          id={id}
          type="search"
          placeholder={placeholder}
          className="flex-1 bg-transparent border-0 outline-none text-vos-sm text-vos-text placeholder:text-vos-text-muted"
          {...rest}
        />
      </label>
    );
  },
);

/* ════════════════════════════════════════════════════════════════════ *
 *  FilterChip — V21 Enhanced. Toggleable filter pill
 * ════════════════════════════════════════════════════════════════════ */

export function FilterChip({
  label,
  value,
  active,
  onClick,
  onRemove,
  icon: Icon,
  className,
}: {
  label: ReactNode;
  value?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  icon?: ComponentType<{ size?: string | number; className?: string }>;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-vos-3 rounded-vos-md',
        'text-vos-xs font-medium transition-all duration-200',
        'border',
        active
          ? 'bg-vos-accent/15 border-vos-accent/30 text-vos-accent shadow-sm'
          : 'bg-vos-bg-elev-3 border-vos-border-1 text-vos-text-2 hover:border-vos-border-2 hover:text-vos-text hover:bg-vos-bg-elev-4',
        className,
      )}
    >
      {Icon && <Icon size={12} className="shrink-0" />}
      <span>{label}</span>
      {value !== undefined && (
        <>
          <span className="text-vos-text-muted">·</span>
          <span className={cn('font-semibold', active ? 'text-vos-accent' : 'text-vos-text')}>
            {value}
          </span>
        </>
      )}
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
          className="ml-1 -mr-1 inline-flex items-center justify-center size-4 rounded hover:bg-vos-bg-elev-4 text-vos-text-3 hover:text-vos-text transition-colors"
          aria-label="Remove filter"
        >
          <X size={10} />
        </span>
      )}
    </button>
  );
}

export function FilterDropdown({
  label,
  value,
  onClick,
  className,
}: {
  label: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-vos-3 rounded-vos-md',
        'text-vos-xs font-medium text-vos-text-2',
        'bg-vos-bg-elev-3 border border-vos-border-1',
        'hover:border-vos-border-2 hover:text-vos-text hover:bg-vos-bg-elev-4',
        'transition-all duration-200',
        className,
      )}
    >
      <Filter size={12} />
      <span>{label}</span>
      {value !== undefined && (
        <>
          <span className="text-vos-text-muted">·</span>
          <span className="font-semibold text-vos-text">{value}</span>
        </>
      )}
      <ChevronDown size={12} className="text-vos-text-3 ml-0.5" />
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════════ *
 *  StatusPill — V21 Enhanced. Semantic status badge with leading dot
 * ════════════════════════════════════════════════════════════════════ */

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

const statusToneClass: Record<StatusTone, { bg: string; text: string; dot: string }> = {
  success: { bg: 'bg-vos-success/10', text: 'text-vos-success', dot: 'bg-vos-success' },
  warning: { bg: 'bg-vos-warning/10', text: 'text-vos-warning', dot: 'bg-vos-warning' },
  danger:  { bg: 'bg-vos-danger/10',  text: 'text-vos-danger',  dot: 'bg-vos-danger'  },
  info:    { bg: 'bg-vos-info/10',    text: 'text-vos-info',    dot: 'bg-vos-info'    },
  accent:  { bg: 'bg-vos-accent/10',  text: 'text-vos-accent',  dot: 'bg-vos-accent'  },
  neutral: { bg: 'bg-vos-bg-elev-3',  text: 'text-vos-text-2',  dot: 'bg-vos-text-3'  },
};

export function StatusPill({
  tone = 'neutral',
  pulse,
  children,
  label,
  className,
}: {
  tone?: StatusTone;
  pulse?: boolean;
  children?: ReactNode;
  label?: ReactNode;
  className?: string;
}) {
  const c = statusToneClass[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 h-6 rounded-vos-full',
        'text-[11px] font-semibold tracking-vos-snug',
        'transition-all duration-200',
        c.bg,
        c.text,
        className,
      )}
    >
      <span className="relative inline-flex">
        <span className={cn('size-1.5 rounded-full', c.dot)} />
        {pulse && (
          <span
            className={cn(
              'absolute inset-0 size-1.5 rounded-full animate-ping',
              c.dot,
              'opacity-60',
            )}
          />
        )}
      </span>
      {children ?? label}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════ *
 *  SeverityBadge / SeverityHeatmap — V21 Enhanced
 * ════════════════════════════════════════════════════════════════════ */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

const severityClass: Record<Severity, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-vos-sev-critical/15', text: 'text-vos-sev-critical', border: 'border-vos-sev-critical/30' },
  high:     { bg: 'bg-vos-sev-high/15',     text: 'text-vos-sev-high',     border: 'border-vos-sev-high/30'    },
  medium:   { bg: 'bg-vos-sev-medium/15',   text: 'text-vos-sev-medium',   border: 'border-vos-sev-medium/30'  },
  low:      { bg: 'bg-vos-sev-low/15',      text: 'text-vos-sev-low',      border: 'border-vos-sev-low/30'     },
  info:     { bg: 'bg-vos-sev-info/15',     text: 'text-vos-sev-info',     border: 'border-vos-sev-info/30'    },
};

export function SeverityTag({
  severity,
  size = 'sm',
  className,
}: {
  severity: Severity;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const c = severityClass[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-vos-sm border font-semibold uppercase tracking-vos-wide',
        'transition-all duration-200',
        c.bg,
        c.text,
        c.border,
        size === 'sm' ? 'px-1.5 h-5 text-[10px]' : 'px-2 h-6 text-[11px]',
        className,
      )}
    >
      {severity}
    </span>
  );
}

/**
 * SeverityHeatmap — V21 Enhanced. Single-row stacked bar showing severity composition.
 */
export function SeverityHeatmap({
  counts,
  showLabels = true,
  size = 'md',
  className,
  total: totalProp,
  compact,
}: {
  counts: Partial<Record<Severity, number>>;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  total?: number;
  compact?: boolean;
}) {
  const computedTotal =
    (counts.critical ?? 0) +
    (counts.high ?? 0) +
    (counts.medium ?? 0) +
    (counts.low ?? 0) +
    (counts.info ?? 0);
  const total = totalProp ?? computedTotal;
  if (compact) showLabels = false;
  const heightClass = size === 'sm' ? 'h-1' : size === 'lg' ? 'h-3' : 'h-2';
  const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const colorBg: Record<Severity, string> = {
    critical: 'bg-vos-sev-critical',
    high:     'bg-vos-sev-high',
    medium:   'bg-vos-sev-medium',
    low:      'bg-vos-sev-low',
    info:     'bg-vos-sev-info',
  };

  return (
    <div className={cn('flex flex-col gap-vos-2', className)}>
      {showLabels && (
        <div className="flex items-center gap-vos-3 text-vos-xs flex-wrap">
          {order.map((sev) => {
            const n = counts[sev] ?? 0;
            return (
              <span key={sev} className="inline-flex items-center gap-1.5">
                <span className={cn('size-2 rounded-sm', colorBg[sev])} />
                <span className="text-vos-text-3 capitalize">{sev}</span>
                <span className="text-vos-text font-semibold tabular-nums">{n}</span>
              </span>
            );
          })}
          <span className="ml-auto text-vos-text-3">
            Total <span className="text-vos-text font-semibold tabular-nums">{total}</span>
          </span>
        </div>
      )}
      <div className={cn('flex rounded-full overflow-hidden bg-vos-bg-elev-3', heightClass)}>
        {total === 0 ? (
          <div className="flex-1" />
        ) : (
          order.map((sev) => {
            const n = counts[sev] ?? 0;
            if (n === 0) return null;
            return (
              <div
                key={sev}
                className={cn('h-full transition-all duration-300', colorBg[sev])}
                style={{ width: `${(n / total) * 100}%` }}
                title={`${sev}: ${n}`}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════ *
 *  RiskScore — V21 Enhanced. Circular score gauge with semantic tone
 * ════════════════════════════════════════════════════════════════════ */

export function RiskScore({
  score,
  value,
  outOf = 100,
  size = 80,
  strokeWidth = 6,
  label,
  invert,
  animated = true,
}: {
  score?: number;
  value?: number;
  outOf?: number;
  size?: number;
  strokeWidth?: number;
  label?: ReactNode;
  invert?: boolean;
  animated?: boolean;
}) {
  const rawScore = score ?? value;
  const effectiveScore = (typeof rawScore === 'number' && Number.isFinite(rawScore)) ? rawScore : 0;
  const safeOutOf = (typeof outOf === 'number' && Number.isFinite(outOf) && outOf > 0) ? outOf : 100;
  const pct = Math.max(0, Math.min(1, effectiveScore / safeOutOf));
  const tone =
    invert
      ? pct >= 0.66 ? 'critical' : pct >= 0.33 ? 'medium' : 'success'
      : pct >= 0.8 ? 'success' : pct >= 0.5 ? 'medium' : 'critical';
  const colorVar =
    tone === 'success' ? 'var(--vos-success)'
    : tone === 'medium' ? 'var(--vos-warning)'
    : 'var(--vos-danger)';

  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative inline-flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={cx}
          cy={cx}
          r={r}
          stroke="var(--vos-bg-elev-3)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={colorVar}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          style={animated ? { transition: 'stroke-dashoffset 600ms var(--vos-ease-out)' } : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-[2px]">
        <span className="text-vos-xl font-semibold tabular-nums tracking-vos-tight text-vos-text leading-none">
          {Math.round(effectiveScore)}
        </span>
        {label && <span className="text-[10px] text-vos-text-3 mt-0.5">{label}</span>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════ *
 *  DenseTable — V21 Enhanced. Compact, scannable data grid
 * ════════════════════════════════════════════════════════════════════ */

export function DenseTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto rounded-vos-lg border border-vos-border-1', className)}>
      <table className="w-full text-vos-sm">
        {children}
      </table>
    </div>
  );
}

export function DenseTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="text-vos-text-3 text-[10px] uppercase tracking-vos-wide font-semibold bg-vos-bg-elev-1/40 border-b border-vos-border-1">
        {children}
      </tr>
    </thead>
  );
}

export function DenseTH({
  children,
  className,
  align,
}: {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={cn('px-vos-4 py-vos-2 font-semibold whitespace-nowrap', alignClass, className)}>
      {children}
    </th>
  );
}

export function DenseTR({
  children,
  onClick,
  highlighted,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  highlighted?: boolean;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-t border-vos-border-1 transition-all duration-150',
        onClick && 'cursor-pointer hover:bg-vos-bg-elev-3/60',
        highlighted && 'bg-vos-accent/5',
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function DenseTD({
  children,
  className,
  onClick,
  colSpan,
  align,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  colSpan?: number;
  align?: 'left' | 'right' | 'center';
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';
  return (
    <td
      onClick={onClick}
      colSpan={colSpan}
      className={cn('px-vos-4 py-vos-2.5 text-vos-text-2 align-middle', alignClass, className)}
    >
      {children}
    </td>
  );
}

/* ════════════════════════════════════════════════════════════════════ *
 *  Section — V21 Enhanced. Reusable card section with header
 * ════════════════════════════════════════════════════════════════════ */

export function Section({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  animated = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  animated?: boolean;
}) {
  return (
    <section
      className={cn(
        'rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 overflow-hidden',
        animated && 'vos-rise-in',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-vos-4 px-vos-6 py-vos-5 border-b border-vos-border-1">
        <div className="min-w-0">
          <h2 className="text-vos-md font-semibold text-vos-text tracking-vos-snug">{title}</h2>
          {description && (
            <p className="text-vos-xs text-vos-text-3 mt-0.5">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn('p-vos-6', bodyClassName)}>{children}</div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════ *
 *  KeyValueGrid — V21 Enhanced. 2-col label/value grid
 * ════════════════════════════════════════════════════════════════════ */

export function KeyValueGrid({
  items,
  cols = 2,
  className,
}: {
  items: Array<{ label: ReactNode; value: ReactNode; mono?: boolean }>;
  cols?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const colsClass =
    cols === 4 ? 'sm:grid-cols-4'
    : cols === 3 ? 'sm:grid-cols-3'
    : cols === 2 ? 'sm:grid-cols-2'
    : 'grid-cols-1';
  return (
    <dl className={cn('grid grid-cols-1 gap-x-vos-6 gap-y-vos-4', colsClass, className)}>
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-1 min-w-0">
          <dt className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3">
            {it.label}
          </dt>
          <dd className={cn('text-vos-sm text-vos-text break-words', it.mono && 'font-mono')}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
