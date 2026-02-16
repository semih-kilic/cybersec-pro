import { useState, useEffect } from 'react';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';

interface ScheduledScan {
  id: string;
  name: string;
  tool_name: string;
  tool?: string;
  target: string;
  schedule_type: string;
  cron_expression?: string;
  hour?: number;
  minute?: number;
  day_of_week?: string;
  day_of_month?: number;
  next_run: string;
  last_run?: string;
  is_active: boolean;
  status?: 'active' | 'paused' | 'error';
  run_count: number;
  created_at: string;
}

const presetSchedules = [
  { label: 'Every hour', value: '0 * * * *', description: 'At minute 0 of every hour' },
  { label: 'Every 6 hours', value: '0 */6 * * *', description: 'At 00:00, 06:00, 12:00, 18:00' },
  { label: 'Daily', value: '0 0 * * *', description: 'Every day at midnight' },
  { label: 'Weekly', value: '0 0 * * 0', description: 'Every Sunday at midnight' },
  { label: 'Monthly', value: '0 0 1 * *', description: 'First day of every month' },
  { label: 'Custom', value: 'custom', description: 'Define your own schedule' },
];

export function SchedulePage() {
  const { token } = useAuth();
  const [schedules, setSchedules] = useState<ScheduledScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledScan | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    tool: '',
    target: '',
    schedulePreset: 'daily',
    customCron: '',
    notifications: true,
  });

  useEffect(() => {
    fetchSchedules();
  }, [token]);

  const fetchSchedules = async () => {
    try {
      // Fetch real schedules from API
      const res = await fetch('/api/v1/schedules', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      } else {
        setSchedules([]);
      }
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (schedule: ScheduledScan) => {
    try {
      const res = await fetch(`/api/v1/schedules/${schedule.id}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        fetchSchedules();
      }
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Delete this scheduled scan?')) return;
    try {
      const res = await fetch(`/api/v1/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setSchedules(schedules.filter(s => s.id !== scheduleId));
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  };

  const handleRunNow = async (schedule: ScheduledScan) => {
    try {
      const res = await fetch('/api/v1/scan/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          tool: schedule.tool_name || schedule.tool,
          target: schedule.target,
        }),
      });
      if (res.ok) {
        alert(`${schedule.name} scan started!`);
      }
    } catch (error) {
      console.error('Failed to start scan:', error);
    }
  };

  const getScheduleStatus = (s: ScheduledScan): 'active' | 'paused' | 'error' => {
    if (s.status) return s.status;
    return s.is_active ? 'active' : 'paused';
  };

  const handleSave = async () => {
    try {
      const schedPreset = presetSchedules.find(p => p.label.toLowerCase() === formData.schedulePreset.toLowerCase());
      const cronExpr = formData.schedulePreset === 'custom' ? formData.customCron : schedPreset?.value;
      
      const body: Record<string, unknown> = {
        name: formData.name,
        tool_name: formData.tool,
        target: formData.target,
        schedule_type: formData.schedulePreset === 'custom' ? 'cron' : formData.schedulePreset,
        cron_expression: cronExpr,
      };
      
      const url = editingSchedule 
        ? `/api/v1/schedules/${editingSchedule.id}` 
        : '/api/v1/schedules';
      const method = editingSchedule ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        fetchSchedules();
      }
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
    setShowNewModal(false);
    setEditingSchedule(null);
    setFormData({ name: '', tool: '', target: '', schedulePreset: 'daily', customCron: '', notifications: true });
  };

  const getStatusBadge = (status: ScheduledScan['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Active
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
            Paused
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
            Error
          </span>
        );
    }
  };

  const formatSchedule = (cron: string) => {
    const preset = presetSchedules.find(p => p.value === cron);
    return preset?.label || cron;
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) {
      const absDiff = Math.abs(diff);
      if (absDiff < 3600000) return `${Math.floor(absDiff / 60000)}m ago`;
      if (absDiff < 86400000) return `${Math.floor(absDiff / 3600000)}h ago`;
      return `${Math.floor(absDiff / 86400000)}d ago`;
    } else {
      if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`;
      if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`;
      return `in ${Math.floor(diff / 86400000)}d`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-kali-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Header 
        title="Schedule"
        subtitle="Automate recurring security scans"
      />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">{schedules.length}</p>
                <p className="text-sm text-gray-400">Scheduled Scans</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-kali-blue/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-kali-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-400">
                  {schedules.filter(s => getScheduleStatus(s) === 'active').length}
                </p>
                <p className="text-sm text-gray-400">Active</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">
                  {schedules.reduce((sum, s) => sum + (s.run_count || 0), 0)}
                </p>
                <p className="text-sm text-gray-400">Total Runs</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-400">
                  {schedules.filter(s => getScheduleStatus(s) === 'active' && s.next_run).length > 0
                    ? formatRelativeTime(schedules.filter(s => getScheduleStatus(s) === 'active').sort((a, b) => 
                        new Date(a.next_run).getTime() - new Date(b.next_run).getTime()
                      )[0].next_run)
                    : '-'
                  }
                </p>
                <p className="text-sm text-gray-400">Next Scan</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Add Button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setShowNewModal(true)}
            className="px-6 py-2 bg-gradient-to-r from-kali-blue to-kali-purple text-white font-medium rounded-lg hover:opacity-90 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Schedule Scan
          </button>
        </div>

        {/* Schedules List */}
        <div className="space-y-4">
          {schedules.map((schedule) => (
            <div 
              key={schedule.id}
              className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-white font-semibold">{schedule.name}</h3>
                    {getStatusBadge(getScheduleStatus(schedule))}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {schedule.tool_name || schedule.tool}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-xs">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      {schedule.target}
                    </span>
                  </div>
                </div>

                {/* Schedule */}
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="flex items-center gap-2 text-white">
                      <svg className="w-5 h-5 text-kali-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">{formatSchedule(schedule.cron_expression || schedule.schedule_type || '')}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Schedule</p>
                  </div>

                  <div className="text-center">
                    <p className="text-white font-medium">
                      {getScheduleStatus(schedule) === 'active' ? formatRelativeTime(schedule.next_run) : '-'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Next Run</p>
                  </div>

                  <div className="text-center">
                    <p className="text-white font-medium">{schedule.run_count || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Runs</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 lg:ml-4">
                  <button
                    onClick={() => handleRunNow(schedule)}
                    className="p-2 bg-kali-blue/20 text-kali-blue hover:bg-kali-blue/30 rounded-lg transition"
                    title="Run Now"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleToggleStatus(schedule)}
                    className={`p-2 rounded-lg transition ${
                      getScheduleStatus(schedule) === 'active'
                        ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    }`}
                    title={getScheduleStatus(schedule) === 'active' ? 'Pause' : 'Resume'}
                  >
                    {getScheduleStatus(schedule) === 'active' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditingSchedule(schedule);
                      setShowNewModal(true);
                    }}
                    className="p-2 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition"
                    title="Edit"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className="p-2 bg-gray-800 text-gray-400 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {schedules.length === 0 && (
          <div className="text-center py-16 bg-gray-900 rounded-xl border border-gray-800">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No scheduled scans</h3>
            <p className="text-gray-400 mb-4">Schedule recurring security scans to automate your workflow.</p>
            <button 
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-6 py-2 bg-kali-blue text-white rounded-lg hover:bg-kali-blue/90 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Schedule Scan
            </button>
          </div>
        )}

        {/* New/Edit Modal */}
        {showNewModal && (
          <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowNewModal(false);
              setEditingSchedule(null);
            }}
          >
            <div 
              className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="text-xl font-semibold text-white">
                  {editingSchedule ? 'Edit Schedule' : 'Schedule Scan'}
                </h2>
                <button 
                  onClick={() => {
                    setShowNewModal(false);
                    setEditingSchedule(null);
                  }} 
                  className="text-gray-400 hover:text-white"
                >
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
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Weekly Network Scan"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Tool</label>
                    <select
                      value={formData.tool}
                      onChange={(e) => setFormData({ ...formData, tool: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-kali-blue transition"
                    >
                      <option value="">Select tool...</option>
                      <option value="nmap">nmap</option>
                      <option value="nikto">nikto</option>
                      <option value="sqlmap">sqlmap</option>
                      <option value="gobuster">gobuster</option>
                      <option value="wpscan">wpscan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Target</label>
                    <input
                      type="text"
                      value={formData.target}
                      onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                      placeholder="192.168.1.0/24"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Schedule</label>
                  <div className="grid grid-cols-3 gap-2">
                    {presetSchedules.map(preset => (
                      <button
                        key={preset.value}
                        onClick={() => setFormData({ ...formData, schedulePreset: preset.value })}
                        className={`p-3 rounded-lg border text-left transition ${
                          formData.schedulePreset === preset.value
                            ? 'bg-kali-blue/20 border-kali-blue'
                            : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <p className="text-sm text-white font-medium">{preset.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{preset.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {formData.schedulePreset === 'custom' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Cron Expression</label>
                    <input
                      type="text"
                      value={formData.customCron}
                      onChange={(e) => setFormData({ ...formData, customCron: e.target.value })}
                      placeholder="0 0 * * *"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Format: minute hour day month weekday
                    </p>
                  </div>
                )}

                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={formData.notifications}
                        onChange={(e) => setFormData({ ...formData, notifications: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition ${formData.notifications ? 'bg-kali-blue' : 'bg-gray-700'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.notifications ? 'left-5' : 'left-1'}`} />
                      </div>
                    </div>
                    <span className="text-white">Email notifications on completion</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
                <button
                  onClick={() => {
                    setShowNewModal(false);
                    setEditingSchedule(null);
                  }}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formData.name || !formData.tool || !formData.target}
                  className="px-6 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white rounded-lg transition disabled:opacity-50"
                >
                  {editingSchedule ? 'Save Changes' : 'Create Schedule'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SchedulePage;
