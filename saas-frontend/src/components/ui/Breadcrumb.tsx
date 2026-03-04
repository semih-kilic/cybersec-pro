/**
 * Breadcrumb Navigation — V18 Phase 3
 * Auto-generates breadcrumb trail from react-router location.
 * Supports custom labels, dynamic params, and animated transitions.
 */
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';

// Route segment → Display label mapping
const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  overview: 'Overview',
  tools: 'Tools',
  scans: 'Scans',
  new: 'New Scan',
  targets: 'Targets',
  reports: 'Reports',
  schedule: 'Schedule',
  terminal: 'Terminal',
  settings: 'Settings',
  agents: 'Agents',
  projects: 'Projects',
  upgrade: 'Upgrade',
  billing: 'Billing',
  feedback: 'Feedback',
  analytics: 'Analytics',
  ai: 'AI Assistant',
  'purple-team': 'Purple Team',
  admin: 'Admin',
  run: 'Execute',
};

// Icons for first-level dashboard sections
const SECTION_ICONS: Record<string, string> = {
  overview: '📊',
  tools: '🔧',
  scans: '🔍',
  targets: '🎯',
  reports: '📄',
  schedule: '📅',
  terminal: '💻',
  settings: '⚙️',
  agents: '🤖',
  projects: '📁',
  analytics: '📈',
  ai: '🧠',
  'purple-team': '🛡️',
  admin: '👑',
  upgrade: '⭐',
  billing: '💳',
  feedback: '💬',
};

interface BreadcrumbItem {
  label: string;
  path: string;
  icon?: string;
  isLast: boolean;
}

function useBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();
  const params = useParams();

  // Split path and remove empty segments
  const segments = location.pathname.split('/').filter(Boolean);

  // Only show breadcrumbs inside /dashboard
  if (segments[0] !== 'dashboard') return [];

  const crumbs: BreadcrumbItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: '🏠', isLast: false },
  ];

  // Build remaining crumbs from segments after 'dashboard'
  const remaining = segments.slice(1);

  remaining.forEach((segment, index) => {
    const fullPath = '/' + segments.slice(0, index + 2).join('/');
    const isLast = index === remaining.length - 1;

    // Check if this segment is a dynamic param (UUID or numeric ID)
    const isDynamicParam = /^[0-9a-f-]{8,}$/i.test(segment) || /^\d+$/.test(segment);

    if (isDynamicParam) {
      // Try to get a meaningful label from params or show truncated ID
      const paramValues = Object.values(params);
      const matchedParam = paramValues.find(v => v === segment);
      const label = matchedParam
        ? `#${segment.substring(0, 8)}…`
        : `#${segment.substring(0, 8)}…`;
      crumbs.push({ label, path: fullPath, isLast });
    } else {
      const label = ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
      const icon = index === 0 ? SECTION_ICONS[segment] : undefined;
      crumbs.push({ label, path: fullPath, icon, isLast });
    }
  });

  // If we only have 'Dashboard' (index route), mark it as last
  if (crumbs.length === 1) {
    crumbs[0].isLast = true;
  }

  return crumbs;
}

// Chevron separator
function ChevronSeparator() {
  return (
    <svg
      className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 mx-1"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

export function Breadcrumb() {
  const crumbs = useBreadcrumbs();

  // Don't render if only one crumb (overview/index) or no crumbs
  if (crumbs.length <= 1) return null;

  return (
    <motion.nav
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      aria-label="Breadcrumb"
      className="mb-4"
    >
      <ol className="flex items-center flex-wrap gap-0.5 text-sm" role="list">
        {crumbs.map((crumb, index) => (
          <li key={crumb.path} className="flex items-center">
            {index > 0 && <ChevronSeparator />}
            {crumb.isLast ? (
              <span
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-gray-300 font-medium bg-gray-800/50"
                aria-current="page"
              >
                {crumb.icon && <span className="text-xs">{crumb.icon}</span>}
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800/30 transition-colors duration-150"
              >
                {crumb.icon && <span className="text-xs">{crumb.icon}</span>}
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </motion.nav>
  );
}

export default Breadcrumb;
