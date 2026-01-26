import { useState, useEffect, useRef } from 'react';
import { 
  Activity, Cpu, MemoryStick, HardDrive, Network, 
  Wifi, Globe, Shield, AlertTriangle, Clock,
  Server, ArrowUp, ArrowDown, Zap,
  Eye, Target, Lock, Unlock
} from 'lucide-react';
import { apiUrl } from '../config/api';

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network_in: number;
  network_out: number;
  uptime: string;
}

interface NetworkStats {
  active_connections: number;
  packets_in: number;
  packets_out: number;
  bandwidth_usage: number;
}

interface SecurityMetrics {
  blocked_attacks: number;
  active_scans: number;
  vulnerabilities_found: number;
  open_ports: number;
}

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
}

interface SystemStats {
  load_1m: number | null;
  load_5m: number | null;
  load_15m: number | null;
  processes: number;
  swap_percent: number;
  users: number;
}

interface TargetSummary {
  id: number;
  value: string;
  type: string;
  status: string;
  online: boolean | null;
  open_ports: number[];
  last_scan: string | null;
  vulnerabilities: number;
}

interface ServiceStatus {
  name: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

export default function MonitoringPage() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: 0,
    memory: 0,
    disk: 0,
    network_in: 0,
    network_out: 0,
    uptime: '0d 0h 0m'
  });
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    active_connections: 0,
    packets_in: 0,
    packets_out: 0,
    bandwidth_usage: 0
  });
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics>({
    blocked_attacks: 0,
    active_scans: 0,
    vulnerabilities_found: 0,
    open_ports: 0
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    load_1m: null,
    load_5m: null,
    load_15m: null,
    processes: 0,
    swap_percent: 0,
    users: 0
  });
  const [targetSummary, setTargetSummary] = useState<TargetSummary | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [isLive, setIsLive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Real-time data updates
  useEffect(() => {
    const updateMetrics = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const metricsResponse = await fetch(apiUrl('/api/monitoring/metrics'), { headers });
        if (!metricsResponse.ok) {
          const payload = await metricsResponse.json().catch(() => ({}));
          const message = payload?.error || 'Monitoring access denied.';
          setErrorMessage(message === 'Admin IP not allowed'
            ? 'Admin IP not allowed. Add your IP to ADMIN_ALLOWED_IPS in /etc/cybersec/admin.env.'
            : message);
          return;
        }
        const metricsData = await metricsResponse.json();

        if (metricsData?.metrics) {
          setMetrics(metricsData.metrics);
          setCpuHistory(prev => [...prev.slice(-29), Math.round(metricsData.metrics.cpu)]);
          setMemoryHistory(prev => [...prev.slice(-29), Math.round(metricsData.metrics.memory)]);
        }

        if (metricsData?.network) {
          setNetworkStats(metricsData.network);
        }

        if (metricsData?.security) {
          setSecurityMetrics(metricsData.security);
        }

        if (metricsData?.system) {
          setSystemStats(metricsData.system);
        }

        const logsResponse = await fetch(apiUrl('/api/monitoring/logs'), { headers });
        const logsData = await logsResponse.json();
        if (Array.isArray(logsData?.logs)) {
          setLogs(logsData.logs.slice(0, 50));
        }

        const targetResponse = await fetch(apiUrl('/api/monitoring/targets/summary'), { headers });
        const targetData = await targetResponse.json();
        setTargetSummary(targetData?.target ?? null);

        const servicesResponse = await fetch(apiUrl('/api/monitoring/services?limit=80'), { headers });
        if (servicesResponse.ok) {
          const servicesData = await servicesResponse.json();
          if (Array.isArray(servicesData?.services)) {
            setServices(servicesData.services);
          }
        }
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to load monitoring metrics:', error);
        setErrorMessage('Failed to load monitoring data.');
      }
    };

    updateMetrics();

    // Set up interval
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isLive) {
      interval = setInterval(updateMetrics, refreshInterval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLive, refreshInterval]);

  // Draw CPU/Memory chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw CPU line
    if (cpuHistory.length > 1) {
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      cpuHistory.forEach((value, i) => {
        const x = (width / (cpuHistory.length - 1)) * i;
        const y = height - (value / 100) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Fill under CPU line
      ctx.fillStyle = 'rgba(0, 212, 255, 0.1)';
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.fill();
    }

    // Draw Memory line
    if (memoryHistory.length > 1) {
      ctx.strokeStyle = '#b829e3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      memoryHistory.forEach((value, i) => {
        const x = (width / (memoryHistory.length - 1)) * i;
        const y = height - (value / 100) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [cpuHistory, memoryHistory]);

  const getLogColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-500 bg-red-500/20';
      case 'error': return 'text-red-400 bg-red-500/10';
      case 'warning': return 'text-yellow-400 bg-yellow-500/10';
      case 'info': return 'text-blue-400 bg-blue-500/10';
      default: return 'text-gray-400';
    }
  };

  const GaugeChart = ({ value, label, color, icon: Icon }: { value: number; label: string; color: string; icon: any }) => (
    <div className="glass p-4 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <div className="relative w-full h-4 bg-dark-bg rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${
            value > 80 ? 'bg-red-500' : value > 60 ? 'bg-yellow-500' : 'bg-gradient-to-r from-primary to-secondary'
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-sm">
        <span className={`text-2xl font-bold ${value > 80 ? 'text-red-400' : ''}`}>{value}%</span>
        <span className="text-gray-500">/ 100%</span>
      </div>
    </div>
  );

  const getServiceBadge = (status: string) => {
    if (status === 'active') return 'text-green-400 bg-green-500/10 border-green-500/30';
    if (status === 'failed') return 'text-red-400 bg-red-500/10 border-red-500/30';
    return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
            <Activity className="w-8 h-8" />
            System Monitoring
          </h1>
          <p className="text-gray-400 mt-2">Real-time system and security metrics</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Live indicator */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${isLive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
            {isLive ? 'LIVE' : 'PAUSED'}
          </div>
          
          {/* Refresh interval */}
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
            className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 text-sm"
          >
            <option value={1000}>1s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
          </select>
          
          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              isLive ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
            }`}
          >
            {isLive ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
          {errorMessage}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <GaugeChart value={metrics.cpu} label="CPU Usage" color="text-cyan-400" icon={Cpu} />
        <GaugeChart value={metrics.memory} label="Memory Usage" color="text-purple-400" icon={MemoryStick} />
        <GaugeChart value={metrics.disk} label="Disk Usage" color="text-blue-400" icon={HardDrive} />
        <GaugeChart value={networkStats.bandwidth_usage} label="Bandwidth" color="text-green-400" icon={Network} />
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* CPU/Memory Chart */}
        <div className="lg:col-span-2 glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">System Performance</h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-400" />
                <span className="text-gray-400">CPU</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-400" />
                <span className="text-gray-400">Memory</span>
              </div>
            </div>
          </div>
          <canvas 
            ref={canvasRef}
            width={800}
            height={200}
            className="w-full rounded-lg"
          />
          <div className="flex justify-between mt-4 text-sm text-gray-500">
            <span>30 seconds ago</span>
            <span>Now</span>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="glass rounded-xl p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Security Status
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-green-400" />
                  <span>Blocked Attacks</span>
                </div>
                <span className="text-xl font-bold text-green-400">{securityMetrics.blocked_attacks}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <span>Active Scans</span>
                </div>
                <span className="text-xl font-bold text-yellow-400">{securityMetrics.active_scans}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span>Vulnerabilities</span>
                </div>
                <span className="text-xl font-bold text-red-400">{securityMetrics.vulnerabilities_found}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
                <div className="flex items-center gap-3">
                  <Unlock className="w-5 h-5 text-orange-400" />
                  <span>Open Ports</span>
                </div>
                <span className="text-xl font-bold text-orange-400">{securityMetrics.open_ports}</span>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              Service Health
            </h3>
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {services.length === 0 ? (
                <div className="text-center text-gray-500 py-6">
                  No services reported yet.
                </div>
              ) : (
                services.map((service) => (
                  <div key={service.name} className="flex items-center justify-between p-2 bg-dark-bg rounded-lg">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-200">{service.name}</span>
                      <span className="text-xs text-gray-500 truncate max-w-[220px]">{service.description}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded border ${getServiceBadge(service.active)}`}>
                      {service.active}/{service.sub}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Network and Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Network Stats */}
        <div className="glass rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Network Activity
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-dark-bg rounded-lg">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <ArrowDown className="w-4 h-4" />
                <span className="text-sm">Incoming</span>
              </div>
              <div className="text-2xl font-bold">{metrics.network_in.toFixed(0)}</div>
              <div className="text-xs text-gray-500">KB/s</div>
            </div>
            <div className="p-4 bg-dark-bg rounded-lg">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <ArrowUp className="w-4 h-4" />
                <span className="text-sm">Outgoing</span>
              </div>
              <div className="text-2xl font-bold">{metrics.network_out.toFixed(0)}</div>
              <div className="text-xs text-gray-500">KB/s</div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Active Connections</span>
              <span className="font-bold">{networkStats.active_connections}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Packets In</span>
              <span className="font-mono text-sm">{networkStats.packets_in.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Packets Out</span>
              <span className="font-mono text-sm">{networkStats.packets_out.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">System Uptime</span>
              <span className="text-primary font-bold">{metrics.uptime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Load Average</span>
              <span className="font-mono text-sm">
                {systemStats.load_1m !== null ? `${systemStats.load_1m} / ${systemStats.load_5m} / ${systemStats.load_15m}` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Processes</span>
              <span className="font-mono text-sm">{systemStats.processes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Swap Usage</span>
              <span className="font-mono text-sm">{systemStats.swap_percent}%</span>
            </div>
          </div>
        </div>

        {/* Live Logs */}
        <div className="glass rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            Live Activity Log
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Waiting for activity...
              </div>
            ) : (
              logs.map((log) => (
                <div 
                  key={log.id}
                  className={`p-2 rounded-lg flex items-start gap-3 text-sm ${getLogColor(log.level)}`}
                >
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-xs uppercase font-bold ${getLogColor(log.level)}`}>
                    {log.level}
                  </span>
                  <span className="text-gray-400">[{log.source}]</span>
                  <span className="flex-1">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Target Status */}
      <div className="mt-6 glass rounded-xl p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Target Status
        </h3>
        {targetSummary ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-dark-bg rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wifi className={`w-4 h-4 ${targetSummary.online ? 'text-green-400' : 'text-red-400'}`} />
                <span className="text-sm text-gray-400">Connection</span>
              </div>
              <div className={`text-lg font-bold ${targetSummary.online ? 'text-green-400' : 'text-red-400'}`}>
                {targetSummary.online === null ? 'Unknown' : targetSummary.online ? 'Online' : 'Offline'}
              </div>
              <div className="text-xs text-gray-500 mt-1">{targetSummary.value}</div>
            </div>
            <div className="p-4 bg-dark-bg rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Server className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">Open Ports</span>
              </div>
              <div className="text-lg font-bold">
                {targetSummary.open_ports.length > 0 ? targetSummary.open_ports.join(', ') : 'N/A'}
              </div>
            </div>
            <div className="p-4 bg-dark-bg rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-gray-400">Last Scan</span>
              </div>
              <div className="text-lg font-bold">
                {targetSummary.last_scan ? new Date(targetSummary.last_scan).toLocaleString() : 'N/A'}
              </div>
            </div>
            <div className="p-4 bg-dark-bg rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-400">Vulnerabilities</span>
              </div>
              <div className="text-lg font-bold text-yellow-400">{targetSummary.vulnerabilities}</div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-6">
            No targets configured yet.
          </div>
        )}
      </div>
    </div>
  );
}
