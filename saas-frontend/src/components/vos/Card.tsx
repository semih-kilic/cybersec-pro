import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Card — frosted glass surface, the workhorse container.
 *
 * Variants:
 *   - elevation: 1..4   (depth tier; 2 = default resting card)
 *   - interactive       (adds hover lift + subtle border highlight)
 *   - sheen             (animated highlight sweep on hover)
 *   - tilt              (subtle 3D tilt on hover — use sparingly)
 *
 * Composition: pair with <CardHeader/> + <CardContent/> + <CardFooter/>
 * for consistent inner padding, or roll your own children.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: 1 | 2 | 3 | 4;
  interactive?: boolean;
  sheen?: boolean;
  tilt?: boolean;
  padded?: boolean;
}

const elevationClass: Record<NonNullable<CardProps['elevation']>, string> = {
  1: 'vos-glass-1',
  2: 'vos-glass-2',
  3: 'vos-glass-3',
  4: 'vos-glass-4',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { elevation = 2, interactive, sheen, tilt, padded, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        elevationClass[elevation],
        interactive && 'vos-lift cursor-pointer',
        sheen && 'vos-sheen',
        tilt && 'vos-tilt',
        padded && 'p-vos-6',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

export function CardHeader({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-vos-1 p-vos-6 pb-vos-3', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('vos-h4', className)} {...rest}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-vos-sm text-vos-text-3', className)} {...rest}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <div className={cn('p-vos-6 pt-vos-3', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-vos-3 p-vos-6 pt-vos-4 border-t border-vos-border-1',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
