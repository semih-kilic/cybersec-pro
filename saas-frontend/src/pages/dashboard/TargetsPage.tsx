import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { PageTransition } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useToast } from '../../components/ui/Toast';

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

interface TargetGroup {
  id: string;
  name: string;
  color: string;
  targets_count: number;
}

const typeIcons: { [key: string]: JSX.Element } = {
  ip: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  ),
  domain: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
  url: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  cidr: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  ),
  range: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
};

const typeLabels: { [key: string]: string } = {
  ip: 'IP Address',
  domain: 'Domain',
  url: 'URL',
  cidr: 'CIDR Range',
  range: 'IP Range',
};

export function TargetsPage() {
  useDocumentTitle('Targets — CyberSec Pro');
  const toast = useToast();
  const { token } = useAuth();
  const [targets, setTargets] = useState<Target[]>([]);
  const [groups, setGroups] = useState<TargetGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  // Add target form
  const [newTarget, setNewTarget] = useState({
    name: '',
    value: '',
    type: 'ip' as Target['type'],
    group_id: '',
    tags: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      // Fetch real targets from API
      const targetsRes = await fetch('/api/v1/targets', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (targetsRes.ok) {
        const data = await targetsRes.json();
        setTargets(data.targets || []);
      } else {
        setTargets([]);
      }

      // Fetch real groups from API
      const groupsRes = await fetch('/api/v1/target-groups', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (groupsRes.ok) {
        const data = await groupsRes.json();
        setGroups(data.groups || []);
      } else {
        setGroups([]);
      }
    } catch (error) {
      toast.error('Load Failed', 'Failed to fetch targets');
      setTargets([]);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTarget = async () => {
    try {
      // API call would go here
      const target: Target = {
        id: Date.now().toString(),
        name: newTarget.name,
        value: newTarget.value,
        type: newTarget.type,
        group_id: newTarget.group_id,
        group_name: groups.find(g => g.id === newTarget.group_id)?.name,
        tags: newTarget.tags.split(',').map(t => t.trim()).filter(Boolean),
        scans_count: 0,
        created_at: new Date().toISOString(),
        notes: newTarget.notes,
      };
      setTargets([target, ...targets]);
      setShowAddModal(false);
      setNewTarget({ name: '', value: '', type: 'ip', group_id: '', tags: '', notes: '' });
    } catch (error) {
      toast.error('Add Failed', 'Failed to add target');
    }
  };

  const handleDeleteTargets = async () => {
    setTargets(targets.filter(t => !selectedTargets.includes(t.id)));
    setSelectedTargets([]);
  };

  const filteredTargets = targets.filter(target => {
    const matchesSearch = 
      target.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      target.value.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = !selectedGroup || target.group_id === selectedGroup;
    const matchesType = !selectedType || target.type === selectedType;
    return matchesSearch && matchesGroup && matchesType;
  });

  const getRiskColor = (score?: number) => {
    if (!score) return 'text-gray-500';
    if (score >= 70) return 'text-red-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getGroupColor = (color: string) => {
    const colors: { [key: string]: string } = {
      red: 'bg-red-500',
      yellow: 'bg-yellow-500',
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      purple: 'bg-purple-500',
      orange: 'bg-orange-500',
    };
    return colors[color] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-kali-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="min-h-screen bg-gray-950">
      <Header 
        title="Targets"
        subtitle="Manage your scan targets and groups"
      />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">{targets.length}</p>
                <p className="text-sm text-gray-400">Total Targets</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-kali-blue/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-kali-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">{groups.length}</p>
                <p className="text-sm text-gray-400">Groups</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">{targets.reduce((sum, t) => sum + t.scans_count, 0)}</p>
                <p className="text-sm text-gray-400">Total Scans</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-400">
                  {targets.filter(t => (t.risk_score || 0) >= 70).length}
                </p>
                <p className="text-sm text-gray-400">High Risk</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search targets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
            />
            <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Group Filter */}
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedGroup(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                !selectedGroup ? 'bg-kali-blue text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            {groups.map(group => (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(selectedGroup === group.id ? null : group.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition flex items-center gap-2 ${
                  selectedGroup === group.id ? 'bg-kali-blue text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${getGroupColor(group.color)}`} />
                {group.name} ({group.targets_count})
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <select
            value={selectedType || ''}
            onChange={(e) => setSelectedType(e.target.value || null)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-kali-blue transition"
          >
            <option value="">All Types</option>
            <option value="ip">IP Address</option>
            <option value="domain">Domain</option>
            <option value="url">URL</option>
            <option value="cidr">CIDR Range</option>
            <option value="range">IP Range</option>
          </select>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-2 bg-gradient-to-r from-kali-blue to-kali-purple text-white font-medium rounded-lg hover:opacity-90 transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Target
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedTargets.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex items-center justify-between">
            <span className="text-white">{selectedTargets.length} targets selected</span>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-kali-blue text-white rounded-lg hover:bg-kali-blue/90 transition">
                Scan Selected
              </button>
              <button 
                onClick={handleDeleteTargets}
                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition"
              >
                Delete
              </button>
              <button 
                onClick={() => setSelectedTargets([])}
                className="px-4 py-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Targets Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                <th className="px-5 py-3 font-medium">
                  <input
                    type="checkbox"
                    checked={selectedTargets.length === filteredTargets.length && filteredTargets.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTargets(filteredTargets.map(t => t.id));
                      } else {
                        setSelectedTargets([]);
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-kali-blue focus:ring-kali-blue"
                  />
                </th>
                <th className="px-5 py-3 font-medium">Target</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Group</th>
                <th className="px-5 py-3 font-medium">Tags</th>
                <th className="px-5 py-3 font-medium">Scans</th>
                <th className="px-5 py-3 font-medium">Risk</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTargets.map((target) => (
                <tr key={target.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                  <td className="px-5 py-4">
                    <input
                      type="checkbox"
                      checked={selectedTargets.includes(target.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTargets([...selectedTargets, target.id]);
                        } else {
                          setSelectedTargets(selectedTargets.filter(id => id !== target.id));
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-kali-blue focus:ring-kali-blue"
                    />
                  </td>
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-white font-medium">{target.name}</p>
                      <p className="text-sm text-gray-400 font-mono">{target.value}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 text-gray-400">
                      {typeIcons[target.type]}
                      <span className="text-sm">{typeLabels[target.type]}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {target.group_name && (
                      <span className="inline-flex items-center gap-2 px-2 py-1 bg-gray-800 rounded text-sm text-gray-300">
                        <span className={`w-2 h-2 rounded-full ${getGroupColor(groups.find(g => g.id === target.group_id)?.color || 'gray')}`} />
                        {target.group_name}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(target.tags || []).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-400">
                    {target.scans_count}
                  </td>
                  <td className="px-5 py-4">
                    {target.risk_score !== undefined ? (
                      <span className={`font-medium ${getRiskColor(target.risk_score)}`}>
                        {target.risk_score}%
                      </span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <Link
                        to={`/dashboard/scans/new?target=${encodeURIComponent(target.value)}`}
                        className="p-2 bg-kali-blue/20 text-kali-blue hover:bg-kali-blue/30 rounded transition"
                        title="Scan"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </Link>
                      <button
                        className="p-2 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white rounded transition"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTargets.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No targets found</h3>
              <p className="text-gray-400 mb-4">Add your first target to start scanning.</p>
              <button 
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-6 py-2 bg-kali-blue text-white rounded-lg hover:bg-kali-blue/90 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Target
              </button>
            </div>
          )}
        </div>

        {/* Add Target Modal */}
        {showAddModal && (
          <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <div 
              className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="text-xl font-semibold text-white">Add Target</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Name</label>
                  <input
                    type="text"
                    value={newTarget.name}
                    onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })}
                    placeholder="Production Server"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Value</label>
                  <input
                    type="text"
                    value={newTarget.value}
                    onChange={(e) => setNewTarget({ ...newTarget, value: e.target.value })}
                    placeholder="192.168.1.1 or example.com"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Type</label>
                    <select
                      value={newTarget.type}
                      onChange={(e) => setNewTarget({ ...newTarget, type: e.target.value as Target['type'] })}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-kali-blue transition"
                    >
                      <option value="ip">IP Address</option>
                      <option value="domain">Domain</option>
                      <option value="url">URL</option>
                      <option value="cidr">CIDR Range</option>
                      <option value="range">IP Range</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Group</label>
                    <select
                      value={newTarget.group_id}
                      onChange={(e) => setNewTarget({ ...newTarget, group_id: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-kali-blue transition"
                    >
                      <option value="">No Group</option>
                      {groups.map(group => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={newTarget.tags}
                    onChange={(e) => setNewTarget({ ...newTarget, tags: e.target.value })}
                    placeholder="web, production, critical"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Notes</label>
                  <textarea
                    value={newTarget.notes}
                    onChange={(e) => setNewTarget({ ...newTarget, notes: e.target.value })}
                    placeholder="Additional notes about this target..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTarget}
                  disabled={!newTarget.name || !newTarget.value}
                  className="px-6 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white rounded-lg transition disabled:opacity-50"
                >
                  Add Target
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowImportModal(false)}
          >
            <div 
              className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="text-xl font-semibold text-white">Import Targets</h2>
                <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-kali-blue transition cursor-pointer">
                  <svg className="w-12 h-12 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-white mb-2">Drop a file here or click to upload</p>
                  <p className="text-sm text-gray-500">Supports CSV, TXT, JSON formats</p>
                </div>

                <div className="mt-4">
                  <p className="text-sm text-gray-400 mb-2">Or paste targets (one per line):</p>
                  <textarea
                    placeholder="192.168.1.1&#10;example.com&#10;10.0.0.0/24"
                    rows={6}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition font-mono text-sm resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button className="px-6 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white rounded-lg transition">
                  Import
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </PageTransition>
  );
}

export default TargetsPage;
