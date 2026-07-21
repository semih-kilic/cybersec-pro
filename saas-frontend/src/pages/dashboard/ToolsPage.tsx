/**
 * Tools — Security Arsenal
 *
 * V21 "Onyx" polish. Apple-grade restraint: monochrome surfaces,
 * Apple system-blue accent, dense data presentation, severity-driven
 * status colors. V21 refinements: tighter card grid, improved hover
 * micro-interactions, cleaner search bar, better badge layout.
 */
import { useState, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  X,
  LayoutGrid,
  List,
  CheckCircle2,
  Crown,
  Sparkles,
  Globe,
  Lock,
  Wifi,
  Cpu,
  Network,
  ShieldCheck,
  Skull,
  Key,
  Bug,
  FileCode2,
  TerminalSquare,
  Microscope,
  Database,
  Phone,
  Wrench,
  Eye,
  KeyRound,
  Shield,
  AlertTriangle,
  Monitor,
  Zap,
  ArrowRight,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useTools } from '../../hooks/useApiQueries';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ToolsPageSkeleton } from '../../components/ui/Skeleton';
import { PageTransition } from '../../components/ui';
import {
  PageHeader,
  StatusPill,
  FilterChip,
} from '../../components/vos';

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  plan_required: string;
  installed: boolean;
  dangerous?: boolean;
  requires_root?: boolean;
  gui_only?: boolean;
  gui_required?: boolean;
  group?: string;
  binary_name?: string;
  tool_type?: string;
  business_category?: string;
  maturity?: 'verified' | 'beta' | 'experimental';
  output_parser?: string | null;
  health_status?: 'healthy' | 'needs_interactive' | 'crashed' | 'missing' | 'skipped' | 'unknown';
  health_probe?: string | null;
  last_health_check?: string | null;
}

const categoryIcon: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  web: Globe,
  forensics: Microscope,
  recon: Eye,
  password: KeyRound,
  vulnerability: Lock,
  wireless: Wifi,
  hardware: Cpu,
  network: Network,
  windows: Monitor,
  reversing: FileCode2,
  defense: ShieldCheck,
  'post-exploit': Skull,
  crypto: Key,
  reporting: FileCode2,
  exploitation: Bug,
  social: Eye,
  voip: Phone,
  database: Database,
  misc: Wrench,
};

const categoryDisplayNames: Record<string, string> = {
  web: 'Web Application Security',
  forensics: 'Digital Forensics',
  recon: 'Reconnaissance & OSINT',
  password: 'Password & GPU',
  vulnerability: 'Vulnerability Analysis',
  wireless: 'Wireless Security',
  hardware: 'Hardware Attacks',
  network: 'Network & Sniffing',
  windows: 'Windows Resources',
  reversing: 'Reverse Engineering',
  defense: 'Defense & Detection',
  'post-exploit': 'Post-Exploitation',
  crypto: 'Cryptography & Steganography',
  reporting: 'Reporting',
  exploitation: 'Exploitation',
  social: 'Social Engineering',
  voip: 'VoIP Security',
  database: 'Database Security',
  misc: 'Miscellaneous',
};

const planHierarchy: Record<string, number> = {
  free: 0,
  trial: 10,
  starter: 10,
  professional: 10,
  enterprise: 10,
};

const POPULAR_QUICK_TOOLS = [
  { id: 'nmap', name: 'Nmap', icon: Network, desc: 'Port Scanner' },
  { id: 'nikto', name: 'Nikto', icon: Globe, desc: 'Web Scanner' },
  { id: 'sqlmap', name: 'SQLMap', icon: Database, desc: 'SQL Injection' },
  { id: 'hydra', name: 'Hydra', icon: KeyRound, desc: 'Brute Force' },
  { id: 'gobuster', name: 'Gobuster', icon: Search, desc: 'Dir Scanner' },
  { id: 'nuclei', name: 'Nuclei', icon: Zap, desc: 'Vuln Scanner' },
  { id: 'wireshark', name: 'Wireshark', icon: Wifi, desc: 'Packet Analyzer' },
];

function CategoryIcon({ name, size = 16 }: { name: string; size?: number | string }) {
  const Icon = categoryIcon[name] || Wrench;
  return <Icon size={size} />;
}

