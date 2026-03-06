import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useToast } from '../../components/ui/Toast';

interface Project {
  id: string | number;
  name: string;
  description: string;
  target_type?: string;
  target_url?: string;
  target_ip?: string;
  target_count: number;
  scan_count: number;
  vulnerability_count: number;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at?: string;
  members?: { id: string; name: string; avatar?: string }[];
  tags?: string[];
}

export default function ProjectsPage() {
  useDocumentTitle('Projects — CyberSec Pro');
  const toast = useToast();
  const { token, organization } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectTags, setNewProjectTags] = useState('');

  // Check plan limits
  const userPlan = organization?.plan_type || 'trial';
  const planLimits: Record<string, number> = {
    trial: 1,
    starter: 1,
    professional: 5,
    team: 20,
    enterprise: Infinity,
  };
  const maxProjects = planLimits[userPlan] || 1;
  const canCreateProject = projects.length < maxProjects;

  useEffect(() => {
    fetchProjects();
  }, [token]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/v1/projects', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects((data.projects || []).map((p: Record<string, unknown>) => ({
          ...p,
          target_count: (p.target_count as number) || 0,
          scan_count: (p.scan_count as number) || 0,
          vulnerability_count: (p.vulnerability_count as number) || 0,
          status: (p.status as string) || 'active',
          tags: (p.tags as string[]) || [],
          members: (p.members as Project['members']) || [],
        })));
      }
    } catch (error) {
      toast.error('Load Failed', 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDesc,
        }),
      });
      if (res.ok) {
        fetchProjects();
      }
    } catch (error) {
      toast.error('Create Failed', 'Failed to create project');
    }
    setShowCreateModal(false);
    setNewProjectName('');
    setNewProjectDesc('');
    setNewProjectTags('');
  };

  const deleteProject = async (projectId: string | number) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setProjects(projects.filter(p => p.id !== projectId));
      }
    } catch (error) {
      toast.error('Delete Failed', 'Failed to delete project');
    }
  };

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/20';
      case 'completed': return 'text-blue-400 bg-blue-400/20';
      case 'archived': return 'text-gray-400 bg-gray-400/20';
    }
  };

  const filteredProjects = projects
    .filter(p => filter === 'all' || p.status === filter)
    .filter(p => 
      searchQuery === '' || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-kali-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Projects</h1>
          <p className="text-gray-400">
            Organize your security assessments into projects
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">
            {projects.length} / {maxProjects === Infinity ? '∞' : maxProjects} projects
          </span>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!canCreateProject}
            className="px-4 py-2 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex bg-gray-800 rounded-lg p-1">
          {(['all', 'active', 'completed', 'archived'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === f
                  ? 'bg-kali-blue text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue"
          />
          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Total Projects', value: projects.length, icon: '📁', color: 'text-white' },
          { label: 'Active', value: projects.filter(p => p.status === 'active').length, icon: '🟢', color: 'text-green-400' },
          { label: 'Total Targets', value: projects.reduce((sum, p) => sum + p.target_count, 0), icon: '🎯', color: 'text-kali-blue' },
          { label: 'Vulnerabilities', value: projects.reduce((sum, p) => sum + p.vulnerability_count, 0), icon: '⚠️', color: 'text-yellow-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-gray-400 text-sm">{stat.label}</span>
            </div>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No projects found</h3>
          <p className="text-gray-400 mb-6">
            {searchQuery ? 'Try adjusting your search' : 'Create your first project to get started'}
          </p>
          {!searchQuery && canCreateProject && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition"
            >
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-kali-blue/30 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-white">{project.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </div>
                  <p className="text-gray-400">{project.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/dashboard/projects/${project.id}`}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-8 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">Targets:</span>
                  <span className="text-white font-medium">{project.target_count}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">Scans:</span>
                  <span className="text-white font-medium">{project.scan_count}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">Vulnerabilities:</span>
                  <span className="text-yellow-400 font-medium">{project.vulnerability_count}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">Updated:</span>
                  <span className="text-white">{new Date(project.updated_at || project.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(project.tags || []).map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-gray-800 text-gray-400 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {(project.members || []).slice(0, 3).map((member) => (
                    <div
                      key={member.id}
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-kali-blue to-kali-purple flex items-center justify-center text-white text-xs font-bold -ml-2 first:ml-0 border-2 border-gray-900"
                      title={member.name}
                    >
                      {member.name.charAt(0)}
                    </div>
                  ))}
                  {(project.members || []).length > 3 && (
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 text-xs -ml-2 border-2 border-gray-900">
                      +{(project.members || []).length - 3}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upgrade Banner */}
      {!canCreateProject && (
        <div className="mt-8 p-6 bg-gradient-to-r from-kali-blue/20 to-kali-purple/20 rounded-xl border border-kali-blue/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Need more projects?</h3>
              <p className="text-gray-400">
                Upgrade your plan to create unlimited projects and collaborate with your team.
              </p>
            </div>
            <a
              href="/#pricing"
              className="px-6 py-3 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition"
            >
              Upgrade Plan
            </a>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-lg w-full border border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Create New Project</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Project Name *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., Q1 Security Audit"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue"
                />
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">Description</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Brief description of the project scope..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue resize-none"
                />
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={newProjectTags}
                  onChange={(e) => setNewProjectTags(e.target.value)}
                  placeholder="e.g., webapp, pentest, internal"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={createProject}
                  disabled={!newProjectName.trim()}
                  className="flex-1 py-3 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition disabled:opacity-50"
                >
                  Create Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
