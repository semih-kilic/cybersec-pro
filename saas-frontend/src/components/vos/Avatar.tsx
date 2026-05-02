import { useMemo } from 'react';
import { cn } from '../../lib/cn';

/**
 * Avatar — gradient-tinted initials avatar with optional image src.
 * Initials are derived from `name`. Color is hashed deterministically.
 */
export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const initials = useMemo(() => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  }, [name]);

  const hue = useMemo(() => {
    if (!name) return 220;
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  }, [name]);

  const px = { xs: 24, sm: 32, md: 40, lg: 56 }[size];
  const fontPx = { xs: 10, sm: 12, md: 14, lg: 20 }[size];

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full overflow-hidden border border-vos-border-2 shrink-0 select-none',
        className,
      )}
      style={{
        width: px,
        height: px,
        fontSize: fontPx,
        background: src
          ? undefined
          : `linear-gradient(135deg, hsl(${hue} 70% 60% / 0.9), hsl(${(hue + 40) % 360} 70% 45% / 0.9))`,
        boxShadow: 'var(--vos-highlight)',
      }}
      aria-label={name ?? 'Avatar'}
    >
      {src ? (
        <img src={src} alt={name ?? ''} className="size-full object-cover" />
      ) : (
        <span className="font-semibold text-white/95 tracking-tight">{initials}</span>
      )}
    </span>
  );
}
