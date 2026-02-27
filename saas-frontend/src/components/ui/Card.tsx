/**
 * 🐉 CyberSec Pro — Card Component
 * Consistent card container with variants, hover states, and optional header/footer
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
  default: 'bg-gray-800/50 border border-gray-700/50',
  elevated: 'bg-gray-800/70 border border-gray-700/50 shadow-xl shadow-black/20',
  outlined: 'bg-transparent border border-gray-700 hover:border-gray-600',
  glass: 'bg-gray-800/30 backdrop-blur-xl border border-gray-700/30 shadow-lg shadow-black/10',
  interactive: 'bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800/70 hover:border-gray-600 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/5 active:scale-[0.99]',
};

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({ variant = 'default', padding = 'md', children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div className="flex items-center gap-3">
        {icon && <div className="text-cyan-400">{icon}</div>}
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Mini sparkline SVG for stat cards
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="opacity-60">
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

const accentColors: Record<string, { text: string; bg: string; ring: string; sparkline: string }> = {
  default: { text: 'text-white', bg: 'bg-gray-700/40', ring: 'ring-gray-600/30', sparkline: '#9ca3af' },
  cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', ring: 'ring-cyan-500/20', sparkline: '#22d3ee' },
  green: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', sparkline: '#34d399' },
  red: { text: 'text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/20', sparkline: '#f87171' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', ring: 'ring-purple-500/20', sparkline: '#c084fc' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20', sparkline: '#fbbf24' },
};

export function StatCard({ title, value, change, icon, variant = 'default', sparkline, className = '' }: StatCardProps) {
  const accent = accentColors[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        bg-gray-800/50 border border-gray-700/50 rounded-xl p-5
        hover:bg-gray-800/70 transition-all duration-200
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-400 truncate">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${accent.text}`}>{value}</p>
          {change && (
            <div className="flex items-center gap-1 mt-1.5">
              <span className={`text-xs font-medium ${change.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {change.value >= 0 ? '↗' : '↘'} {change.value >= 0 ? '+' : ''}{change.value}%
              </span>
              {change.label && <span className="text-xs text-gray-500">{change.label}</span>}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {icon && (
            <div className={`p-2 rounded-lg ${accent.bg} ring-1 ${accent.ring}`}>
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
