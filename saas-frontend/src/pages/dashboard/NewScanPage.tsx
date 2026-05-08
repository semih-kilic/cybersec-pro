/**
 * 🛡️ NewScanPage — V20 "Onyx" rewrite
 *
 * Apple-grade 3-step wizard for launching a new scan.
 * Step 1: Tool — search + popular grid + categorized list
 * Step 2: Configure — name, target, agent, project, command, priority, notify
 * Step 3: Review — KeyValueGrid summary + start button
 *
 * Business logic preserved verbatim (React Query, smartDefaults,
 * dangerous-tool confirmation modal).
 */
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  X,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Play,
  AlertTriangle,
  Loader2,
  Server,
  FolderKanban,
  Crosshair,
  Wrench,
  TerminalSquare,
  ShieldAlert,
  CheckCircle2,
  Bell,
  PlusCircle,
} from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { PageTransition } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { getSmartDefaults } from '../../config/toolConfigs';
import {
  useTools,
  useTargets,
  useProjects,
  useStartScan,
  useAgentsList,
} from '../../hooks/useApiQueries';
import { useAuth, getUserPlan } from '../../hooks/useAuth';
import { NewScanPageSkeleton } from '../../components/ui/Skeleton';
import {
  PageHeader,
  StatusPill,
  KeyValueGrid,
} from '../../components/vos';

interface Tool {
  id: string;
  name: string;
  slug?: string;
  category: string;
  description?: string;
  dangerous?: boolean;
  requires_root?: boolean;
  gui_only?: boolean;
  plan_required?: string;
}

interface Target {
  id: string;
  name: string;
  value: string;
  type: string;
}

interface Agent {
  id: number;
  name: string;
  ip_address: string;
  platform: string;
  status: string;
}

interface Project {
  id: number;
  name: string;
  target_url?: string;
  target_ip?: string;
}

const POPULAR = ['nmap', 'nikto', 'sqlmap', 'hydra', 'gobuster', 'nuclei', 'wpscan', 'john'];

