import { cn } from '../../lib/cn';

/**
 * Spinner — minimal SVG ring spinner that inherits color via currentColor.
 * Use inside Buttons (already wired) or as a standalone loader.
 */
export function Spinner({
  size = 'md',
  className,
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const px = { xs: 12, sm: 14, md: 18, lg: 24 }[size];
  return (
    <svg
      role="status"
      aria-label="Loading"
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin text-current', className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
