/**
 * 🛡️ TargetsPage — V20 "Onyx" rewrite
 *
 * Apple-grade asset inventory.
 * - PageHeader + StatCard summary
 * - Search + group/type filters
 * - DenseTable with checkbox selection, type icon, group chip, tags, risk
 * - Bulk action bar (scan / delete)
 * - Add/Import modals
 *
 * Business logic preserved (React Query queryClient cache mutations).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Crosshair,
  Search,
  X,
  Plus,
  Upload,
  Play,
  Pencil,
  Trash2,
  Globe,
  Link as LinkIcon,
  Network,
  ArrowRightLeft,
  Server,
  FolderTree,
  ListChecks,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { PageTransition } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useTargets, useTargetGroups } from '../../hooks/useApiQueries';
import { queryKeys } from '../../lib/queryClient';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useToast } from '../../components/ui/Toast';
import { TargetsPageSkeleton } from '../../components/ui/Skeleton';
import { StatCard } from '../../components/ui/Card';
import {
  PageHeader,
  StatusPill,
  FilterChip,
  DenseTable,
  DenseTableHead,
  DenseTH,
  DenseTR,
  DenseTD,
} from '../../components/vos';

interface Target {
  id: string;
  name: string;
  value: string;
  type: 'ip' | 'domain' | 'url' | 'cidr' | 'range';
  group_id?: string;
  group_name?: string;
  tags: string[];
  last_scan?: string;
  scans_count: number;
  risk_score?: number;
  created_at: string;
  notes?: string;
}

const TYPE_ICON: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  ip: Server,
  domain: Globe,
  url: LinkIcon,
  cidr: Network,
  range: ArrowRightLeft,
};

const TYPE_LABEL: Record<string, string> = {
  ip: 'IP Address',
  domain: 'Domain',
  url: 'URL',
  cidr: 'CIDR Range',
  range: 'IP Range',
};

const GROUP_DOT: Record<string, string> = {
  red: 'bg-vos-danger',
  yellow: 'bg-vos-warning',
  blue: 'bg-vos-info',
  green: 'bg-vos-success',
  purple: 'bg-vos-info',
  orange: 'bg-vos-warning',
};

function riskTone(score?: number): 'success' | 'warning' | 'danger' | 'neutral' {
  if (!score) return 'neutral';
  if (score >= 70) return 'danger';
  if (score >= 40) return 'warning';
  return 'success';
}

export function TargetsPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('targets.title', 'Targets')} — CyberSec Pro`);
  const toast = useToast();
  const { token: _token } = useAuth();
  void _token;
  const queryClient = useQueryClient();
  const { data: targets = [], isLoading: targetsLoading } = useTargets();
  const { data: groups = [], isLoading: groupsLoading } = useTargetGroups();
  const loading = targetsLoading || groupsLoading;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  const [newTarget, setNewTarget] = useState({
    name: '',
    value: '',
    type: 'ip' as Target['type'],
    group_id: '',
    tags: '',
    notes: '',
  });

  const handleAddTarget = async () => {
    try {
      const target: Target = {
        id: Date.now().toString(),
        name: newTarget.name,
        value: newTarget.value,
        type: newTarget.type,
        group_id: newTarget.group_id,
        group_name: groups.find((g) => g.id === newTarget.group_id)?.name,
        tags: newTarget.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        scans_count: 0,
        created_at: new Date().toISOString(),
        notes: newTarget.notes,
      };
      queryClient.setQueryData(
        queryKeys.targets.list(),
        (old: { targets: Target[] } | undefined) => ({
          targets: [target, ...(old?.targets || [])],
        }),
      );
      setShowAddModal(false);
      setNewTarget({ name: '', value: '', type: 'ip', group_id: '', tags: '', notes: '' });
    } catch {
      toast.error(
        t('targets.addFailed', 'Add Failed'),
        t('targets.addFailedBody', 'Failed to add target'),
      );
    }
  };

  const handleDeleteTargets = async () => {
    queryClient.setQueryData(
      queryKeys.targets.list(),
      (old: { targets: Target[] } | undefined) => ({
        targets: (old?.targets || []).filter((t) => !selectedTargets.includes(t.id)),
      }),
    );
    setSelectedTargets([]);
  };

  const filteredTargets = targets.filter((target) => {
    const matchesSearch =
      (target.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (target.value || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = !selectedGroup || target.group_id === selectedGroup;
    const matchesType = !selectedType || target.type === selectedType;
    return matchesSearch && matchesGroup && matchesType;
  });

  if (loading) return <TargetsPageSkeleton />;

  const highRiskCount = targets.filter((t) => (t.risk_score || 0) >= 70).length;
  const totalScans = targets.reduce((sum, t) => sum + t.scans_count, 0);

  return (
    <PageTransition>
      <div className="p-vos-8 max-w-7xl mx-auto space-y-vos-6">
        <PageHeader
          eyebrow="Inventory"
          icon={<Crosshair size={22} />}
          title={t('targets.title', 'Targets')}
          description={t('targets.subtitle', 'Manage your scan targets and groups')}
          actions={
            <div className="flex items-center gap-vos-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-2 h-10 px-vos-4 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text text-vos-sm font-medium hover:bg-vos-bg-elev-4"
              >
                <Upload size={13} />
                Import
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 h-10 px-vos-4 rounded-vos-md bg-vos-accent text-white text-vos-sm font-medium hover:opacity-90"
              >
                <Plus size={13} />
                Add Target
              </button>
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-vos-3">
          <StatCard
            title={t('targets.totalTargets', 'Total Targets')}
            value={targets.length.toString()}
            icon={<ShieldCheck size={16} />}
          />
          <StatCard
            title={t('targets.groups', 'Groups')}
            value={groups.length.toString()}
            icon={<FolderTree size={16} />}
            variant="purple"
          />
          <StatCard
            title={t('targets.totalScans', 'Total Scans')}
            value={totalScans.toString()}
            icon={<ListChecks size={16} />}
            variant="green"
          />
          <StatCard
            title={t('targets.highRisk', 'High Risk')}
            value={highRiskCount.toString()}
            icon={<AlertTriangle size={16} />}
            variant="red"
          />
        </div>

        {/* Filters */}
        <section className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 p-vos-4 space-y-vos-3">
          <div className="flex flex-col lg:flex-row gap-vos-2">
            <label className="flex items-center gap-2 px-vos-3 h-10 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 focus-within:border-vos-accent focus-within:ring-2 focus-within:ring-vos-accent/30 transition-colors flex-1">
              <Search size={14} className="text-vos-text-3 shrink-0" />
              <input
                type="search"
                placeholder={t('targets.searchPlaceholder', 'Search targets…')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-0 outline-none text-vos-sm text-vos-text placeholder:text-vos-text-muted"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="size-5 rounded hover:bg-vos-bg-elev-4 flex items-center justify-center text-vos-text-3"
                  aria-label="Clear"
                >
                  <X size={12} />
                </button>
              )}
            </label>

            <select
              value={selectedType || ''}
              onChange={(e) => setSelectedType(e.target.value || null)}
              className="h-10 px-vos-3 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text text-vos-sm focus:outline-none focus:border-vos-accent"
            >
              <option value="">{t('targets.allTypes', 'All Types')}</option>
              <option value="ip">{t('targets.ipAddress', 'IP Address')}</option>
              <option value="domain">{t('targets.domain', 'Domain')}</option>
              <option value="url">{t('targets.url', 'URL')}</option>
              <option value="cidr">{t('targets.cidrRange', 'CIDR Range')}</option>
              <option value="range">{t('targets.ipRange', 'IP Range')}</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              label="All groups"
              active={!selectedGroup}
              onClick={() => setSelectedGroup(null)}
              value={targets.length}
            />
            {groups.map((group) => {
              const dot = GROUP_DOT[group.color] || 'bg-vos-text-muted';
              const active = selectedGroup === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(active ? null : group.id)}
                  className={`inline-flex items-center gap-1.5 h-7 px-vos-2 rounded-vos-sm border text-vos-xs font-medium transition-colors ${
                    active
                      ? 'bg-vos-accent/10 border-vos-accent text-vos-accent'
                      : 'bg-vos-bg-elev-3 border-vos-border-1 text-vos-text-2 hover:text-vos-text'
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${dot}`} />
                  {group.name}
                  <span className="tabular-nums text-vos-text-3">
                    ({group.targets_count})
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Bulk action bar */}
        {selectedTargets.length > 0 && (
          <div className="rounded-vos-xl border border-vos-accent/30 bg-vos-accent/5 p-vos-3 flex items-center justify-between">
            <span className="text-vos-sm text-vos-text">
              <span className="font-semibold tabular-nums">{selectedTargets.length}</span>{' '}
              targets selected
            </span>
            <div className="flex gap-vos-2">
              <button className="inline-flex items-center gap-1.5 h-8 px-vos-3 rounded-vos-sm bg-vos-accent text-white text-vos-xs font-medium hover:opacity-90">
                <Play size={11} />
                Scan Selected
              </button>
              <button
                onClick={handleDeleteTargets}
                className="inline-flex items-center gap-1.5 h-8 px-vos-3 rounded-vos-sm bg-vos-danger/10 text-vos-danger border border-vos-danger/20 text-vos-xs font-medium hover:bg-vos-danger/20"
              >
                <Trash2 size={11} />
                Delete
              </button>
              <button
                onClick={() => setSelectedTargets([])}
                className="inline-flex items-center gap-1.5 h-8 px-vos-3 rounded-vos-sm bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text-2 text-vos-xs font-medium hover:text-vos-text"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {filteredTargets.length === 0 ? (
          <div className="text-center py-vos-16 rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2">
            <span className="size-12 mx-auto rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 flex items-center justify-center text-vos-text-3 mb-vos-3">
              <Crosshair size={20} />
            </span>
            <h3 className="text-vos-md font-semibold text-vos-text mb-1">
              {t('targets.noTargetsFound', 'No targets found')}
            </h3>
            <p className="text-vos-sm text-vos-text-3 mb-vos-4">
              {t('targets.addFirstTarget', 'Add your first target to start scanning.')}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 h-10 px-vos-4 rounded-vos-md bg-vos-accent text-white text-vos-sm font-medium hover:opacity-90"
            >
              <Plus size={14} />
              Add Target
            </button>
          </div>
        ) : (
          <DenseTable>
            <DenseTableHead>
              <DenseTH>
                <input
                  type="checkbox"
                  checked={
                    selectedTargets.length === filteredTargets.length &&
                    filteredTargets.length > 0
                  }
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedTargets(filteredTargets.map((t) => t.id));
                    else setSelectedTargets([]);
                  }}
                  className="size-3.5 rounded border-vos-border-2 text-vos-accent focus:ring-vos-accent"
                  aria-label="Select all"
                />
              </DenseTH>
              <DenseTH>{t('common.target', 'Target')}</DenseTH>
              <DenseTH>{t('common.type', 'Type')}</DenseTH>
              <DenseTH>{t('targets.group', 'Group')}</DenseTH>
              <DenseTH>{t('targets.tags', 'Tags')}</DenseTH>
              <DenseTH align="right">{t('common.scans', 'Scans')}</DenseTH>
              <DenseTH>{t('targets.risk', 'Risk')}</DenseTH>
              <DenseTH align="right">{t('common.actions', 'Actions')}</DenseTH>
            </DenseTableHead>
            <tbody>
              {filteredTargets.map((target) => {
                const TypeIcon = TYPE_ICON[target.type] || Server;
                const groupColor = groups.find((g) => g.id === target.group_id)?.color;
                const dot = GROUP_DOT[groupColor || ''] || 'bg-vos-text-muted';
                return (
                  <DenseTR key={target.id}>
                    <DenseTD>
                      <input
                        type="checkbox"
                        checked={selectedTargets.includes(target.id)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setSelectedTargets([...selectedTargets, target.id]);
                          else
                            setSelectedTargets(
                              selectedTargets.filter((id) => id !== target.id),
                            );
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="size-3.5 rounded border-vos-border-2 text-vos-accent focus:ring-vos-accent"
                      />
                    </DenseTD>
                    <DenseTD>
                      <div>
                        <p className="text-vos-text font-medium">{target.name}</p>
                        <p className="text-vos-xs font-mono text-vos-text-3">
                          {target.value}
                        </p>
                      </div>
                    </DenseTD>
                    <DenseTD>
                      <span className="inline-flex items-center gap-1.5 text-vos-text-2 text-vos-xs">
                        <TypeIcon size={12} />
                        {TYPE_LABEL[target.type]}
                      </span>
                    </DenseTD>
                    <DenseTD>
                      {target.group_name && (
                        <span className="inline-flex items-center gap-1.5 px-vos-2 h-6 rounded-vos-sm bg-vos-bg-elev-3 border border-vos-border-1 text-vos-xs text-vos-text-2">
                          <span className={`size-1.5 rounded-full ${dot}`} />
                          {target.group_name}
                        </span>
                      )}
                    </DenseTD>
                    <DenseTD>
                      <div className="flex flex-wrap gap-1">
                        {(target.tags || []).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 h-5 inline-flex items-center rounded text-[10px] bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text-3"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </DenseTD>
                    <DenseTD align="right">
                      <span className="text-vos-text tabular-nums text-vos-xs">
                        {target.scans_count}
                      </span>
                    </DenseTD>
                    <DenseTD>
                      {target.risk_score !== undefined ? (
                        <StatusPill tone={riskTone(target.risk_score)}>
                          {target.risk_score}%
                        </StatusPill>
                      ) : (
                        <span className="text-vos-text-muted text-vos-xs">–</span>
                      )}
                    </DenseTD>
                    <DenseTD align="right">
                      <div
                        className="flex gap-1 justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link
                          to={`/dashboard/scans/new?target=${encodeURIComponent(
                            target.value,
                          )}`}
                          className="size-7 rounded-vos-sm bg-vos-accent/10 text-vos-accent border border-vos-accent/20 hover:bg-vos-accent hover:text-white flex items-center justify-center transition-colors"
                          title={t('targets.scanTitle', 'Scan')}
                        >
                          <Play size={11} />
                        </Link>
                        <button
                          className="size-7 rounded-vos-sm bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text-2 hover:text-vos-text hover:bg-vos-bg-elev-4 flex items-center justify-center transition-colors"
                          title={t('common.edit', 'Edit')}
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                    </DenseTD>
                  </DenseTR>
                );
              })}
            </tbody>
          </DenseTable>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <Modal title={t('targets.addTarget', 'Add Target')} onClose={() => setShowAddModal(false)}>
            <div className="p-vos-5 space-y-vos-4">
              <ModalField label={t('common.name', 'Name')}>
                <ModalInput
                  value={newTarget.name}
                  onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })}
                  placeholder={t('targets.namePlaceholder', 'Production Server')}
                />
              </ModalField>
              <ModalField label={t('targets.value', 'Value')}>
                <ModalInput
                  value={newTarget.value}
                  onChange={(e) => setNewTarget({ ...newTarget, value: e.target.value })}
                  placeholder="192.168.1.1 or example.com"
                />
              </ModalField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-vos-3">
                <ModalField label={t('common.type', 'Type')}>
                  <ModalSelect
                    value={newTarget.type}
                    onChange={(e) =>
                      setNewTarget({ ...newTarget, type: e.target.value as Target['type'] })
                    }
                  >
                    <option value="ip">{t('targets.ipAddress', 'IP Address')}</option>
                    <option value="domain">{t('targets.domain', 'Domain')}</option>
                    <option value="url">{t('targets.url', 'URL')}</option>
                    <option value="cidr">{t('targets.cidrRange', 'CIDR Range')}</option>
                    <option value="range">{t('targets.ipRange', 'IP Range')}</option>
                  </ModalSelect>
                </ModalField>
                <ModalField label={t('targets.group', 'Group')}>
                  <ModalSelect
                    value={newTarget.group_id}
                    onChange={(e) =>
                      setNewTarget({ ...newTarget, group_id: e.target.value })
                    }
                  >
                    <option value="">{t('targets.noGroup', 'No Group')}</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </ModalSelect>
                </ModalField>
              </div>
              <ModalField label={t('targets.tagsLabel', 'Tags (comma separated)')}>
                <ModalInput
                  value={newTarget.tags}
                  onChange={(e) => setNewTarget({ ...newTarget, tags: e.target.value })}
                  placeholder={t('targets.tagsPlaceholder', 'web, production, critical')}
                />
              </ModalField>
              <ModalField label={t('targets.notes', 'Notes')}>
                <textarea
                  value={newTarget.notes}
                  onChange={(e) => setNewTarget({ ...newTarget, notes: e.target.value })}
                  placeholder={t(
                    'targets.notesPlaceholder',
                    'Additional notes about this target…',
                  )}
                  rows={3}
                  className="w-full px-vos-3 py-vos-2 bg-vos-bg-elev-3 border border-vos-border-1 rounded-vos-md text-vos-text placeholder:text-vos-text-muted focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30 resize-none text-vos-sm"
                />
              </ModalField>
            </div>
            <ModalFooter>
              <ModalCancel onClick={() => setShowAddModal(false)} />
              <ModalConfirm
                onClick={handleAddTarget}
                disabled={!newTarget.name || !newTarget.value}
              >
                Add Target
              </ModalConfirm>
            </ModalFooter>
          </Modal>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <Modal
            title={t('targets.importTargets', 'Import Targets')}
            onClose={() => setShowImportModal(false)}
          >
            <div className="p-vos-5 space-y-vos-4">
              <div className="border-2 border-dashed border-vos-border-2 rounded-vos-md p-vos-6 text-center hover:border-vos-accent transition-colors cursor-pointer">
                <Upload size={36} className="text-vos-text-3 mx-auto mb-vos-2" />
                <p className="text-vos-sm text-vos-text">
                  {t('targets.dropFile', 'Drop a file here or click to upload')}
                </p>
                <p className="text-vos-xs text-vos-text-muted mt-1">
                  {t('targets.supportedFormats', 'Supports CSV, TXT, JSON formats')}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-1.5">
                  {t('targets.pasteTargets', 'Or paste targets (one per line):')}
                </p>
                <textarea
                  placeholder={`192.168.1.1\nexample.com\n10.0.0.0/24`}
                  rows={6}
                  className="w-full px-vos-3 py-vos-2 bg-vos-bg-elev-3 border border-vos-border-1 rounded-vos-md text-vos-text placeholder:text-vos-text-muted focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30 resize-none font-mono text-vos-xs"
                />
              </div>
            </div>
            <ModalFooter>
              <ModalCancel onClick={() => setShowImportModal(false)} />
              <ModalConfirm onClick={() => setShowImportModal(false)}>{t('targets.import', 'Import')}</ModalConfirm>
            </ModalFooter>
          </Modal>
        )}
      </div>
    </PageTransition>
  );
}