export function ToolsPage() {
  useDocumentTitle('Tools — CyberSec Pro');
  const { organization } = useAuth();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showOnlyInstalled, setShowOnlyInstalled] = useState(false);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [showOnlyVerified, setShowOnlyVerified] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'plan'>('category');

  const userPlan = organization?.plan_type || 'trial';
  const { data: toolsData, isLoading: loading } = useTools(userPlan);
  const allCategories = toolsData?.categories || {};
  const totalTools = toolsData?.totalTools || 0;
  const categoryList = toolsData?.categoryList || [];

  const canUseTool = useCallback(
    (toolPlan: string): boolean => {
      const userLevel = planHierarchy[userPlan.toLowerCase()] || 0;
      const toolLevel = planHierarchy[toolPlan.toLowerCase()] || 0;
      return userLevel >= toolLevel;
    },
    [userPlan],
  );

  const filteredCategories = useMemo(() => {
    const result: { [key: string]: Tool[] } = {};
    Object.entries(allCategories).forEach(([categoryKey, categoryData]) => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(categoryKey)) return;
      const filteredTools = categoryData.tools.filter((tool) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const m =
            tool.name.toLowerCase().includes(q) ||
            tool.description?.toLowerCase().includes(q) ||
            tool.id.toLowerCase().includes(q);
          if (!m) return false;
        }
        if (showOnlyInstalled && !tool.installed) return false;
        if (showOnlyAvailable && !canUseTool(tool.plan_required)) return false;
        if (showOnlyVerified && tool.maturity !== 'verified') return false;
        return true;
      });
      if (sortBy === 'name') filteredTools.sort((a, b) => a.name.localeCompare(b.name));
      else if (sortBy === 'plan')
        filteredTools.sort(
          (a, b) =>
            (planHierarchy[b.plan_required] || 0) - (planHierarchy[a.plan_required] || 0),
        );
      if (filteredTools.length > 0) result[categoryKey] = filteredTools;
    });
    return result;
  }, [
    allCategories,
    searchQuery,
    selectedCategories,
    showOnlyInstalled,
    showOnlyAvailable,
    showOnlyVerified,
    canUseTool,
    sortBy,
  ]);

  const filteredCount = useMemo(
    () => Object.values(filteredCategories).reduce((s, t) => s + t.length, 0),
    [filteredCategories],
  );

  const installedCount = useMemo(
    () =>
      Object.values(allCategories).reduce(
        (s, c) => s + c.tools.filter((t) => t.installed).length,
        0,
      ),
    [allCategories],
  );

  const toggleCategory = (category: string) =>
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setShowOnlyInstalled(false);
    setShowOnlyAvailable(false);
    setShowOnlyVerified(false);
  };

  const hasActiveFilters =
    searchQuery || selectedCategories.length > 0 || showOnlyInstalled || showOnlyAvailable || showOnlyVerified;

  if (loading) {
    return (
      <div className="min-h-screen">
        <ToolsPageSkeleton />
      </div>
    );
  }

  const isEntryPlan = userPlan === 'trial' || userPlan === 'starter';

  return (
    <PageTransition>
      <div className="p-vos-8 max-w-[1440px] mx-auto space-y-vos-6">
        <PageHeader
          eyebrow="Arsenal"
          icon={<ShieldCheck size={22} />}
          title={t('tools.title', 'Security Tools')}
          description={
            <>
              <span className="tabular-nums font-semibold text-vos-text">{totalTools}</span>{' '}
              professional security tools across{' '}
              <span className="tabular-nums">{Object.keys(allCategories).length}</span> categories.
              Plan:{' '}
              <span className="text-vos-accent font-medium capitalize">{userPlan}</span>
              {showOnlyAvailable && (
                <span className="ml-2 text-vos-accent">
                  · showing {filteredCount} in your plan
                </span>
              )}
            </>
          }
          actions={
            isEntryPlan ? (
              <Link
                to="/dashboard/upgrade"
                className="inline-flex items-center gap-2 h-10 px-vos-4 rounded-vos-md bg-vos-accent text-white text-vos-sm font-medium hover:bg-vos-accent-2 transition-colors duration-200"
              >
                <Crown size={14} />
                {t('common.upgradeNow', 'Upgrade')}
              </Link>
            ) : undefined
          }
        />

        {/* Quick access — only for entry plans */}
        {isEntryPlan && !showOnlyAvailable && (
          <section className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 overflow-hidden">
            <div className="flex items-center justify-between p-vos-5 pb-vos-4">
              <div className="flex items-center gap-vos-3">
                <span className="size-9 rounded-vos-md bg-vos-accent/10 border border-vos-accent/20 flex items-center justify-center text-vos-accent">
                  <Sparkles size={16} />
                </span>
                <div>
                  <h3 className="text-vos-md font-semibold text-vos-text">
                    {t('tools.quickAccessTitle', 'Quick Access')}
                  </h3>
                  <p className="text-vos-xs text-vos-text-3">
                    {t('tools.quickAccessDesc', 'Click any tool to start scanning immediately')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOnlyAvailable(true)}
                className="text-vos-xs font-medium text-vos-accent hover:text-vos-accent-2 flex items-center gap-1 transition-colors"
              >
                Show only my tools <ArrowRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-vos-border-1">
              {POPULAR_QUICK_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.id}
                    to={`/dashboard/tools/${tool.id}`}
                    className="group relative bg-vos-bg-elev-2 p-vos-4 text-center transition-colors duration-150 hover:bg-vos-accent/5"
                  >
                    <div className="size-10 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 mx-auto flex items-center justify-center text-vos-text-2 group-hover:text-vos-accent group-hover:border-vos-accent/30 group-hover:bg-vos-accent/10 transition-all duration-200">
                      <Icon size={18} />
                    </div>
                    <div className="text-vos-sm font-medium text-vos-text mt-2.5 group-hover:text-vos-accent transition-colors">
                      {tool.name}
                    </div>
                    <div className="text-[10px] text-vos-text-3 mt-0.5">{tool.desc}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Command bar — search + filters + view toggle */}
        <section className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 p-vos-4 space-y-vos-3">
          <div className="flex flex-col lg:flex-row gap-vos-3">
            {/* Search input */}
            <label className="relative flex items-center gap-2 px-vos-3 h-10 rounded-vos-md bg-vos-bg-canvas border border-vos-border-1 focus-within:border-vos-accent/60 focus-within:shadow-[0_0_0_3px_var(--vos-accent-soft)] transition-all duration-200 flex-1">
              <Search size={14} className="text-vos-text-3 shrink-0" />
              <input
                type="search"
                placeholder={t('tools.searchPlaceholder', 'Search tools by name, description…')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-0 outline-none text-vos-sm text-vos-text placeholder:text-vos-text-muted"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="size-5 rounded hover:bg-vos-bg-elev-3 flex items-center justify-center text-vos-text-3 hover:text-vos-text transition-colors"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </label>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-vos-2">
              <FilterChip
                label="Installed"
                icon={CheckCircle2}
                active={showOnlyInstalled}
                onClick={() => setShowOnlyInstalled((v) => !v)}
                value={showOnlyInstalled ? installedCount : undefined}
              />
              <FilterChip
                label="Verified"
                icon={ShieldCheck}
                active={showOnlyVerified}
                onClick={() => setShowOnlyVerified((v) => !v)}
              />
              <FilterChip
                label="My plan"
                icon={Crown}
                active={showOnlyAvailable}
                onClick={() => setShowOnlyAvailable((v) => !v)}
              />

              <div className="h-6 w-px bg-vos-border-1 mx-0.5" />

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'category' | 'plan')}
                className="h-8 px-vos-3 rounded-vos-md bg-vos-bg-canvas border border-vos-border-1 text-vos-xs text-vos-text-2 focus:outline-none focus:border-vos-accent focus:shadow-[0_0_0_3px_var(--vos-accent-soft)] cursor-pointer transition-all duration-200"
              >
                <option value="category">{t('tools.sortByCategory', 'Category')}</option>
                <option value="name">{t('tools.sortByName', 'Name')}</option>
                <option value="plan">{t('tools.sortByPlan', 'Plan')}</option>
              </select>

              <div className="flex p-0.5 rounded-vos-md bg-vos-bg-canvas border border-vos-border-1">
                <button
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  className={`size-7 rounded flex items-center justify-center transition-all duration-150 ${
                    viewMode === 'grid'
                      ? 'bg-vos-bg-elev-3 text-vos-text shadow-sm'
                      : 'text-vos-text-3 hover:text-vos-text'
                  }`}
                >
                  <LayoutGrid size={13} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  className={`size-7 rounded flex items-center justify-center transition-all duration-150 ${
                    viewMode === 'list'
                      ? 'bg-vos-bg-elev-3 text-vos-text shadow-sm'
                      : 'text-vos-text-3 hover:text-vos-text'
                  }`}
                >
                  <List size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div>
            <div className="flex items-center gap-vos-2 mb-vos-2">
              <SlidersHorizontal size={10} className="text-vos-text-3" />
              <span className="text-[10px] font-semibold uppercase tracking-vos-wide text-vos-text-3">
                {t('tools.categoriesLabel', 'Categories')}
              </span>
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="text-vos-xs text-vos-accent hover:text-vos-accent-2 transition-colors ml-1"
                >
                  Clear ({selectedCategories.length})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categoryList.map((category) => {
                const count = allCategories[category]?.tools?.length || 0;
                return (
                  <FilterChip
                    key={category}
                    label={categoryDisplayNames[category] || category}
                    value={count}
                    icon={(p) => <CategoryIcon name={category} size={p.size} />}
                    active={selectedCategories.includes(category)}
                    onClick={() => toggleCategory(category)}
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* Results summary */}
        <div className="flex items-center justify-between text-vos-xs text-vos-text-3">
          <p>
            Showing{' '}
            <span className="text-vos-text font-semibold tabular-nums">{filteredCount}</span> of{' '}
            <span className="text-vos-text font-semibold tabular-nums">{totalTools}</span> tools
            {searchQuery && (
              <>
                {' '}
                matching <span className="text-vos-accent">"{searchQuery}"</span>
              </>
            )}
            {selectedCategories.length > 0 && (
              <> in {selectedCategories.length} categories</>
            )}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-vos-accent hover:text-vos-accent-2 font-medium transition-colors"
            >
              <RotateCcw size={10} />
              Clear all filters
            </button>
          )}
        </div>

        {/* Tools display */}
        {viewMode === 'grid' ? (
          <VirtualizedToolGrid
            filteredCategories={filteredCategories}
            canUseTool={canUseTool}
          />
        ) : (
          <VirtualizedToolList filteredCategories={filteredCategories} />
        )}

        {Object.keys(filteredCategories).length === 0 && (
          <div className="text-center py-vos-20 rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2">
            <div className="size-16 mx-auto rounded-vos-xl bg-vos-bg-elev-3 border border-vos-border-1 flex items-center justify-center text-vos-text-3 mb-vos-4">
              <Search size={28} strokeWidth={1.5} />
            </div>
            <h3 className="text-vos-lg font-semibold text-vos-text mb-vos-2">
              {t('tools.noToolsFound', 'No tools found')}
            </h3>
            <p className="text-vos-sm text-vos-text-3 mb-vos-5 max-w-sm mx-auto">
              {t(
                'tools.adjustFilters',
                'Try adjusting your search or filter criteria to find what you\'re looking for.',
              )}
            </p>
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-vos-5 h-10 rounded-vos-md bg-vos-accent text-white text-vos-sm font-medium hover:bg-vos-accent-2 transition-colors duration-200"
            >
              <RotateCcw size={13} />
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

/* ════════════════════════════════════════════════════════════════════ *
 *  GRID VIEW — virtualized
 * ════════════════════════════════════════════════════════════════════ */

type VirtualGridRow =
  | { type: 'header'; categoryKey: string; toolCount: number }
  | { type: 'cards'; tools: Array<{ tool: Tool; categoryKey: string }> };

function VirtualizedToolGrid({
  filteredCategories,
  canUseTool,
}: {
  filteredCategories: { [key: string]: Tool[] };
  canUseTool: (plan: string) => boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const COLS = 4;

  const virtualRows = useMemo(() => {
    const rows: VirtualGridRow[] = [];
    Object.entries(filteredCategories).forEach(([categoryKey, tools]) => {
      rows.push({ type: 'header', categoryKey, toolCount: tools.length });
      for (let i = 0; i < tools.length; i += COLS) {
        rows.push({
          type: 'cards',
          tools: tools.slice(i, i + COLS).map((tool) => ({ tool, categoryKey })),
        });
      }
    });
    return rows;
  }, [filteredCategories]);

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => (virtualRows[index].type === 'header' ? 56 : 260),
    overscan: 5,
  });

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-vos-xl"
      style={{ maxHeight: 'calc(100vh - 440px)' }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = virtualRows[virtualRow.index];

          if (row.type === 'header') {
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="flex items-center gap-vos-3 pt-vos-5 pb-vos-3"
              >
                <span className="size-9 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 flex items-center justify-center text-vos-text-2">
                  <CategoryIcon name={row.categoryKey} size={16} />
                </span>
                <div>
                  <h2 className="text-vos-md font-semibold text-vos-text tracking-vos-snug">
                    {categoryDisplayNames[row.categoryKey] || row.categoryKey}
                  </h2>
                  <p className="text-vos-xs text-vos-text-3">
                    {row.toolCount} {row.toolCount === 1 ? 'tool' : 'tools'}
                  </p>
                </div>
                <div className="flex-1 h-px bg-vos-border-1 ml-vos-3" />
              </div>
            );
          }

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-vos-3 py-vos-1"
            >
              {row.tools.map(({ tool, categoryKey }) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  categoryKey={categoryKey}
                  canUse={canUseTool(tool.plan_required)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ToolCard({
  tool,
  categoryKey,
  canUse,
}: {
  tool: Tool;
  categoryKey: string;
  canUse: boolean;
}) {
  void canUse;
  const { t } = useTranslation();
  return (
    <Link
      to={`/dashboard/tools/${tool.id}`}
      className="group block rounded-vos-lg border border-vos-border-1 bg-vos-bg-elev-2 hover:border-vos-border-2 hover:shadow-[var(--vos-shadow-2)] transition-all duration-200 p-vos-4 focus:outline-none focus:ring-2 focus:ring-vos-accent/40 focus:ring-offset-2 focus:ring-offset-vos-bg"
    >
      <div className="flex items-start justify-between gap-vos-2 mb-vos-3">
        <div className="size-9 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 flex items-center justify-center text-vos-text-2 group-hover:text-vos-accent group-hover:border-vos-accent/30 group-hover:bg-vos-accent/10 transition-all duration-200 shrink-0">
          <CategoryIcon name={categoryKey} size={16} />
        </div>
        <ToolBadges tool={tool} />
      </div>
      <h3 className="text-vos-sm font-semibold text-vos-text group-hover:text-vos-accent transition-colors duration-150 leading-tight">
        {tool.name}
      </h3>
      <p className="text-vos-xs text-vos-text-3 line-clamp-2 mt-1 leading-relaxed">
        {tool.description || 'No description available'}
      </p>
      <div className="mt-vos-3 pt-vos-3 border-t border-vos-border-1">
        <span className="h-8 inline-flex items-center justify-center gap-1.5 rounded-vos-md bg-vos-bg-elev-3 group-hover:bg-vos-accent group-hover:text-white border border-vos-border-1 group-hover:border-vos-accent text-vos-text text-vos-xs font-medium transition-all duration-200 w-full">
          {tool.requires_root ? (
            <>
              <Lock size={11} />
              {t('common.runAsRoot', 'Run as Root')}
            </>
          ) : tool.gui_only ? (
            <>
              <Monitor size={11} />
              {t('common.runGuiTool', 'Run via Xvfb')}
            </>
          ) : (
            <>
              <TerminalSquare size={11} />
              {t('common.runTool', 'Run Tool')}
            </>
          )}
        </span>
      </div>
    </Link>
  );
}

function ToolBadges({ tool }: { tool: Tool }) {
  const badges: React.ReactNode[] = [];

  if (tool.maturity === 'verified') {
    badges.push(
      <span key="verified" className="inline-flex items-center gap-1 px-1.5 h-5 rounded-vos-full bg-vos-success-soft text-vos-success text-[10px] font-semibold">
        <ShieldCheck size={9} />
        Verified
      </span>,
    );
  }
  if (tool.installed) {
    badges.push(
      <span key="installed" className="inline-flex items-center gap-1 px-1.5 h-5 rounded-vos-full bg-vos-success-soft text-vos-success text-[10px] font-semibold">
        <CheckCircle2 size={9} />
        Installed
      </span>,
    );
  }
  if (tool.health_status === 'needs_interactive') {
    badges.push(
      <span key="interactive" className="inline-flex items-center gap-1 px-1.5 h-5 rounded-vos-full bg-vos-warning-soft text-vos-warning text-[10px] font-semibold">
        <Monitor size={9} />
        Interactive
      </span>,
    );
  }
  if (tool.dangerous) {
    badges.push(
      <span key="dangerous" className="inline-flex items-center gap-1 px-1.5 h-5 rounded-vos-full bg-vos-danger-soft text-vos-danger text-[10px] font-semibold">
        <AlertTriangle size={9} />
        Dangerous
      </span>,
    );
  }
  if (tool.requires_root) {
    badges.push(
      <span key="root" className="inline-flex items-center gap-1 px-1.5 h-5 rounded-vos-full bg-vos-warning-soft text-vos-warning text-[10px] font-semibold">
        <Lock size={9} />
        Root
      </span>,
    );
  }
  if (tool.gui_only) {
    badges.push(
      <span key="gui" className="inline-flex items-center gap-1 px-1.5 h-5 rounded-vos-full bg-vos-info-soft text-vos-info text-[10px] font-semibold">
        <Monitor size={9} />
        GUI
      </span>,
    );
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-0.5 shrink-0">
      {badges.slice(0, 3)}
      {badges.length > 3 && (
        <span className="text-[9px] text-vos-text-3">+{badges.length - 3}</span>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════ *
 *  LIST VIEW — virtualized dense table
 * ════════════════════════════════════════════════════════════════════ */

function VirtualizedToolList({
  filteredCategories,
}: {
  filteredCategories: { [key: string]: Tool[] };
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const flatTools = useMemo(
    () =>
      Object.entries(filteredCategories).flatMap(([categoryKey, tools]) =>
        tools.map((tool) => ({ tool, categoryKey })),
      ),
    [filteredCategories],
  );

  const rowVirtualizer = useVirtualizer({
    count: flatTools.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 52,
    overscan: 15,
  });

  return (
    <div className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 overflow-hidden">
      <div className="grid grid-cols-[3fr_2fr_1fr_1fr] px-vos-4 py-vos-2.5 bg-vos-bg-elev-1/40 border-b border-vos-border-1 text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3">
        <span>{t('tools.colTool', 'Tool')}</span>
        <span>{t('tools.colCategory', 'Category')}</span>
        <span>{t('tools.colStatus', 'Status')}</span>
        <span className="text-right">{t('tools.colAction', 'Action')}</span>
      </div>
      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ maxHeight: 'calc(100vh - 460px)' }}
      >
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const { tool, categoryKey } = flatTools[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="grid grid-cols-[3fr_2fr_1fr_1fr] items-center gap-vos-2 px-vos-4 border-t border-vos-border-1 hover:bg-vos-bg-elev-3/40 transition-colors duration-100"
              >
                <div className="flex items-center gap-vos-3 min-w-0">
                  <span className="size-7 rounded-vos-sm bg-vos-bg-elev-3 border border-vos-border-1 flex items-center justify-center text-vos-text-2 shrink-0">
                    <CategoryIcon name={categoryKey} size={13} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-vos-sm text-vos-text font-medium truncate">{tool.name}</p>
                    <p className="text-vos-xs text-vos-text-3 truncate">{tool.description}</p>
                  </div>
                </div>
                <span className="text-vos-xs text-vos-text-3 truncate">
                  {categoryDisplayNames[categoryKey] || categoryKey}
                </span>
                <span>
                  {tool.installed ? (
                    <StatusPill tone="success">
                      <CheckCircle2 size={10} />
                      Ready
                    </StatusPill>
                  ) : (
                    <StatusPill tone="neutral">{t('tools.notInstalled', 'Not installed')}</StatusPill>
                  )}
                </span>
                <div className="text-right">
                  <Link
                    to={`/dashboard/tools/${tool.id}`}
                    className="inline-flex items-center gap-1 px-vos-3 h-7 rounded-vos-sm bg-vos-bg-elev-3 hover:bg-vos-accent hover:text-white border border-vos-border-1 hover:border-vos-accent text-vos-xs font-medium transition-all duration-150"
                  >
                    <TerminalSquare size={11} />
                    Run
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ToolsPage;

void Shield;
