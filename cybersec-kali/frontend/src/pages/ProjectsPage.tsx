import { useState, useEffect } from 'react';
import { 
  FolderKanban, Plus, Calendar, Target, Users, Clock,
  CheckCircle, AlertTriangle, XCircle, MoreVertical,
  Trash2, Play, Pause, Eye, FileText, Shield
} from 'lucide-react';
import axios from 'axios';
import { apiUrl } from '../config/api';

interface Project {
  id: number;
  name: string;
  description: string;
  client: string;
  status: 'planning' | 'active' | 'paused' | 'completed';
  start_date: string;
  end_date?: string;
  targets: string[];
  scope: string[];
  findings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  progress: number;
  team: string[];
  created_at: string;
  updated_at?: string;
  targets_count?: number;
  scans_count?: number;
  reports_count?: number;
}

interface ProjectScan {
  id: number;
  name: string;
  status: string;
  tool_name?: string | null;
  target: string;
  created_at?: string | null;
}

interface ProjectReport {
  id: number;
  name: string;
  type?: string | null;
  created_at?: string | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('projects:view');
    return saved === 'list' ? 'list' : 'grid';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projectScans, setProjectScans] = useState<ProjectScan[]>([]);
  const [projectReports, setProjectReports] = useState<ProjectReport[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Project['status']>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'name'>('updated');

  const normalizeProject = (project: Partial<Project>): Project | null => {
    if (project.id === undefined || project.id === null) {
      return null;
    }
    const targets = Array.isArray(project.targets) ? project.targets : [];
    const scope = Array.isArray(project.scope) ? project.scope : [];
    const team = Array.isArray(project.team) ? project.team : [];
    return {
      id: project.id,
      name: project.name ?? 'Untitled Project',
      description: project.description ?? '',
      client: project.client ?? '',
      status: project.status ?? 'planning',
      start_date: project.start_date ?? new Date().toISOString().split('T')[0],
      end_date: project.end_date,
      targets,
      scope,
      findings: project.findings ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      progress: project.progress ?? 0,
      team,
      created_at: project.created_at ?? new Date().toISOString(),
      updated_at: project.updated_at,
      targets_count: project.targets_count,
      scans_count: project.scans_count,
      reports_count: project.reports_count
    };
  };

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client: '',
    targets: '',
    scope: '',
    start_date: new Date().toISOString().split('T')[0],
    team: ''
  });

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const search = params.get('q') || '';
    const status = params.get('status') || 'all';
    setSearchTerm(search);
    if (status === 'planning' || status === 'active' || status === 'paused' || status === 'completed' || status === 'all') {
      setStatusFilter(status as typeof statusFilter);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('projects:view', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (searchTerm) {
      params.set('q', searchTerm);
    } else {
      params.delete('q');
    }
    if (statusFilter !== 'all') {
      params.set('status', statusFilter);
    } else {
      params.delete('status');
    }
    const next = params.toString();
    const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const loadProjectDetails = async () => {
      if (!selectedProject) return;
      setDetailsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const [scansResponse, reportsResponse] = await Promise.all([
          axios.get(apiUrl(`/api/projects/${selectedProject.id}/scans?limit=5`), { headers }),
          axios.get(apiUrl(`/api/projects/${selectedProject.id}/reports?limit=5`), { headers })
        ]);
        setProjectScans(Array.isArray(scansResponse.data?.scans) ? scansResponse.data.scans : []);
        setProjectReports(Array.isArray(reportsResponse.data?.reports) ? reportsResponse.data.reports : []);
      } catch (error) {
        console.error('Failed to load project details:', error);
        setProjectScans([]);
        setProjectReports([]);
      } finally {
        setDetailsLoading(false);
      }
    };

    loadProjectDetails();
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      const response = await axios.get(apiUrl('/api/projects'));
      const rawProjects = Array.isArray(response.data.projects) ? response.data.projects : [];
      const normalized = rawProjects
        .map((project: Partial<Project>) => normalizeProject(project))
        .filter((project): project is Project => Boolean(project));
      setProjects(normalized);
      setErrorMessage(null);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setErrorMessage('Failed to load projects. Please check the backend service.');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const addProject = async () => {
    try {
      if (!formData.name.trim()) {
        setErrorMessage('Project name is required.');
        return;
      }

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        client: formData.client.trim(),
        start_date: formData.start_date,
        targets: formData.targets.split(',').map(t => t.trim()).filter(Boolean),
        scope: formData.scope.split(',').map(s => s.trim()).filter(Boolean),
        team: formData.team.split(',').map(t => t.trim()).filter(Boolean)
      };

      const response = await axios.post(apiUrl('/api/projects'), payload);
      const createdProject = response.data?.project ?? response.data;
      const normalized = normalizeProject(createdProject);
      if (normalized) {
        setProjects(prev => [normalized, ...prev]);
      } else {
        await loadProjects();
      }
      
      setShowAddModal(false);
      resetForm();
      setErrorMessage(null);
    } catch (error) {
      console.error('Failed to add project:', error);
      setErrorMessage('Failed to create project. Please try again.');
    }
  };

  const deleteProject = async (projectId: number) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await axios.delete(apiUrl(`/api/projects/${projectId}`));
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (error) {
      console.error('Failed to delete project:', error);
      setErrorMessage('Failed to delete project. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      client: '',
      targets: '',
      scope: '',
      start_date: new Date().toISOString().split('T')[0],
      team: ''
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'planning': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'paused': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'completed': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Play className="w-4 h-4" />;
      case 'planning': return <Clock className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getTotalFindings = (findings: Project['findings']) => {
    return findings.critical + findings.high + findings.medium + findings.low + findings.info;
  };

  const getTargetsCount = (project: Project) => {
    return project.targets_count ?? project.targets.length;
  };

  const getScansCount = (project: Project) => {
    return project.scans_count ?? 0;
  };

  const getReportsCount = (project: Project) => {
    return project.reports_count ?? 0;
  };

  const formatUpdatedAt = (project: Project) => {
    const updated = project.updated_at || project.created_at;
    return updated ? new Date(updated).toLocaleDateString() : '—';
  };

  const filteredProjects = projects.filter((project) => {
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return matchesStatus;
    const blob = [project.name, project.client, project.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return matchesStatus && blob.includes(needle);
  }).sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    const aDate = sortBy === 'created' ? a.created_at : (a.updated_at || a.created_at);
    const bDate = sortBy === 'created' ? b.created_at : (b.updated_at || b.created_at);
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl gradient-text animate-pulse">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {errorMessage && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
          {errorMessage}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
            <FolderKanban className="w-8 h-8" />
            Project Management
          </h1>
          <p className="text-gray-400 mt-2">Manage your security testing projects and engagements</p>
        </div>
        
        <div className="flex gap-4">
          <div className="flex bg-dark-card rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded ${viewMode === 'grid' ? 'bg-primary text-dark-bg' : ''}`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded ${viewMode === 'list' ? 'bg-primary text-dark-bg' : ''}`}
            >
              List
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-primary to-secondary text-dark-bg rounded-lg font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 md:items-center">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search projects by name, client, or description"
          className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm"
        >
          <option value="updated">Sort: Updated</option>
          <option value="created">Sort: Created</option>
          <option value="name">Sort: Name</option>
        </select>
        <div className="text-xs text-gray-500">{filteredProjects.length} projects</div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { label: 'All', value: 'all' },
          { label: 'Active', value: 'active' },
          { label: 'Planning', value: 'planning' },
          { label: 'Paused', value: 'paused' },
          { label: 'Completed', value: 'completed' }
        ].map((chip) => (
          <button
            key={chip.value}
            onClick={() => setStatusFilter(chip.value as typeof statusFilter)}
            className={`px-3 py-1 rounded-full text-xs border ${statusFilter === chip.value
              ? 'border-primary text-primary bg-primary/10'
              : 'border-dark-border text-gray-400 hover:border-primary/60'}
            `}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="glass rounded-xl p-4 mb-8 flex flex-col md:flex-row gap-4 md:items-center justify-between text-sm text-gray-300">
        <div>
          <span className="text-gray-400">Health summary:</span> {projects.filter(p => p.status === 'active').length} active • {projects.reduce((acc, p) => acc + getTotalFindings(p.findings), 0)} findings • {projects.reduce((acc, p) => acc + getTargetsCount(p), 0)} targets
        </div>
        <div className="text-gray-500">Updated {new Date().toLocaleTimeString()}</div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <FolderKanban className="w-8 h-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{projects.length}</div>
              <div className="text-gray-400 text-sm">Total Projects</div>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Play className="w-8 h-8 text-green-400" />
            <div>
              <div className="text-2xl font-bold">{projects.filter(p => p.status === 'active').length}</div>
              <div className="text-gray-400 text-sm">Active</div>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <div>
              <div className="text-2xl font-bold">{projects.reduce((acc, p) => acc + p.findings.critical, 0)}</div>
              <div className="text-gray-400 text-sm">Critical Findings</div>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Target className="w-8 h-8 text-orange-400" />
            <div>
              <div className="text-2xl font-bold">{projects.reduce((acc, p) => acc + getTargetsCount(p), 0)}</div>
              <div className="text-gray-400 text-sm">Targets</div>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-gray-400" />
            <div>
              <div className="text-2xl font-bold">{projects.filter(p => p.status === 'completed').length}</div>
              <div className="text-gray-400 text-sm">Completed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <FolderKanban className="w-14 h-14 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No projects yet</h2>
          <p className="text-gray-400 mb-6">Create your first project to start organizing scans, targets, and reports.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-primary to-secondary text-dark-bg rounded-lg font-bold inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
          : 'space-y-4'
        }>
          {filteredProjects.map((project) => (
          <div 
            key={project.id} 
            className={`glass rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-all ${
              viewMode === 'list' ? 'flex items-center' : ''
            }`}
            onClick={() => setSelectedProject(project)}
          >
            {viewMode === 'grid' ? (
              <>
                {/* Grid View */}
                <div className="p-4 border-b border-dark-border">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{project.name}</h3>
                      <p className="text-gray-400 text-sm">{project.client || 'No client assigned'}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-xs border flex items-center gap-1 ${getStatusColor(project.status)}`}>
                      {getStatusIcon(project.status)}
                      {project.status}
                    </span>
                  </div>
                </div>
                
                <div className="p-4 space-y-4">
                  <p className="text-gray-400 text-sm line-clamp-2">{project.description}</p>
                  
                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Progress</span>
                      <span>{project.progress}%</span>
                    </div>
                    <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-secondary"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Findings Summary */}
                  <div className="flex gap-2">
                    {project.findings.critical > 0 && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">
                        {project.findings.critical} Critical
                      </span>
                    )}
                    {project.findings.high > 0 && (
                      <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">
                        {project.findings.high} High
                      </span>
                    )}
                    {getTotalFindings(project.findings) === 0 && (
                      <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded text-xs">
                        No findings yet
                      </span>
                    )}
                  </div>

                  {/* Targets */}
                  <div className="flex flex-wrap gap-1">
                    {project.targets.slice(0, 2).map((target, i) => (
                      <span key={`${project.id}-target-${target}-${i}`} className="text-xs px-2 py-0.5 bg-dark-bg rounded font-mono">
                        {target}
                      </span>
                    ))}
                    {project.targets.length > 2 && (
                      <span className="text-xs px-2 py-0.5 bg-dark-bg rounded">
                        +{project.targets.length - 2} more
                      </span>
                    )}
                    {project.targets.length === 0 && (
                      <span className="text-xs px-2 py-0.5 bg-dark-bg rounded text-gray-400">
                        No targets yet
                      </span>
                    )}
                  </div>

                  {/* Linked Data */}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                    <span className="px-2 py-0.5 bg-dark-bg rounded">{getScansCount(project)} scans</span>
                    <span className="px-2 py-0.5 bg-dark-bg rounded">{getReportsCount(project)} reports</span>
                    <span className="px-2 py-0.5 bg-dark-bg rounded">{getTargetsCount(project)} targets</span>
                    <span className="px-2 py-0.5 bg-dark-bg rounded">{project.scope.length} scope</span>
                    <span className="px-2 py-0.5 bg-dark-bg rounded">Owner: {project.client || 'You'}</span>
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(project.start_date).toLocaleDateString()}</span>
                    {project.end_date && (
                      <>
                        <span>-</span>
                        <span>{new Date(project.end_date).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Updated {formatUpdatedAt(project)}</span>
                    <span>Activity: {getScansCount(project)} scans • {getReportsCount(project)} reports</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-dark-border flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); window.location.href = `/scans?project=${project.id}`; }}
                    className="flex-1 py-2 bg-gradient-to-r from-primary to-secondary text-dark-bg rounded-lg font-bold flex items-center justify-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    Start Scan
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.location.href = `/reports?project=${project.id}`; }}
                    className="px-3 py-2 bg-dark-bg rounded-lg hover:bg-dark-card text-xs"
                  >
                    Reports
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); }}
                    className="p-2 bg-dark-bg rounded-lg hover:bg-dark-card"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
                    className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* List View */}
                <div className="p-4 flex-1 flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${getStatusColor(project.status).split(' ')[0]}`}>
                    <FolderKanban className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{project.name}</h3>
                    <p className="text-gray-400 text-sm">{project.client || 'No client assigned'}</p>
                    <p className="text-xs text-gray-500 mt-1">Updated {formatUpdatedAt(project)} • {getScansCount(project)} scans • {getReportsCount(project)} reports</p>
                  </div>
                  <div className="text-center px-4">
                    <div className="text-lg font-bold">{project.progress}%</div>
                    <div className="text-xs text-gray-400">Progress</div>
                  </div>
                  <div className="text-center px-4">
                    <div className="text-lg font-bold text-red-400">{project.findings.critical}</div>
                    <div className="text-xs text-gray-400">Critical</div>
                  </div>
                  <div className="text-center px-4">
                    <div className="text-lg font-bold">{getTotalFindings(project.findings)}</div>
                    <div className="text-xs text-gray-400">Findings</div>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-sm ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                  <button className="p-2 hover:bg-dark-bg rounded-lg">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>
          ))}

          {/* Add Project Card - Only in grid view */}
          {viewMode === 'grid' && (
            <div 
              onClick={() => setShowAddModal(true)}
              className="glass rounded-xl border-2 border-dashed border-dark-border hover:border-primary cursor-pointer min-h-[300px] flex items-center justify-center"
            >
              <div className="text-center">
                <Plus className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400">Create New Project</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-border">
              <h2 className="text-xl font-bold">Create New Project</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Project Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Network Security Assessment"
                  className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the project scope and objectives..."
                  rows={3}
                  className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Client</label>
                  <input
                    type="text"
                    value={formData.client}
                    onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                    placeholder="Client Name"
                    className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Targets (comma separated)</label>
                <input
                  type="text"
                  value={formData.targets}
                  onChange={(e) => setFormData({ ...formData, targets: e.target.value })}
                  placeholder="10.0.0.115, 192.168.1.0/24, webapp.example.com"
                  className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Scope (comma separated)</label>
                <input
                  type="text"
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                  placeholder="Port scanning, Vulnerability assessment, Exploitation"
                  className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Team Members (comma separated)</label>
                <input
                  type="text"
                  value={formData.team}
                  onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                  placeholder="John, Alice, Bob"
                  className="w-full p-3 bg-dark-bg border border-dark-border rounded-lg"
                />
              </div>
            </div>
            <div className="p-6 border-t border-dark-border flex gap-4">
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="flex-1 py-2 bg-dark-bg border border-dark-border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={addProject}
                disabled={!formData.name}
                className="flex-1 py-2 bg-gradient-to-r from-primary to-secondary text-dark-bg rounded-lg font-bold disabled:opacity-50"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{selectedProject.name}</h2>
                <p className="text-gray-400">{selectedProject.client || 'No client assigned'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-lg ${getStatusColor(selectedProject.status)}`}>
                  {selectedProject.status}
                </span>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-2 hover:bg-dark-bg rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-dark-bg rounded-lg">
                  <div className="text-xs text-gray-400">Scans</div>
                  <div className="text-xl font-bold">{getScansCount(selectedProject)}</div>
                </div>
                <div className="p-4 bg-dark-bg rounded-lg">
                  <div className="text-xs text-gray-400">Reports</div>
                  <div className="text-xl font-bold">{getReportsCount(selectedProject)}</div>
                </div>
                <div className="p-4 bg-dark-bg rounded-lg">
                  <div className="text-xs text-gray-400">Targets</div>
                  <div className="text-xl font-bold">{getTargetsCount(selectedProject)}</div>
                </div>
              </div>
              {/* Description */}
              <div>
                <h3 className="font-bold mb-2">Description</h3>
                <p className="text-gray-400">{selectedProject.description}</p>
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between mb-2">
                  <h3 className="font-bold">Progress</h3>
                  <span>{selectedProject.progress}%</span>
                </div>
                <div className="h-3 bg-dark-bg rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-secondary"
                    style={{ width: `${selectedProject.progress}%` }}
                  />
                </div>
              </div>

              {/* Findings */}
              <div>
                <h3 className="font-bold mb-2">Findings</h3>
                <div className="grid grid-cols-5 gap-4">
                  <div className="p-3 bg-red-500/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-400">{selectedProject.findings.critical}</div>
                    <div className="text-xs text-gray-400">Critical</div>
                  </div>
                  <div className="p-3 bg-orange-500/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-400">{selectedProject.findings.high}</div>
                    <div className="text-xs text-gray-400">High</div>
                  </div>
                  <div className="p-3 bg-yellow-500/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-400">{selectedProject.findings.medium}</div>
                    <div className="text-xs text-gray-400">Medium</div>
                  </div>
                  <div className="p-3 bg-blue-500/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-400">{selectedProject.findings.low}</div>
                    <div className="text-xs text-gray-400">Low</div>
                  </div>
                  <div className="p-3 bg-gray-500/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-400">{selectedProject.findings.info}</div>
                    <div className="text-xs text-gray-400">Info</div>
                  </div>
                </div>
              </div>

              {/* Targets */}
              <div>
                <h3 className="font-bold mb-2">Targets</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedProject.targets.map((target, i) => (
                    <span key={`${selectedProject.id}-target-${target}-${i}`} className="px-3 py-1 bg-dark-bg rounded-lg font-mono text-sm">
                      {target}
                    </span>
                  ))}
                </div>
              </div>

              {/* Scope */}
              <div>
                <h3 className="font-bold mb-2">Scope</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedProject.scope.map((item, i) => (
                    <span key={`${selectedProject.id}-scope-${item}-${i}`} className="px-3 py-1 bg-primary/20 text-primary rounded-lg text-sm">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="font-bold mb-2">Timeline</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>Start: {new Date(selectedProject.start_date).toLocaleDateString()}</span>
                  </div>
                  {selectedProject.end_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>End: {new Date(selectedProject.end_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Team */}
              <div>
                <h3 className="font-bold mb-2">Team</h3>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span>{selectedProject.team.join(', ')}</span>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold mb-2">Recent Scans</h3>
                  <div className="space-y-2">
                    {detailsLoading && (
                      <div className="text-sm text-gray-400">Loading scans…</div>
                    )}
                    {!detailsLoading && projectScans.length === 0 && (
                      <div className="text-sm text-gray-500">No scans for this project yet.</div>
                    )}
                    {projectScans.map(scan => (
                      <div key={scan.id} className="p-3 bg-dark-bg rounded-lg flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{scan.name}</div>
                          <div className="text-xs text-gray-400">{scan.tool_name || 'Tool'} • {scan.target}</div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded bg-dark-card text-gray-300">{scan.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold mb-2">Recent Reports</h3>
                  <div className="space-y-2">
                    {detailsLoading && (
                      <div className="text-sm text-gray-400">Loading reports…</div>
                    )}
                    {!detailsLoading && projectReports.length === 0 && (
                      <div className="text-sm text-gray-500">No reports for this project yet.</div>
                    )}
                    {projectReports.map(report => (
                      <div key={report.id} className="p-3 bg-dark-bg rounded-lg flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{report.name}</div>
                          <div className="text-xs text-gray-400">{report.type || 'report'} • {report.created_at ? new Date(report.created_at).toLocaleDateString() : '—'}</div>
                        </div>
                        <button
                          onClick={() => { window.location.href = `/reports?project=${selectedProject.id}`; }}
                          className="text-xs px-2 py-1 rounded bg-primary/20 text-primary"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-dark-border flex gap-4">
              <button
                onClick={() => setSelectedProject(null)}
                className="flex-1 py-2 bg-dark-bg border border-dark-border rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => { window.location.href = '/audit'; }}
                className="flex-1 py-2 bg-dark-bg border border-dark-border rounded-lg"
              >
                View Audit Logs
              </button>
              <button
                onClick={() => { window.location.href = `/scans?project=${selectedProject.id}`; }}
                className="flex-1 py-2 bg-gradient-to-r from-primary to-secondary text-dark-bg rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Start Scan
              </button>
              <button
                onClick={() => { window.location.href = `/reports?project=${selectedProject.id}`; }}
                className="flex-1 py-2 bg-dark-bg border border-primary text-primary rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Generate Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