/* ───────── Modal primitives ───────── */
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-vos-4"
      onClick={onClose}
    >
      <div
        className="rounded-vos-2xl border border-vos-border-1 bg-vos-bg-elev-2 w-full max-w-lg shadow-vos-elev-3 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-vos-5 border-b border-vos-border-1">
          <h2 className="text-vos-md font-semibold text-vos-text">{title}</h2>
          <button
            onClick={onClose}
            className="size-8 rounded-vos-md text-vos-text-3 hover:text-vos-text hover:bg-vos-bg-elev-3 flex items-center justify-center"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalField({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}

function ModalInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      {...props}
      className="w-full px-vos-3 h-10 bg-vos-bg-elev-3 border border-vos-border-1 rounded-vos-md text-vos-text text-vos-sm placeholder:text-vos-text-muted focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30"
    />
  );
}

function ModalSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-vos-3 h-10 bg-vos-bg-elev-3 border border-vos-border-1 rounded-vos-md text-vos-text text-vos-sm focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30"
    />
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-vos-2 p-vos-5 border-t border-vos-border-1 bg-vos-bg-elev-1/40">
      {children}
    </div>
  );
}

function ModalCancel({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-10 px-vos-4 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text text-vos-sm font-medium hover:bg-vos-bg-elev-4"
    >
      Cancel
    </button>
  );
}

function ModalConfirm({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-10 px-vos-5 rounded-vos-md bg-vos-accent text-white text-vos-sm font-semibold hover:opacity-90 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export default TargetsPage;
