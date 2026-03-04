/**
 * SparklineKPI — V18 Phase 3
 * Premium KPI card with inline sparkline SVG chart.
 * Shows value, trend direction, percentage change, and a mini chart.
 * No external chart library — pure SVG for minimal bundle impact.
 */
import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

interface SparklineKPIProps {
  title: string;
  value: string | number;
  change?: number;        // percentage change (e.g. +12.5 or -3.2)
  changeLabel?: string;   // e.g. "vs last week"
  data?: number[];        // sparkline data points (7-30 points)
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  prefix?: string;        // e.g. "$" or "#"
  suffix?: string;        // e.g. "%" or "ms"
  className?: string;
  loading?: boolean;
}

const variantColors = {
  default: { line: '#06b6d4', fill: '#06b6d4', bg: 'from-cyan-500/5 to-transparent' },
  success: { line: '#10b981', fill: '#10b981', bg: 'from-emerald-500/5 to-transparent' },
  warning: { line: '#f59e0b', fill: '#f59e0b', bg: 'from-amber-500/5 to-transparent' },
  danger: { line: '#ef4444', fill: '#ef4444', bg: 'from-red-500/5 to-transparent' },
};

function generateSparklinePath(data: number[], width: number, height: number, fill = false): string {
  if (data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const padding = 2;

  const points = data.map((v, i) => ({
    x: i * step,
    y: padding + (1 - (v - min) / range) * (height - padding * 2),
  }));

  // Smooth curve using quadratic bezier
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    path += ` Q ${cpx} ${prev.y} ${curr.x} ${curr.y}`;
  }

  if (fill) {
    const last = points[points.length - 1];
    path += ` L ${last.x} ${height} L ${points[0].x} ${height} Z`;
  }

  return path;
}

export const SparklineKPI = memo(function SparklineKPI({
  title,
  value,
  change,
  changeLabel = 'vs last period',
  data = [],
  icon,
  variant = 'default',
  prefix = '',
  suffix = '',
  className = '',
  loading = false,
}: SparklineKPIProps) {
  const colors = variantColors[variant];
  const sparkWidth = 120;
  const sparkHeight = 36;

  const linePath = useMemo(
    () => generateSparklinePath(data, sparkWidth, sparkHeight),
    [data]
  );
  const fillPath = useMemo(
    () => generateSparklinePath(data, sparkWidth, sparkHeight, true),
    [data]
  );

  const isPositive = (change ?? 0) >= 0;

  if (loading) {
    return (
      <div className={`bg-gray-900/60 rounded-xl border border-gray-800/50 p-4 animate-pulse ${className}`}>
        <div className="h-3 w-20 bg-gray-800 rounded mb-3" />
        <div className="h-7 w-16 bg-gray-800 rounded mb-2" />
        <div className="h-8 w-full bg-gray-800/50 rounded" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-b ${colors.bg} bg-gray-900/60 rounded-xl border border-gray-800/50 p-4 hover:border-gray-700/60 transition-all duration-300 group ${className}`}
    >
      {/* Header: Title + Icon */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</span>
        {icon && (
          <div className="w-7 h-7 rounded-lg bg-gray-800/60 flex items-center justify-center text-sm group-hover:scale-110 transition-transform">
            {icon}
          </div>
        )}
      </div>

      {/* Value + Change */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <span className="text-2xl font-bold text-white tabular-nums">
            {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
          </span>
          {change !== undefined && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                isPositive ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {/* Arrow */}
                <svg className={`w-3 h-3 ${isPositive ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                </svg>
                {Math.abs(change).toFixed(1)}%
              </span>
              <span className="text-[10px] text-gray-600">{changeLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* Sparkline Chart */}
      {data.length >= 2 && (
        <svg
          width="100%"
          height={sparkHeight}
          viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          {/* Fill area */}
          <motion.path
            d={fillPath}
            fill={colors.fill}
            fillOpacity={0.08}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          />
          {/* Line */}
          <motion.path
            d={linePath}
            fill="none"
            stroke={colors.line}
            strokeWidth={1.5}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          {/* End dot */}
          {data.length > 0 && (() => {
            const min = Math.min(...data);
            const max = Math.max(...data);
            const range = max - min || 1;
            const lastVal = data[data.length - 1];
            const x = sparkWidth;
            const y = 2 + (1 - (lastVal - min) / range) * (sparkHeight - 4);
            return (
              <motion.circle
                cx={x}
                cy={y}
                r={2.5}
                fill={colors.line}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1 }}
              />
            );
          })()}
        </svg>
      )}
    </motion.div>
  );
});

export default SparklineKPI;
