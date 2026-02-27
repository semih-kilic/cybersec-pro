/**
 * 🐉 CyberSec Pro — Badge Component
 * For status indicators, severity labels, plan tags, and counts
 */
import type { ReactNode } from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'outline';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-700/60 text-gray-300 border-gray-600/50',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  danger: 'bg-red-500/15 text-red-400 border-red-500/30',
  info: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  outline: 'bg-transparent text-gray-400 border-gray-600',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-gray-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-red-400',
  info: 'bg-cyan-400',
  purple: 'bg-purple-400',
  outline: 'bg-gray-400',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px] leading-tight',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
};

export function Badge({ variant = 'default', size = 'md', dot, pulse, icon, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 font-medium rounded-full border
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColors[variant]}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColors[variant]}`} />
        </span>
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

// Convenience components for common patterns
export function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { variant: BadgeVariant; label: string; dot: boolean; pulse: boolean }> = {
    running: { variant: 'info', label: 'Running', dot: true, pulse: true },
    completed: { variant: 'success', label: 'Completed', dot: true, pulse: false },
    failed: { variant: 'danger', label: 'Failed', dot: true, pulse: false },
    pending: { variant: 'warning', label: 'Pending', dot: true, pulse: false },
    queued: { variant: 'default', label: 'Queued', dot: true, pulse: false },
    timeout: { variant: 'warning', label: 'Timeout', dot: true, pulse: false },
    cancelled: { variant: 'default', label: 'Cancelled', dot: true, pulse: false },
    online: { variant: 'success', label: 'Online', dot: true, pulse: true },
    offline: { variant: 'danger', label: 'Offline', dot: true, pulse: false },
    busy: { variant: 'warning', label: 'Busy', dot: true, pulse: true },
  };
  const config = statusMap[status?.toLowerCase()] || { variant: 'default' as BadgeVariant, label: status, dot: false, pulse: false };
  return <Badge variant={config.variant} dot={config.dot} pulse={config.pulse}>{config.label}</Badge>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const severityMap: Record<string, BadgeVariant> = {
    critical: 'danger',
    high: 'warning',
    medium: 'warning',
    low: 'info',
    info: 'default',
  };
  return <Badge variant={severityMap[severity?.toLowerCase()] || 'default'} size="sm">{severity}</Badge>;
}

export function PlanBadge({ plan }: { plan: string }) {
  const planMap: Record<string, BadgeVariant> = {
    free: 'default',
    trial: 'info',
    starter: 'success',
    professional: 'purple',
    enterprise: 'warning',
  };
  return <Badge variant={planMap[plan?.toLowerCase()] || 'default'} size="sm">{plan}</Badge>;
}

export default Badge;
