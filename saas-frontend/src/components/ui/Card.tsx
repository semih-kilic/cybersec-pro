/**
 * 🛡️ CyberSec Pro — Card / CardHeader / StatCard
 *
 * V20 "Onyx" Apple-grade rewrite. The public API surface is preserved
 * (`<Card variant>`, `<CardHeader title icon action>`, `<StatCard
 * title value change icon variant sparkline>`) so the entire existing
 * codebase keeps working with zero edits.
 *
 * Visually we now use Vision OS tokens (`--vos-*`) so cards instantly
 * switch with light/dark theme and inherit the Apple silver / black
 * palette.
 */
import type { ReactNode, HTMLAttributes } from 'react';
import { motion } from 'framer-motion';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'glass' | 'interactive';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  change?: { value: number; label?: string };
  icon?: ReactNode;
  variant?: 'default' | 'cyan' | 'green' | 'red' | 'purple' | 'amber';
  sparkline?: number[];
  className?: string;
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-vos-bg-elev-2 border border-vos-border-1',
  elevated: 'bg-vos-bg-elev-2 border border-vos-border-1 shadow-vos-2',
  outlined: 'bg-transparent border border-vos-border-1 hover:border-vos-border-2',
  glass: 'bg-vos-bg-elev-2/70 backdrop-blur-xl border border-vos-border-1',
  interactive:
    'bg-vos-bg-elev-2 border border-vos-border-1 hover:border-vos-border-2 cursor-pointer transition-all duration-vos-2 hover:shadow-vos-2 active:scale-[0.995]',
};

const paddingClasses = {
  none: '',
  sm: 'p-vos-3',
  md: 'p-vos-5',
  lg: 'p-vos-6',
};

export function Card({
  variant = 'default',
  padding = 'md',
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-vos-xl ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-vos-4 ${className}`.trim()}>
      <div className="flex items-center gap-vos-3 min-w-0">
        {icon && (
          <span className="size-8 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 flex items-center justify-center text-vos-text-2 shrink-0">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-vos-md font-semibold text-vos-text tracking-vos-snug truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-vos-xs text-vos-text-3 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className="opacity-70">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const accentColors: Record<
  string,
  { text: string; bg: string; ring: string; sparkline: string }
> = {
  default: {
    text: 'text-vos-text',
    bg: 'bg-vos-bg-elev-3',
    ring: 'ring-vos-border-1',
    sparkline: 'var(--vos-text-3)',
  },
  cyan: {
    text: 'text-vos-text',
    bg: 'bg-vos-accent/10',
    ring: 'ring-vos-accent/20',
    sparkline: 'var(--vos-accent)',
  },
  green: {
    text: 'text-vos-text',
    bg: 'bg-vos-success/10',
    ring: 'ring-vos-success/20',
    sparkline: 'var(--vos-success)',
  },
  red: {
    text: 'text-vos-text',
    bg: 'bg-vos-danger/10',
    ring: 'ring-vos-danger/20',
    sparkline: 'var(--vos-danger)',
  },
  purple: {
    text: 'text-vos-text',
    bg: 'bg-vos-info/10',
    ring: 'ring-vos-info/20',
    sparkline: 'var(--vos-info)',
  },
  amber: {
    text: 'text-vos-text',
    bg: 'bg-vos-warning/10',
    ring: 'ring-vos-warning/20',
    sparkline: 'var(--vos-warning)',
  },
};

export function StatCard({
  title,
  value,
  change,
  icon,
  variant = 'default',
  sparkline,
  className = '',
}: StatCardProps) {
  const accent = accentColors[variant];
  const positive = (change?.value ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={`bg-vos-bg-elev-2 border border-vos-border-1 rounded-vos-xl p-vos-5 hover:border-vos-border-2 transition-colors duration-vos-2 ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-vos-4">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-vos-text-3 uppercase tracking-vos-wide truncate">
            {title}
          </p>
          <p
            className={`text-vos-3xl font-semibold tracking-vos-tight tabular-nums mt-vos-2 ${accent.text}`}
          >
            {value}
          </p>
          {change && (
            <div className="flex items-center gap-1 mt-vos-2">
              <span
                className={`text-vos-xs font-semibold ${positive ? 'text-vos-success' : 'text-vos-danger'}`}
              >
                {positive ? '↑' : '↓'} {positive ? '+' : ''}
                {change.value}%
              </span>
              {change.label && (
                <span className="text-vos-xs text-vos-text-3">{change.label}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-vos-2 shrink-0">
          {icon && (
            <div
              className={`p-2 rounded-vos-md ${accent.bg} ring-1 ${accent.ring} text-vos-text-2`}
            >
              {icon}
            </div>
          )}
          {sparkline && <Sparkline data={sparkline} color={accent.sparkline} />}
        </div>
      </div>
    </motion.div>
  );
}

export default Card;
