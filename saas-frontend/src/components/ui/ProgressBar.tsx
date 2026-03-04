/**
 * ProgressBar + StepIndicator — V18 Phase 3
 * Premium progress visualization components.
 * 
 * ProgressBar: Animated gradient bar with percentage label
 * StepIndicator: Multi-step wizard with connecting lines, checkmarks, and states
 * CircularProgress: Ring-based progress indicator
 */
import { memo } from 'react';
import { motion } from 'framer-motion';

// ==========================================
// ProgressBar
// ==========================================

interface ProgressBarProps {
  value: number;         // 0-100
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'gradient';
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  striped?: boolean;
  className?: string;
}

const sizeMap = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

const colorMap = {
  default: 'bg-cyan-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  gradient: 'bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500',
};

export const ProgressBar = memo(function ProgressBar({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showLabel = false,
  label,
  animated = true,
  striped = false,
  className = '',
}: ProgressBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={`w-full ${className}`}>
      {/* Label row */}
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs font-medium text-gray-400">{label}</span>}
          {showLabel && (
            <span className="text-xs font-semibold text-gray-300 tabular-nums">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      {/* Track */}
      <div
        className={`w-full ${sizeMap[size]} rounded-full bg-gray-800 overflow-hidden`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          initial={animated ? { width: 0 } : false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${colorMap[variant]} ${
            striped ? 'bg-[length:20px_20px] bg-[linear-gradient(45deg,rgba(255,255,255,.1)25%,transparent_25%,transparent_50%,rgba(255,255,255,.1)50%,rgba(255,255,255,.1)75%,transparent_75%)]' : ''
          } ${animated && striped ? 'animate-[progress-stripe_1s_linear_infinite]' : ''}`}
        />
      </div>
    </div>
  );
});

// ==========================================
// StepIndicator
// ==========================================

export interface Step {
  id: string | number;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;  // 0-based index
  variant?: 'default' | 'compact';
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  onStepClick?: (stepIndex: number) => void;
}

export const StepIndicator = memo(function StepIndicator({
  steps,
  currentStep,
  variant = 'default',
  orientation = 'horizontal',
  className = '',
  onStepClick,
}: StepIndicatorProps) {
  const isVertical = orientation === 'vertical';
  const isCompact = variant === 'compact';

  return (
    <div
      className={`${isVertical ? 'flex flex-col gap-0' : 'flex items-start gap-0'} ${className}`}
      role="list"
      aria-label="Progress steps"
    >
      {steps.map((step, idx) => {
        const status: 'completed' | 'current' | 'upcoming' =
          idx < currentStep ? 'completed' : idx === currentStep ? 'current' : 'upcoming';

        return (
          <div
            key={step.id}
            className={`flex ${isVertical ? 'flex-row gap-3' : 'flex-col items-center'} ${
              !isVertical && idx < steps.length - 1 ? 'flex-1' : ''
            }`}
            role="listitem"
            aria-current={status === 'current' ? 'step' : undefined}
          >
            {/* Step circle + connector */}
            <div className={`flex ${isVertical ? 'flex-col items-center' : 'items-center w-full'}`}>
              {/* Circle */}
              <motion.button
                onClick={onStepClick ? () => onStepClick(idx) : undefined}
                disabled={!onStepClick}
                className={`relative flex items-center justify-center flex-shrink-0 rounded-full border-2 transition-all duration-300 ${
                  isCompact ? 'w-7 h-7' : 'w-9 h-9'
                } ${
                  status === 'completed'
                    ? 'bg-cyan-500 border-cyan-500 text-white'
                    : status === 'current'
                    ? 'bg-cyan-500/10 border-cyan-400 text-cyan-400'
                    : 'bg-gray-800 border-gray-700 text-gray-500'
                } ${onStepClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                whileTap={onStepClick ? { scale: 0.95 } : undefined}
              >
                {status === 'completed' ? (
                  <motion.svg
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`${isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </motion.svg>
                ) : step.icon ? (
                  <span className={isCompact ? 'text-xs' : 'text-sm'}>{step.icon}</span>
                ) : (
                  <span className={`font-semibold ${isCompact ? 'text-xs' : 'text-sm'}`}>{idx + 1}</span>
                )}
                {/* Pulse ring for current step */}
                {status === 'current' && (
                  <span className="absolute inset-0 rounded-full border-2 border-cyan-400/30 animate-ping" />
                )}
              </motion.button>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={`${
                    isVertical
                      ? `w-0.5 ${isCompact ? 'h-6' : 'h-10'} mx-auto`
                      : `flex-1 ${isCompact ? 'h-0.5' : 'h-0.5'} mx-2`
                  } rounded-full overflow-hidden bg-gray-700/50`}
                >
                  <motion.div
                    initial={{ [isVertical ? 'height' : 'width']: '0%' }}
                    animate={{
                      [isVertical ? 'height' : 'width']:
                        idx < currentStep ? '100%' : '0%',
                    }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: idx * 0.1 }}
                    className="bg-cyan-500 h-full w-full rounded-full"
                  />
                </div>
              )}
            </div>

            {/* Label + Description */}
            {!isCompact && (
              <div className={`${isVertical ? 'pt-0 pb-2' : 'mt-2 text-center'} ${!isVertical && idx < steps.length - 1 ? 'w-full' : ''}`}>
                <p className={`text-xs font-medium transition-colors ${
                  status === 'completed' ? 'text-cyan-400' :
                  status === 'current' ? 'text-white' :
                  'text-gray-500'
                }`}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-1">{step.description}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// ==========================================
// CircularProgress
// ==========================================

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'gradient';
  showValue?: boolean;
  label?: string;
  className?: string;
}

const circleColors = {
  default: 'stroke-cyan-500',
  success: 'stroke-emerald-500',
  warning: 'stroke-amber-500',
  danger: 'stroke-red-500',
  gradient: 'stroke-cyan-500', // SVG gradient applied separately
};

export const CircularProgress = memo(function CircularProgress({
  value,
  max = 100,
  size = 80,
  strokeWidth = 6,
  variant = 'default',
  showValue = true,
  label,
  className = '',
}: CircularProgressProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Gradient def */}
          {variant === 'gradient' && (
            <defs>
              <linearGradient id="circularGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          )}
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-gray-800"
          />
          {/* Progress arc */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={variant === 'gradient' ? '' : circleColors[variant]}
            stroke={variant === 'gradient' ? 'url(#circularGradient)' : undefined}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        {/* Center label */}
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-white tabular-nums">{Math.round(pct)}%</span>
          </div>
        )}
      </div>
      {label && <span className="text-xs text-gray-400 font-medium">{label}</span>}
    </div>
  );
});

export default ProgressBar;
