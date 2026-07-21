import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

/**
 * Button — V21 Enhanced. Pill-shaped, glass-aware, with tactile press animation.
 *
 *   variant:  primary | secondary | ghost | danger | outline | soft | link
 *   size:     sm | md (default) | lg | icon
 *   loading:  spinner overlay, disables clicks
 *   leftIcon / rightIcon: optional ReactNodes (e.g. lucide icons)
 *   elevated: adds subtle shadow lift on hover
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'soft' | 'link';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  elevated?: boolean;
}

const variantClass: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:   'vos-btn vos-btn-primary',
  secondary: 'vos-btn',
  ghost:     'vos-btn vos-btn-ghost',
  danger:    'vos-btn vos-btn-danger',
  outline:   'vos-btn vos-btn-outline',
  soft:      'vos-btn vos-btn-soft',
  link:      'vos-btn vos-btn-link',
};

const sizeClass: Record<NonNullable<ButtonProps['size']>, string> = {
  sm:   'vos-btn-sm',
  md:   '',
  lg:   'vos-btn-lg',
  icon: 'vos-btn-icon',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading,
    leftIcon,
    rightIcon,
    fullWidth,
    elevated,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        variantClass[variant],
        sizeClass[size],
        fullWidth && 'w-full',
        loading && 'vos-btn-loading',
        elevated && 'vos-lift',
        className,
      )}
      {...rest}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size={size === 'lg' ? 'md' : 'sm'} />
        </span>
      )}
      <span className={cn('inline-flex items-center gap-vos-2', loading && 'invisible')}>
        {leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </span>
    </button>
  );
});
