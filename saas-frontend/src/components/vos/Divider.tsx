import { cn } from '../../lib/cn';

export function Divider({
  orientation = 'horizontal',
  className,
}: {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}) {
  if (orientation === 'vertical') {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        className={cn('inline-block w-px self-stretch bg-vos-border-2', className)}
      />
    );
  }
  return <hr role="separator" className={cn('vos-divider my-vos-4', className)} />;
}