export function NewScanPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('newScan.title', 'New Scan')} — CyberSec Pro`);
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { organization } = useAuth();
  const userPlan = getUserPlan(organization);

  const { data: toolsData, isLoading: toolsLoading } = useTools(userPlan);
  const { data: fetchedTargets = [], isLoading: targetsLoading } = useTargets();
  const { data: fetchedProjects = [], isLoading: projectsLoading } = useProjects();
  const startScanMutation = useStartScan();

  const tools = useMemo(() => {
    if (!toolsData) return {} as { [category: string]: Tool[] };
    const out: { [key: string]: Tool[] } = {};
    Object.entries(toolsData.categories || {}).forEach(([catKey, catData]: [string, any]) => {
      out[catData.info?.name || catKey] = catData.tools.map((t: any) => ({ ...t, slug: t.id }));
    });
    return out;
  }, [toolsData]);

  const targets: Target[] = fetchedTargets as unknown as Target[];
  const projects: Project[] = fetchedProjects as unknown as Project[];
  const { data: agentsListData } = useAgentsList();
  const [agents, setAgents] = useState<Agent[]>([]);
  const loading = toolsLoading || targetsLoading || projectsLoading;
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState(1);
  const [selectedTool, setSelectedTool] = useState<string>(searchParams.get('tool') || '');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [customTarget, setCustomTarget] = useState('');
  const [useCustomTarget, setUseCustomTarget] = useState(true);
  const [customCommand, setCustomCommand] = useState(searchParams.get('command') || '');
  const [scanName, setScanName] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [notifications, setNotifications] = useState(true);
  const [showDangerousWarning, setShowDangerousWarning] = useState(false);
  const [dangerousConfirmed, setDangerousConfirmed] = useState(false);
  const [toolSearch, setToolSearch] = useState('');

  useEffect(() => {
    if (agentsListData) {
      setAgents(agentsListData as Agent[]);
      const onlineAgent = (agentsListData as Agent[]).find((a) => a.status === 'online');
      if (onlineAgent) setSelectedAgent(onlineAgent.id);
    }
  }, [agentsListData]);

  const allTools = Object.values(tools).flat();
  const selectedToolObj = allTools.find((t) => t.id === selectedTool || t.slug === selectedTool);

  const handleSubmit = async () => {
    if (selectedToolObj?.dangerous && !dangerousConfirmed) {
      setShowDangerousWarning(true);
      return;
    }

    setSubmitting(true);
    try {
      const toolName = selectedToolObj?.name || selectedTool;
      const result = await startScanMutation.mutateAsync({
        tool: toolName,
        target: useCustomTarget ? customTarget : selectedTarget,
        parameters: getSmartDefaults(toolName, 'standard'),
        agent_id: selectedAgent,
        project_id: selectedProject,
      });

      if (result.success) {
        navigate(`/dashboard/scans/${result.scan_id}`);
      } else if (result.requires_confirmation) {
        setShowDangerousWarning(true);
      } else {
        toast.error(
          t('newScan.scanFailed', 'Scan Failed'),
          result.error || result.hint || t('newScan.failedToStart', 'Failed to start scan'),
        );
      }
    } catch (error: any) {
      toast.error(
        t('newScan.scanFailed', 'Scan Failed'),
        error.message || t('newScan.failedToStart', 'Failed to start scan'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDangerousScan = () => {
    setDangerousConfirmed(true);
    setShowDangerousWarning(false);
    handleSubmit();
  };

  if (loading) return <NewScanPageSkeleton />;

  return (
    <PageTransition>
      <div className="p-vos-8 max-w-4xl mx-auto space-y-vos-6">
        <PageHeader
          eyebrow="Workflow"
          icon={<PlusCircle size={22} />}
          title={t('newScan.title', 'New Scan')}
          description={t('newScan.subtitle', 'Configure and start a new security scan')}
        />

        {/* Step indicator */}
        <Stepper step={step} t={t} />

        {/* Step 1 — Select Tool */}
        {step === 1 && (
          <div className="space-y-vos-4">
            <section className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 p-vos-5">
              <h2 className="text-vos-md font-semibold text-vos-text mb-vos-4">
                {t('newScan.selectTool', 'Select a Tool')}
              </h2>

              <label className="flex items-center gap-2 px-vos-3 h-10 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 focus-within:border-vos-accent focus-within:ring-2 focus-within:ring-vos-accent/30 transition-colors mb-vos-5">
                <Search size={14} className="text-vos-text-3 shrink-0" />
                <input
                  type="search"
                  placeholder={t('newScan.searchToolsPlaceholder', 'Search tools…')}
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  className="flex-1 bg-transparent border-0 outline-none text-vos-sm text-vos-text placeholder:text-vos-text-muted"
                />
                {toolSearch && (
                  <button
                    onClick={() => setToolSearch('')}
                    className="size-5 rounded hover:bg-vos-bg-elev-4 flex items-center justify-center text-vos-text-3"
                    aria-label="Clear"
                  >
                    <X size={12} />
                  </button>
                )}
              </label>

              {/* Popular */}
              {!toolSearch && (
                <div className="mb-vos-5">
                  <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-vos-2">
                    {t('newScan.popularTools', 'Popular Tools')}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-vos-2">
                    {POPULAR.map((tool) => (
                      <button
                        key={tool}
                        onClick={() => setSelectedTool(tool)}
                        className={`p-vos-3 rounded-vos-md border text-left transition-colors ${
                          selectedTool === tool
                            ? 'bg-vos-accent/10 border-vos-accent text-vos-accent'
                            : 'bg-vos-bg-elev-3 border-vos-border-1 text-vos-text hover:border-vos-border-2'
                        }`}
                      >
                        <p className="text-vos-sm font-medium">{tool}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categorized */}
              <div>
                <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-vos-2">
                  {toolSearch
                    ? `${t('newScan.searchResults', 'Results for')} "${toolSearch}"`
                    : t('newScan.allTools', 'All Tools')}
                </p>
                <div className="space-y-vos-4 max-h-96 overflow-y-auto pr-1">
                  {Object.entries(tools).map(([category, categoryTools]) => {
                    const filtered = toolSearch
                      ? categoryTools.filter(
                          (t) =>
                            t.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
                            t.id.toLowerCase().includes(toolSearch.toLowerCase()) ||
                            (t.description?.toLowerCase() || '').includes(
                              toolSearch.toLowerCase(),
                            ),
                        )
                      : categoryTools;
                    if (filtered.length === 0) return null;
                    return (
                      <div key={category}>
                        <p className="text-[10px] uppercase tracking-vos-wide text-vos-text-muted mb-1.5">
                          {category}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                          {filtered.map((tool) => {
                            const active =
                              selectedTool === tool.slug || selectedTool === tool.id;
                            return (
                              <button
                                key={tool.id}
                                onClick={() => setSelectedTool(tool.slug || tool.id)}
                                className={`p-vos-2 rounded-vos-sm border text-left transition-colors ${
                                  active
                                    ? 'bg-vos-accent/10 border-vos-accent text-vos-accent'
                                    : 'bg-vos-bg-elev-3 border-vos-border-1 text-vos-text hover:border-vos-border-2'
                                }`}
                              >
                                <p className="text-vos-xs font-medium">{tool.name}</p>
                                {tool.dangerous && (
                                  <span className="text-[9px] text-vos-danger uppercase tracking-wide">
                                    Dangerous
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <NavRow>
              <Link
                to="/dashboard/scans"
                className="inline-flex items-center gap-2 h-10 px-vos-4 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text text-vos-sm font-medium hover:bg-vos-bg-elev-4"
              >
                <X size={13} />
                Cancel
              </Link>
              <PrimaryButton
                disabled={!selectedTool}
                onClick={() => setStep(2)}
              >
                Next
                <ArrowRight size={13} />
              </PrimaryButton>
            </NavRow>
          </div>
        )}

        {/* Step 2 — Configure */}
        {step === 2 && (
          <div className="space-y-vos-4">
            <section className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 p-vos-5 space-y-vos-5">
              <h2 className="text-vos-md font-semibold text-vos-text">
                {t('newScan.configureScan', 'Configure Scan')}
              </h2>

              <Field label={t('newScan.scanNameLabel', 'Scan Name (Optional)')}>
                <Input
                  value={scanName}
                  onChange={(e) => setScanName(e.target.value)}
                  placeholder={`${selectedTool} scan – ${new Date().toLocaleDateString()}`}
                />
              </Field>

              <Field label={t('common.target', 'Target')} icon={<Crosshair size={12} />}>
                <div className="flex gap-1.5 mb-vos-2 p-0.5 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 w-fit">
                  <SegBtn active={useCustomTarget} onClick={() => setUseCustomTarget(true)}>
                    Custom
                  </SegBtn>
                  <SegBtn active={!useCustomTarget} onClick={() => setUseCustomTarget(false)}>
                    Saved
                  </SegBtn>
                </div>
                {useCustomTarget ? (
                  <Input
                    value={customTarget}
                    onChange={(e) => setCustomTarget(e.target.value)}
                    placeholder={t(
                      'newScan.targetPlaceholder',
                      'scanme.nmap.org, testphp.vulnweb.com, or your public IP',
                    )}
                  />
                ) : (
                  <Select
                    value={selectedTarget}
                    onChange={(e) => setSelectedTarget(e.target.value)}
                  >
                    <option value="">
                      {t('newScan.selectSavedTarget', 'Select a saved target…')}
                    </option>
                    {targets.map((target) => (
                      <option key={target.id} value={target.value}>
                        {target.name} ({target.value})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field
                label={t('newScan.executionAgent', 'Execution Agent')}
                icon={<Server size={12} />}
                hint={t(
                  'newScan.agentHint',
                  'Select an agent to execute the scan. Use Server for built-in execution, or choose an SSH agent.',
                )}
              >
                <Select
                  value={selectedAgent || ''}
                  onChange={(e) =>
                    setSelectedAgent(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">{t('newScan.serverDefault', 'Server (Default)')}</option>
                  {agents.map((agent) => (
                    <option
                      key={agent.id}
                      value={agent.id}
                      disabled={agent.status !== 'online'}
                    >
                      {agent.status === 'online' ? '●' : '○'} {agent.name} ({agent.ip_address})
                      — {agent.platform}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label={t('newScan.projectOptional', 'Project (Optional)')}
                icon={<FolderKanban size={12} />}
                hint={t(
                  'newScan.projectHint',
                  'Assign this scan to a project for better organization.',
                )}
              >
                <Select
                  value={selectedProject || ''}
                  onChange={(e) =>
                    setSelectedProject(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">{t('newScan.noProject', 'No Project')}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label={
                  <span className="flex items-center gap-vos-2">
                    {t('newScan.customCommand', 'Custom Command (Optional)')}
                    <Link
                      to={`/dashboard/tools/${selectedTool}`}
                      className="text-vos-accent hover:opacity-80 inline-flex items-center gap-0.5"
                    >
                      Configure parameters <ChevronRight size={11} />
                    </Link>
                  </span>
                }
                icon={<TerminalSquare size={12} />}
                hint={t(
                  'newScan.commandHint',
                  'Leave empty to use default options, or customize the command above.',
                )}
              >
                <textarea
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                  placeholder={`${selectedTool} [options] target`}
                  rows={3}
                  className="w-full px-vos-3 py-vos-2 bg-vos-bg-elev-3 border border-vos-border-1 rounded-vos-md text-vos-text placeholder:text-vos-text-muted focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30 transition-colors font-mono text-vos-xs resize-none"
                />
              </Field>

              <Field label={t('newScan.priorityLabel', 'Priority')}>
                <div className="flex gap-1.5">
                  {(['low', 'normal', 'high'] as const).map((p) => {
                    const active = priority === p;
                    const tone =
                      p === 'high'
                        ? 'danger'
                        : p === 'normal'
                        ? 'accent'
                        : 'neutral';
                    const cls = active
                      ? tone === 'danger'
                        ? 'bg-vos-danger/10 border-vos-danger text-vos-danger'
                        : tone === 'accent'
                        ? 'bg-vos-accent/10 border-vos-accent text-vos-accent'
                        : 'bg-vos-bg-elev-4 border-vos-border-2 text-vos-text'
                      : 'bg-vos-bg-elev-3 border-vos-border-1 text-vos-text-3 hover:text-vos-text';
                    return (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`px-vos-3 h-8 rounded-vos-md text-vos-xs font-medium capitalize border transition-colors ${cls}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field>
                <label className="flex items-center gap-vos-3 cursor-pointer">
                  <Toggle
                    checked={notifications}
                    onChange={(v) => setNotifications(v)}
                  />
                  <span className="text-vos-sm text-vos-text inline-flex items-center gap-1.5">
                    <Bell size={12} className="text-vos-text-3" />
                    {t('newScan.notifyLabel', 'Notify me when scan completes')}
                  </span>
                </label>
              </Field>
            </section>

            <NavRow>
              <BackButton onClick={() => setStep(1)} />
              <PrimaryButton
                disabled={!customTarget && !selectedTarget}
                onClick={() => setStep(3)}
              >
                Next
                <ArrowRight size={13} />
              </PrimaryButton>
            </NavRow>
          </div>
        )}

        {/* Step 3 — Review */}
        {step === 3 && (
          <div className="space-y-vos-4">
            <section className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 p-vos-5 space-y-vos-5">
              <h2 className="text-vos-md font-semibold text-vos-text">
                {t('newScan.reviewScan', 'Review Scan')}
              </h2>

              <KeyValueGrid
                cols={2}
                items={[
                  {
                    label: t('common.tool', 'Tool'),
                    value: (
                      <span className="text-vos-sm text-vos-text font-medium inline-flex items-center gap-1.5">
                        <Wrench size={12} className="text-vos-text-3" />
                        {selectedTool}
                        {selectedToolObj?.dangerous && (
                          <StatusPill tone="danger">
                            <AlertTriangle size={10} />
                            Dangerous
                          </StatusPill>
                        )}
                      </span>
                    ),
                  },
                  {
                    label: t('common.target', 'Target'),
                    value: (
                      <span className="text-vos-sm font-mono text-vos-text">
                        {useCustomTarget ? customTarget : selectedTarget}
                      </span>
                    ),
                  },
                  {
                    label: t('newScan.reviewPriority', 'Priority'),
                    value: (
                      <StatusPill
                        tone={
                          priority === 'high'
                            ? 'danger'
                            : priority === 'normal'
                            ? 'accent'
                            : 'neutral'
                        }
                      >
                        {priority}
                      </StatusPill>
                    ),
                  },
                  {
                    label: t('newScan.reviewNotifications', 'Notifications'),
                    value: (
                      <span className="text-vos-sm text-vos-text inline-flex items-center gap-1.5">
                        {notifications ? (
                          <CheckCircle2 size={12} className="text-vos-success" />
                        ) : (
                          <X size={12} className="text-vos-text-3" />
                        )}
                        {notifications
                          ? t('newScan.enabled', 'Enabled')
                          : t('newScan.disabled', 'Disabled')}
                      </span>
                    ),
                  },
                  {
                    label: t('newScan.reviewAgent', 'Execution Agent'),
                    value: (
                      <span className="text-vos-sm text-vos-text inline-flex items-center gap-1.5">
                        <Server size={12} className="text-vos-text-3" />
                        {selectedAgent
                          ? agents.find((a) => a.id === selectedAgent)?.name ||
                            t('newScan.unknownAgent', 'Unknown Agent')
                          : t('newScan.serverDefault', 'Server (Default)')}
                      </span>
                    ),
                  },
                  {
                    label: t('newScan.reviewProject', 'Project'),
                    value: (
                      <span className="text-vos-sm text-vos-text inline-flex items-center gap-1.5">
                        <FolderKanban size={12} className="text-vos-text-3" />
                        {selectedProject
                          ? projects.find((p) => p.id === selectedProject)?.name ||
                            t('newScan.unknownProject', 'Unknown Project')
                          : t('newScan.noProject', 'No Project')}
                      </span>
                    ),
                  },
                ]}
              />

              {customCommand && (
                <div>
                  <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-1.5">
                    {t('newScan.reviewCommand', 'Command')}
                  </p>
                  <div className="rounded-vos-md bg-vos-bg-elev-1 border border-vos-border-1 p-vos-3 overflow-x-auto">
                    <code className="text-vos-success font-mono text-vos-xs">
                      {customCommand}
                    </code>
                  </div>
                </div>
              )}
            </section>

            <div className="rounded-vos-xl border border-vos-warning/30 bg-vos-warning/10 p-vos-4 flex items-start gap-vos-3">
              <ShieldAlert size={18} className="text-vos-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-vos-warning font-medium text-vos-sm">
                  {t('newScan.authorizedOnly', 'Authorized Testing Only')}
                </p>
                <p className="text-vos-warning/80 text-vos-xs mt-1">
                  {t(
                    'newScan.authorizedOnlyDesc',
                    'Only scan targets you have explicit permission to test. Unauthorized scanning is illegal.',
                  )}
                </p>
              </div>
            </div>

            <NavRow>
              <BackButton onClick={() => setStep(2)} />
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-vos-2 h-11 px-vos-6 rounded-vos-md bg-vos-accent text-white text-vos-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-vos-elev-1"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Start Scan
                  </>
                )}
              </button>
            </NavRow>
          </div>
        )}

        {/* Dangerous tool warning */}
        {showDangerousWarning && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-vos-4"
            onClick={() => setShowDangerousWarning(false)}
          >
            <div
              className="rounded-vos-2xl border border-vos-danger/40 bg-vos-bg-elev-2 max-w-md w-full p-vos-5 shadow-vos-elev-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-vos-3 mb-vos-4">
                <span className="size-10 rounded-vos-md bg-vos-danger/15 border border-vos-danger/30 flex items-center justify-center text-vos-danger">
                  <AlertTriangle size={18} />
                </span>
                <div>
                  <h3 className="text-vos-md font-semibold text-vos-text">
                    {t('newScan.dangerWarning', 'Dangerous Tool Warning')}
                  </h3>
                  <p className="text-vos-xs text-vos-text-3">
                    {t('newScan.confirmationRequired', 'This action requires confirmation')}
                  </p>
                </div>
              </div>

              <div className="rounded-vos-md bg-vos-danger/10 border border-vos-danger/20 p-vos-3 mb-vos-5">
                <p className="text-vos-danger text-vos-xs">
                  {t('newScan.dangerousToolWarning', '{{tool}} is marked as a dangerous tool. It may actively exploit vulnerabilities or affect target systems.', { tool: selectedTool })}
                </p>
                <ul className="mt-vos-2 text-vos-danger/80 text-vos-xs space-y-1">
                  <li>{t('newScan.dangerousBullet1', '• Only use on systems you own or have written permission to test')}</li>
                  <li>{t('newScan.dangerousBullet2', '• May trigger security alerts on target systems')}</li>
                  <li>{t('newScan.dangerousBullet3', '• Could cause service disruption if misconfigured')}</li>
                  <li>{t('newScan.dangerousBullet4', '• All actions are logged for audit purposes')}</li>
                </ul>
              </div>

              <div className="flex gap-vos-2">
                <button
                  onClick={() => setShowDangerousWarning(false)}
                  className="flex-1 h-10 px-vos-4 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text text-vos-sm font-medium hover:bg-vos-bg-elev-4"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDangerousScan}
                  className="flex-1 h-10 px-vos-4 rounded-vos-md bg-vos-danger text-white text-vos-sm font-semibold hover:opacity-90"
                >
                  I Understand, Proceed
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

