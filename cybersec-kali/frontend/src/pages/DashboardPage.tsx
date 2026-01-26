import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, Target, Database, Activity, Terminal,
  Globe, Wifi, Key, AlertTriangle,
  Play, ArrowRight, Zap, Clock, CheckCircle
} from 'lucide-react';
import axios from 'axios';
import { apiUrl } from '../config/api';

interface Stats {
  total_tools: number;
  installed_tools: number;
  categories: number;
  recent_scans: number;
}

interface RecentScan {
  id: number;
  tool: string;
  target: string;
  status: string;
  created_at: string;
}

const QUICK_ACTIONS = [
  { 
    id: 'network', 
    title: 'Network Scan', 
    description: 'Discover devices and open ports on the network',
    icon: Wifi,
    color: 'from-blue-500 to-cyan-500',
    tool: 'Nmap'
  },
  { 
    id: 'web', 
    title: 'Web Scan', 
    description: 'Find security vulnerabilities in web applications',
    icon: Globe,
    color: 'from-purple-500 to-pink-500',
    tool: 'Nikto'
  },
  { 
    id: 'vuln', 
    title: 'Vulnerability Scan', 
    description: 'Detect known security vulnerabilities',
    icon: AlertTriangle,
    color: 'from-red-500 to-orange-500',
    tool: 'Nuclei'
  },
  { 
    id: 'password', 
    title: 'Password Test', 
    description: 'Test password security and brute force resistance',
    icon: Key,
    color: 'from-yellow-500 to-amber-500',
    tool: 'Hydra'
  },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickTarget, setQuickTarget] = useState('');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [statsRes, scansRes] = await Promise.all([
        axios.get(apiUrl('/api/dashboard/stats')),
        axios.get(apiUrl('/api/scans?limit=5'))
      ]);
      
      setStats(statsRes.data);
      setRecentScans(scansRes.data.scans || []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickScan = async (actionId: string) => {
    if (!quickTarget.trim()) {
      alert('Please enter a target!');
      return;
    }

    const action = QUICK_ACTIONS.find(a => a.id === actionId);
    if (!action) return;

    setScanning(true);
    setSelectedAction(actionId);

    try {
      const response = await axios.post(apiUrl('/api/scans/quick'), {
        tool_name: action.tool,
        target: quickTarget
      });
      
      if (response.data.scan) {
        alert(`✅ ${action.title} started! Scan ID: ${response.data.scan.id}`);
        loadDashboard();
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setScanning(false);
      setSelectedAction(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl gradient-text animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Welcome Header */}
      <div
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-white mb-2">
          Welcome! 👋
        </h1>
        <p className="text-gray-400 text-lg">
          Start your professional security testing
        </p>
      </div>

      {/* Quick Target Input */}
      <div
        className="glass rounded-2xl p-6 mb-8 cyber-glow"
      >
        <div className="flex items-center gap-4 mb-4">
          <Target className="text-primary w-8 h-8" />
          <div>
            <h2 className="text-xl font-bold text-white">Quick Scan</h2>
            <p className="text-gray-400 text-sm">Enter target and select scan type</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={quickTarget}
              onChange={(e) => setQuickTarget(e.target.value)}
              placeholder="Enter IP address, domain or URL... (e.g., 192.168.1.1, example.com)"
              className="w-full pl-12 pr-4 py-4 bg-dark-bg text-white text-lg rounded-xl border border-dark-border focus:border-primary outline-none"
            />
          </div>
        </div>
        
        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            const isLoading = scanning && selectedAction === action.id;
            
            return (
              <button
                key={action.id}
                onClick={() => handleQuickScan(action.id)}
                disabled={scanning}
                className={`p-4 rounded-xl bg-gradient-to-r ${action.color} text-white text-left transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer`}
              >
                <div className="flex items-center gap-3 mb-2">
                  {isLoading ? (
                    <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Icon className="w-6 h-6" />
                  )}
                  <span className="font-bold">{action.title}</span>
                </div>
                <p className="text-sm opacity-90">{action.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<Database className="w-6 h-6" />}
          label="Total Tools"
          value={stats?.total_tools || 0}
          color="primary"
        />
        <StatCard
          icon={<Shield className="w-6 h-6" />}
          label="Installed"
          value={stats?.installed_tools || 0}
          color="green"
        />
        <StatCard
          icon={<Target className="w-6 h-6" />}
          label="Categories"
          value={stats?.categories || 0}
          color="purple"
        />
        <StatCard
          icon={<Activity className="w-6 h-6" />}
          label="Recent Scans"
          value={stats?.recent_scans || 0}
          color="orange"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Recent Scans */}
        <div
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="text-primary" />
              Recent Scans
            </h2>
            <button 
              onClick={() => navigate('/scans')}
              className="text-primary hover:underline text-sm flex items-center gap-1 cursor-pointer"
            >
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          {recentScans.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No scans yet</p>
              <p className="text-sm">Start a quick scan above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentScans.map((scan) => (
                <div key={scan.id} className="flex items-center gap-4 p-3 bg-dark-bg/50 rounded-lg">
                  <div className={`p-2 rounded-lg ${
                    scan.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    scan.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {scan.status === 'completed' ? <CheckCircle className="w-5 h-5" /> :
                     scan.status === 'running' ? <Play className="w-5 h-5" /> :
                     <Clock className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white">{scan.tool}</div>
                    <div className="text-sm text-gray-500">{scan.target}</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(scan.created_at).toLocaleString('en-US')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Zap className="text-primary" />
            Quick Access
          </h2>
          
          <div className="space-y-3">
            <QuickLink 
              title="All Tools"
              description="Browse 244 security tools"
              onClick={() => navigate('/tools')}
              color="blue"
            />
            <QuickLink 
              title="Scan History"
              description="View previous scans and results"
              onClick={() => navigate('/scans')}
              color="purple"
            />
            <QuickLink 
              title="System Updates"
              description="Update tools and system"
              onClick={() => navigate('/updates')}
              color="green"
            />
            <QuickLink 
              title="License Management"
              description="View license status and plans"
              onClick={() => navigate('/license')}
              color="yellow"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    primary: 'text-primary',
    green: 'text-green-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
  };

  return (
    <div className="glass rounded-xl p-5 hover:scale-[1.02] transition-transform">
      <div className={`${colorClasses[color]} mb-3`}>{icon}</div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-gray-500 text-sm">{label}</div>
    </div>
  );
}

function QuickLink({ title, description, onClick, color }: { title: string; description: string; onClick: () => void; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    purple: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
    green: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
    yellow: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl bg-gradient-to-r ${colorClasses[color]} border transition-all flex items-center justify-between group cursor-pointer hover:scale-[1.01] hover:translate-x-1`}
    >
      <div>
        <div className="font-bold text-white">{title}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-all" />
    </button>
  );
}
