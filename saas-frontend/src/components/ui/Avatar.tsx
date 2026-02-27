/**
 * 🐉 CyberSec Pro — Avatar Component
 * User avatar with fallback initials, online status, and sizes
 */

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

const statusColors = {
  online: 'bg-emerald-400',
  offline: 'bg-gray-500',
  busy: 'bg-red-400',
  away: 'bg-amber-400',
};

const statusSizeClasses = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const gradients = [
  'from-cyan-500 to-blue-600',
  'from-purple-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-red-500 to-rose-600',
  'from-indigo-500 to-violet-600',
];

function getGradient(name?: string): string {
  if (!name) return gradients[0];
  const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
  return gradients[hash % gradients.length];
}

export function Avatar({ src, name, size = 'md', status, className = '' }: AvatarProps) {
  return (
    <div className={`relative inline-flex ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name || 'User avatar'}
          className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-gray-800`}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${getGradient(name)} flex items-center justify-center font-semibold text-white ring-2 ring-gray-800 ${src ? 'hidden' : ''}`}>
        {getInitials(name)}
      </div>
      {status && (
        <span className={`absolute bottom-0 right-0 ${statusSizeClasses[size]} ${statusColors[status]} rounded-full ring-2 ring-gray-900`} />
      )}
    </div>
  );
}

export default Avatar;
