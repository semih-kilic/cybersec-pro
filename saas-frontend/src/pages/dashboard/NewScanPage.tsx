/**
 * NewScanPage — Smart Scan
 * Agent seç → mod seç → araç seç → başlat
 */
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, X, Play, AlertTriangle, Loader2, Server,
  Globe2, Monitor, Zap, ChevronRight, PlusCircle,
  CheckCircle2, ShieldAlert, Network, Crosshair,
} from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { PageTransition } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { getSmartDefaults } from '../../config/toolConfigs';
import { useTools, useAgentsList, useStartScan, useProjects } from '../../hooks/useApiQueries';
import { useAuth, getUserPlan } from '../../hooks/useAuth';
import { NewScanPageSkeleton } from '../../components/ui/Skeleton';
import { PageHeader } from '../../components/vos';

type ScanMode = 'single' | 'network';
interface Agent { id: string; name: string; ip_address: string; platform: string; status: string; connection_type: string; subnets?: string[]; }
interface Tool  { id: string; name: string; slug?: string; category: string; description?: string; dangerous?: boolean; }

const QUICK_TOOLS = [
  { id: 'nmap',      label: 'Port Scan',      icon: '🔍', desc: 'Open ports & services' },
  { id: 'nikto',     label: 'Web Scan',        icon: '🌐', desc: 'Web vulnerabilities' },
  { id: 'nuclei',    label: 'Vuln Scan',       icon: '⚡', desc: 'Known CVEs & misconfigs' },
  { id: 'gobuster',  label: 'Dir Brute',       icon: '📂', desc: 'Hidden paths & files' },
  { id: 'sqlmap',    label: 'SQL Injection',   icon: '💉', desc: 'SQL injection testing' },
  { id: 'hydra',     label: 'Password Audit',  icon: '🔑', desc: 'Credential brute-force' },
  { id: 'wpscan',    label: 'WordPress',       icon: '📝', desc: 'WordPress vulnerabilities' },
  { id: 'subfinder', label: 'Subdomains',      icon: '🗺️', desc: 'Discover subdomains' },
];