/* ───────── Local primitives ───────── */

function Stepper({ step, t }: { step: number; t: (key: string, fallback: string) => string }) {
  const labels = [
    t('newScan.steps.selectTool', 'Select Tool'),
    t('newScan.steps.configure', 'Configure'),
    t('newScan.steps.review', 'Review'),
  ];
  return (
    <div className="flex items-center justify-center">
      {labels.map((label, i) => {
        const s = i + 1;
        const active = step >= s;
        const current = step === s;
        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`size-9 rounded-full flex items-center justify-center text-vos-xs font-semibold border-2 transition-colors ${
                  current
                    ? 'bg-vos-accent border-vos-accent text-white shadow-vos-elev-1'
                    : active
                    ? 'bg-vos-accent/15 border-vos-accent text-vos-accent'
                    : 'bg-vos-bg-elev-3 border-vos-border-1 text-vos-text-3'
                }`}
              >
                {active && !current ? <CheckCircle2 size={14} /> : s}
              </div>
              <span
                className={`text-[10px] uppercase tracking-vos-wide font-medium ${
                  active ? 'text-vos-text' : 'text-vos-text-muted'
                }`}
              >
                {label}
              </span>
            </div>
            {s < 3 && (
              <div
                className={`w-20 h-0.5 mx-vos-2 mb-5 transition-colors ${
                  step > s ? 'bg-vos-accent' : 'bg-vos-border-1'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function NavRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between">{children}</div>;
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-vos-2 h-10 px-vos-5 rounded-vos-md bg-vos-accent text-white text-vos-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
    >
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 h-10 px-vos-4 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text text-vos-sm font-medium hover:bg-vos-bg-elev-4"
    >
      <ArrowLeft size={13} />
      Back
    </button>
  );
}

function Field({
  label,
  icon,
  hint,
  children,
}: {
  label?: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && (
        <label className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-1.5 flex items-center gap-1.5">
          {icon}
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-vos-xs text-vos-text-muted mt-1">{hint}</p>}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      {...props}
      className="w-full px-vos-3 h-10 bg-vos-bg-elev-3 border border-vos-border-1 rounded-vos-md text-vos-text text-vos-sm placeholder:text-vos-text-muted focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30 transition-colors"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-vos-3 h-10 bg-vos-bg-elev-3 border border-vos-border-1 rounded-vos-md text-vos-text text-vos-sm focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30 transition-colors"
    />
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-vos-3 rounded text-vos-xs font-medium transition-colors ${
        active
          ? 'bg-vos-bg-elev-4 text-vos-text'
          : 'text-vos-text-3 hover:text-vos-text'
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors ${
        checked ? 'bg-vos-accent' : 'bg-vos-bg-elev-4 border border-vos-border-1'
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 bg-white rounded-full shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default NewScanPage;
