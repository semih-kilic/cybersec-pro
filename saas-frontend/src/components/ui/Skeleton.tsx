/**
 * Skeleton Loading Components
 * Facebook/LinkedIn-style shimmer effects for loading states
 */

import { memo } from 'react';

// Base shimmer animation - uses CSS keyframe
const shimmerClass = 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent';

// Base skeleton block
interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Skeleton = memo(function Skeleton({ className = '', width, height, rounded = 'md' }: SkeletonProps) {
  const roundedClass = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  }[rounded];

  return (
    <div
      className={`bg-gray-800/80 ${roundedClass} ${shimmerClass} ${className}`}
      style={{ width, height }}
    />
  );
});

// Stat Card Skeleton (used in OverviewPage)
export const StatCardSkeleton = memo(function StatCardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-10" rounded="lg" />
      </div>
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
});

// Tool Card Skeleton (grid view)
export const ToolCardSkeleton = memo(function ToolCardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-10 w-10" rounded="lg" />
        <Skeleton className="h-5 w-14" rounded="md" />
      </div>
      <Skeleton className="h-5 w-3/4 mb-2" />
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-2/3 mb-4" />
      <Skeleton className="h-9 w-full" rounded="lg" />
    </div>
  );
});

// Tool Row Skeleton (list view)
export const ToolRowSkeleton = memo(function ToolRowSkeleton() {
  return (
    <tr className="border-b border-gray-800/50">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" rounded="lg" />
          <div>
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
      <td className="px-5 py-4"><Skeleton className="h-5 w-14" rounded="md" /></td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
      <td className="px-5 py-4"><Skeleton className="h-7 w-14" rounded="md" /></td>
    </tr>
  );
});

// Scan Row Skeleton
export const ScanRowSkeleton = memo(function ScanRowSkeleton() {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center gap-4">
      <Skeleton className="h-10 w-10" rounded="full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-40 mb-2" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-20" rounded="full" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
});

// Agent Card Skeleton
export const AgentCardSkeleton = memo(function AgentCardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="h-12 w-12" rounded="full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-6 w-16" rounded="full" />
      </div>
      <div className="space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-2 w-full" rounded="full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-2 w-full" rounded="full" />
      </div>
    </div>
  );
});

// Dashboard Overview Skeleton (full page)
export const OverviewSkeleton = memo(function OverviewSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" rounded="lg" />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-48 w-full" rounded="lg" />
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <Skeleton className="h-5 w-36 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <ScanRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

// Tools Page Skeleton
export const ToolsPageSkeleton = memo(function ToolsPageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex gap-3 mb-4">
          <Skeleton className="h-10 flex-1" rounded="lg" />
          <Skeleton className="h-10 w-28" rounded="lg" />
          <Skeleton className="h-10 w-28" rounded="lg" />
          <Skeleton className="h-10 w-36" rounded="lg" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-32" rounded="full" />
          ))}
        </div>
      </div>

      {/* Tool Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <ToolCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
});

// Scans Page Skeleton
export const ScansPageSkeleton = memo(function ScansPageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-36" rounded="lg" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ScanRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
});

// Agents Page Skeleton
export const AgentsPageSkeleton = memo(function AgentsPageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-36 mb-2" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-10 w-32" rounded="lg" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <AgentCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
});