export function NewScanPage() {
  const { t } = useTranslation();
  useDocumentTitle('New Scan — CyberSec Pro');
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { organization } = useAuth();
  const userPlan = getUserPlan(organization);

  const { data: toolsData, isLoading: toolsLoading } = useTools(userPlan);
  const { data: agentsListData } = useAgentsList();
  const { data: fetchedProjects = [] } = useProjects();
  const startScanMutation = useStartScan();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [scanMode, setScanMode] = useState<ScanMode>('single');
  const [target, setTarget] = useState('');
  const [selectedTool, setSelectedTool] = useState(searchParams.get('tool') || 'nmap');
  const [toolSearch, setToolSearch] = useState('');
  const [showAllTools, setShowAllTools] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDanger, setShowDanger] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [authzConfirmed, setAuthzConfirmed] = useState(false);
  const [authzStatement, setAuthzStatement] = useState('');
  const [authzVersion, setAuthzVersion] = useState('');
  const [authzLoading, setAuthzLoading] = useState(false);

  const projects = fetchedProjects as any[];

  const allTools: Tool[] = useMemo(() => {
    if (!toolsData) return [];
    return Object.values((toolsData as any).categories || {}).flatMap((cat: any) =>
      cat.tools.map((t: any) => ({ ...t, slug: t.id }))
    );
  }, [toolsData]);

  function autoFillTarget(agent: Agent, mode: ScanMode) {
    if (mode === 'network') {
      if (agent.subnets && agent.subnets.length > 0) {
        setTarget(agent.subnets[0]);
        return;
      }
      if (!agent.ip_address) return;
      const parts = agent.ip_address.split('.');
      if (parts.length === 4) setTarget(`${parts[0]}.${parts[1]}.${parts[2]}.0/24`);
    } else {
      if (agent.ip_address) setTarget(agent.ip_address);
    }
  }

  useEffect(() => {
    if (!agentsListData) return;
    const list = agentsListData as Agent[];
    setAgents(list);
    const online = list.find(a => a.status === 'online');
    if (online) { setSelectedAgent(online.id); autoFillTarget(online, scanMode); }
  }, [agentsListData]);

  // Fetch the canonical ownership-confirmation statement for the current target.
  // The checkbox must be checked before the scan can start; every scan is
  // recorded in the audit log with this statement and a timestamp.
  useEffect(() => {
    let cancelled = false;
    const t = target.trim();
    setAuthzConfirmed(false);
    setAuthzStatement('');
    if (!t) return;
    const jwt = localStorage.getItem('token') || '';
    setAuthzLoading(true);
    fetch('/api/v1/authorizations/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
      body: JSON.stringify({ target: t }),
    })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setAuthzStatement(d.scope_statement || '');
        setAuthzVersion(d.statement_version || '');
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAuthzLoading(false); });
    return () => { cancelled = true; };
  }, [target]);

  function handleAgentChange(id: string) {
    setSelectedAgent(id);
    const agent = agents.find(a => a.id === id);
    if (agent) autoFillTarget(agent, scanMode);
    else setTarget('');
  }

  function handleModeChange(mode: ScanMode) {
    setScanMode(mode);
    const agent = agents.find(a => a.id === selectedAgent);
    if (agent) autoFillTarget(agent, mode);
    if (mode === 'network') setSelectedTool('nmap');
  }

  const selectedToolObj = allTools.find(t => t.id === selectedTool || t.slug === selectedTool);
  const canStart = (target.trim().length > 0 || (scanMode === 'network' && !!selectedAgent)) && selectedTool.length > 0 && authzConfirmed;

  const handleStart = async () => {
    if (selectedToolObj?.dangerous && !showDanger) { setShowDanger(true); return; }
    if (!authzConfirmed) { toast.error('You must confirm ownership before starting a scan.'); return; }
    setSubmitting(true);
    try {
      const authz = { confirmed: true, scope_statement: authzStatement, statement_version: authzVersion };
      if (scanMode === 'network') {
        const jwt = localStorage.getItem('token') || '';
        const res = await fetch('/api/v1/scans/network-sweep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
          body: JSON.stringify({ subnet: target.trim(), tool: selectedTool, agent_id: selectedAgent || null, project_id: projectId, authorization: authz }),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success('Network sweep started! Scans will appear as hosts are discovered.');
          navigate('/dashboard/scans');
        } else {
          toast.error(data.error || 'Failed to start sweep');
        }
      } else {
        const result = await startScanMutation.mutateAsync({
          tool: selectedTool,
          target: target.trim(),
          parameters: getSmartDefaults(selectedTool, 'standard'),
          agent_id: selectedAgent || null,
          project_id: projectId,
          authorization: authz,
        } as any);
        if ((result as any).success) {
          navigate(`/dashboard/scans/${(result as any).scan_id}`);
        } else {
          toast.error((result as any).error || 'Failed to start scan');
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to start scan');
    } finally {
      setSubmitting(false);
      setShowDanger(false);
    }
  };

  const filteredTools = toolSearch
    ? allTools.filter(t => t.name.toLowerCase().includes(toolSearch.toLowerCase()) || (t.description || '').toLowerCase().includes(toolSearch.toLowerCase()))
    : allTools;

  if (toolsLoading) return <NewScanPageSkeleton />;

  const onlineAgents = agents.filter(a => a.status === 'online');
  const selectedAgentObj = agents.find(a => a.id === selectedAgent);

  return (
    <PageTransition>
      <div className="p-vos-8 max-w-3xl mx-auto space-y-vos-5">
        <PageHeader
          eyebrow="Workflow"
          icon={<PlusCircle size={22} />}
          title="New Scan"
          description="Configure and launch a security scan"
        />

        {/* 1. Agent */}
        <Card>
          <SectionLabel icon={<Server size={13} />} text="Where to scan from" />
          {onlineAgents.length === 0 ? (
            <div className="flex items-center gap-vos-3 p-vos-3 rounded-vos-md bg-vos-warning/5 border border-vos-warning/20">
              <AlertTriangle size={14} className="text-vos-warning shrink-0" />
              <div>
                <p className="text-vos-sm text-vos-warning font-medium">No agents online</p>
                <p className="text-vos-xs text-vos-text-3">
                  Scans will run on the server.{' '}
                  <Link to="/dashboard/agents" className="text-vos-accent underline">Add an agent</Link>
                  {' '}to scan your local network.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-vos-2">
              <AgentCard
                active={selectedAgent === ''}
                onClick={() => handleAgentChange('')}
                icon={<Globe2 size={16} />}
                name="CyberSec Server"
                sub="Scan internet-facing targets"
                status="online"
              />
              {onlineAgents.map(agent => (
                <AgentCard
                  key={agent.id}
                  active={selectedAgent === agent.id}
                  onClick={() => handleAgentChange(agent.id)}
                  icon={<Monitor size={16} />}
                  name={agent.name}
                  sub={agent.ip_address || agent.platform}
                  status={agent.status}
                />
              ))}
            </div>
          )}
        </Card>

        {/* 2. Scan Mode + Target */}
        <Card>
          <SectionLabel icon={<Crosshair size={13} />} text="What to scan" />
          <div className="grid grid-cols-2 gap-vos-2 mb-vos-4">
            <ModeCard
              active={scanMode === 'single'}
              onClick={() => handleModeChange('single')}
              icon="🎯"
              title="Single Target"
              desc="One IP, domain, or URL"
            />
            <ModeCard
              active={scanMode === 'network'}
              onClick={() => handleModeChange('network')}
              icon="🌐"
              title="Network Sweep"
              desc={selectedAgentObj?.ip_address
                ? `Scan entire ${selectedAgentObj.ip_address.split('.').slice(0,3).join('.')}.x/24`
                : 'Discover & scan all hosts in subnet'}
              badge={selectedAgentObj ? 'Recommended' : undefined}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-1.5 block">
              {scanMode === 'network' ? 'Subnet (CIDR)' : 'Target'}
            </label>
            <input
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder={scanMode === 'network' ? (selectedAgent ? '10.0.0.0/24 (leave empty to use agent network)' : '10.0.0.0/24') : 'IP address, domain, or URL'}
              className="w-full px-vos-3 h-11 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text font-mono text-vos-sm placeholder:text-vos-text-muted focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30 transition-colors"
            />
            {scanMode === 'network' && (
              <p className="text-vos-xs text-vos-info mt-1.5">
                🔍 Discovers all live hosts first, then runs the selected tool on each one automatically.
              </p>
            )}
          </div>
        </Card>

        {/* 3. Tool */}
        <Card>
          <SectionLabel icon={<Zap size={13} />} text="Select tool" />
          {!showAllTools && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-vos-2 mb-vos-3">
              {QUICK_TOOLS.map(qt => (
                <button
                  key={qt.id}
                  onClick={() => setSelectedTool(qt.id)}
                  className={`flex flex-col items-start gap-0.5 p-vos-3 rounded-vos-md border text-left transition-colors ${
                    selectedTool === qt.id
                      ? 'border-vos-accent bg-vos-accent/10'
                      : 'border-vos-border-1 bg-vos-bg-elev-3 hover:border-vos-border-2'
                  }`}
                >
                  <span className="text-lg leading-none">{qt.icon}</span>
                  <span className={`text-vos-xs font-semibold mt-1 ${selectedTool === qt.id ? 'text-vos-accent' : 'text-vos-text'}`}>{qt.label}</span>
                  <span className="text-[10px] text-vos-text-3 leading-tight">{qt.desc}</span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowAllTools(v => !v)}
            className="text-vos-xs text-vos-accent hover:underline flex items-center gap-1"
          >
            {showAllTools ? 'Show quick picks' : 'Browse all tools'}
            <ChevronRight size={11} className={`transition-transform ${showAllTools ? 'rotate-90' : ''}`} />
          </button>
          {showAllTools && (
            <div className="space-y-vos-2 mt-vos-2">
              <label className="flex items-center gap-2 px-vos-3 h-9 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 focus-within:border-vos-accent transition-colors">
                <Search size={13} className="text-vos-text-3 shrink-0" />
                <input
                  type="search"
                  placeholder="Search tools…"
                  value={toolSearch}
                  onChange={e => setToolSearch(e.target.value)}
                  className="flex-1 bg-transparent border-0 outline-none text-vos-sm text-vos-text placeholder:text-vos-text-muted"
                />
                {toolSearch && <button onClick={() => setToolSearch('')}><X size={12} className="text-vos-text-3" /></button>}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto pr-1">
                {filteredTools.map(tool => {
                  const active = selectedTool === tool.id || selectedTool === tool.slug;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => setSelectedTool(tool.slug || tool.id)}
                      className={`p-vos-2 rounded-vos-sm border text-left transition-colors ${
                        active ? 'bg-vos-accent/10 border-vos-accent text-vos-accent' : 'bg-vos-bg-elev-3 border-vos-border-1 text-vos-text hover:border-vos-border-2'
                      }`}
                    >
                      <p className="text-vos-xs font-medium">{tool.name}</p>
                      {tool.dangerous && <span className="text-[9px] text-vos-danger uppercase">Dangerous</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* 4. Options */}
        {projects.length > 0 && (
          <Card>
            <SectionLabel icon={<Network size={13} />} text="Options" />
            <div>
              <label className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-1.5 block">Project (optional)</label>
              <select
                value={projectId || ''}
                onChange={e => setProjectId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-vos-3 h-10 bg-vos-bg-elev-3 border border-vos-border-1 rounded-vos-md text-vos-text text-vos-sm focus:outline-none focus:border-vos-accent transition-colors"
              >
                <option value="">No project</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </Card>
        )}

        {/* Ownership confirmation */}
        <div className={`flex items-start gap-vos-2 p-vos-3 rounded-vos-md border transition-colors ${authzConfirmed ? 'bg-vos-success/5 border-vos-success/25' : 'bg-vos-warning/5 border-vos-warning/20'}`}>
          {authzLoading
            ? <Loader2 size={13} className="text-vos-text-3 shrink-0 mt-0.5 animate-spin" />
            : authzConfirmed
              ? <CheckCircle2 size={13} className="text-vos-success shrink-0 mt-0.5" />
              : <ShieldAlert size={13} className="text-vos-warning shrink-0 mt-0.5" />
          }
          <label className="flex-1 cursor-pointer select-none">
            <span className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={authzConfirmed}
                onChange={e => setAuthzConfirmed(e.target.checked)}
                disabled={!target.trim() || authzLoading}
                className="mt-0.5 accent-vos-accent"
              />
              <span className="text-[11px] leading-relaxed">
                <span className="font-medium text-vos-text">I confirm that I own or have written authorization to test this target. </span>
                <span className="text-vos-text-3">{authzStatement || (authzLoading ? 'Loading authorization scope…' : 'Enter a target to load the authorization scope.')}</span>
              </span>
            </span>
            {authzStatement && (
              <span className="block mt-1 text-[10px] text-vos-text-3 font-mono">v{authzVersion} • This statement will be recorded in the audit log.</span>
            )}
          </label>
        </div>

        {/* Start */}
        <div className="flex items-center justify-between">
          <Link to="/dashboard/scans" className="text-vos-sm text-vos-text-3 hover:text-vos-text">Cancel</Link>
          <button
            onClick={handleStart}
            disabled={!canStart || submitting}
            className="inline-flex items-center gap-2 h-12 px-vos-8 rounded-vos-md bg-vos-accent text-white text-vos-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shadow-vos-elev-1"
          >
            {submitting
              ? <><Loader2 size={15} className="animate-spin" /> Starting…</>
              : <><Play size={15} /> {scanMode === 'network' ? 'Start Network Sweep' : 'Start Scan'}</>
            }
          </button>
        </div>
      </div>

      {/* Dangerous tool modal */}
      {showDanger && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-vos-4" onClick={() => setShowDanger(false)}>
          <div className="rounded-vos-2xl border border-vos-danger/40 bg-vos-bg-elev-2 max-w-md w-full p-vos-5 shadow-vos-elev-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-vos-3 mb-vos-4">
              <span className="size-10 rounded-vos-md bg-vos-danger/15 border border-vos-danger/30 flex items-center justify-center text-vos-danger">
                <AlertTriangle size={18} />
              </span>
              <div>
                <h3 className="text-vos-md font-semibold text-vos-text">Dangerous Tool</h3>
                <p className="text-vos-xs text-vos-text-3">{selectedTool} may actively exploit vulnerabilities</p>
              </div>
            </div>
            <ul className="text-vos-xs text-vos-danger/80 space-y-1 mb-vos-5">
              <li>• Only use on systems you own or have written permission to test</li>
              <li>• May trigger security alerts on target systems</li>
              <li>• All actions are logged for audit purposes</li>
            </ul>
            <div className="flex gap-vos-2">
              <button onClick={() => setShowDanger(false)} className="flex-1 h-10 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text text-vos-sm font-medium hover:bg-vos-bg-elev-4">Cancel</button>
              <button onClick={handleStart} className="flex-1 h-10 rounded-vos-md bg-vos-danger text-white text-vos-sm font-semibold hover:opacity-90">I Understand, Proceed</button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 p-vos-5 space-y-vos-3">{children}</div>;
}

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3">
      {icon}{text}
    </div>
  );
}

function AgentCard({ active, onClick, icon, name, sub, status }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; name: string; sub: string; status: string;
}) {
  return (
    <button onClick={onClick} className={`flex items-center gap-vos-3 p-vos-3 rounded-vos-md border text-left transition-colors ${active ? 'border-vos-accent bg-vos-accent/10' : 'border-vos-border-1 bg-vos-bg-elev-3 hover:border-vos-border-2'}`}>
      <span className={`size-9 rounded-vos-md flex items-center justify-center shrink-0 ${active ? 'bg-vos-accent/15 text-vos-accent' : 'bg-vos-bg-elev-4 text-vos-text-2'}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-vos-xs font-semibold truncate ${active ? 'text-vos-accent' : 'text-vos-text'}`}>{name}</p>
        <p className="text-[10px] text-vos-text-3 truncate font-mono">{sub}</p>
      </div>
      {status === 'online' && <span className="size-2 rounded-full bg-vos-success shrink-0" />}
      {active && <CheckCircle2 size={13} className="text-vos-accent shrink-0" />}
    </button>
  );
}

function ModeCard({ active, onClick, icon, title, desc, badge }: {
  active: boolean; onClick: () => void; icon: string; title: string; desc: string; badge?: string;
}) {
  return (
    <button onClick={onClick} className={`flex flex-col items-start gap-1 p-vos-4 rounded-vos-md border text-left transition-colors relative ${active ? 'border-vos-accent bg-vos-accent/10' : 'border-vos-border-1 bg-vos-bg-elev-3 hover:border-vos-border-2'}`}>
      {badge && <span className="absolute top-vos-2 right-vos-2 text-[9px] font-bold uppercase tracking-wide text-vos-success bg-vos-success/10 border border-vos-success/20 px-1.5 py-0.5 rounded">{badge}</span>}
      <span className="text-2xl">{icon}</span>
      <p className={`text-vos-sm font-semibold ${active ? 'text-vos-accent' : 'text-vos-text'}`}>{title}</p>
      <p className="text-vos-xs text-vos-text-3 leading-snug">{desc}</p>
    </button>
  );
}

export default NewScanPage;
