import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Clock, CheckCircle, XCircle, Loader, TrendingUp } from 'lucide-react';
import axios from 'axios';

const API_URL = '';

interface Scan {
  id: number;
  name: string;
  tool_name: string;
  target: string;
  status: string;
  progress: number;
  output: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export default function ScansPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadScans();
    
    if (autoRefresh) {
      const interval = setInterval(loadScans, 3000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadScans = async () => {
    try {
      const token = localStorage.getItem('token');
      const adminToken = localStorage.getItem('admin_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      if (adminToken) {
        headers['X-Admin-Token'] = adminToken;
      }

      const response = await axios.get(`${API_URL}/api/scans`, {
        headers
      });
      
      if (response.data) {
        // Handle both array and {scans: [...]} response formats
        const scanData = Array.isArray(response.data) ? response.data : (response.data.scans || []);
        setScans(scanData);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load scans:', error);
      setScans([]);
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader className="w-5 h-5 text-blue-400 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-blue-400 bg-blue-400/10';
      case 'completed':
        return 'text-green-400 bg-green-400/10';
      case 'failed':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-yellow-400 bg-yellow-400/10';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-2xl gradient-text animate-pulse">Loading Scans...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-bold gradient-text mb-2">
            🔍 Scan Results
          </h1>
          <p className="text-gray-400">
            {scans.length} scans • {scans.filter(s => s.status === 'running').length} running
          </p>
        </div>
        
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-6 py-3 rounded-lg font-bold transition-all ${
            autoRefresh
              ? 'bg-primary text-dark-bg'
              : 'glass text-gray-400'
          }`}
        >
          {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Scans List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white mb-4">Recent Scans</h2>
          
          {scans.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center">
              <Terminal className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No scans yet. Start a scan from the Dashboard!</p>
            </div>
          ) : (
            scans.map((scan) => (
              <motion.div
                key={scan.id}
                whileHover={{ scale: 1.02, x: 5 }}
                onClick={() => setSelectedScan(scan)}
                className={`glass rounded-xl p-6 cursor-pointer transition-all ${
                  selectedScan?.id === scan.id ? 'ring-2 ring-primary' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(scan.status)}
                    <div>
                      <h3 className="font-bold text-white">{scan.name}</h3>
                      <p className="text-sm text-gray-400">{scan.tool_name}</p>
                    </div>
                  </div>
                  
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(scan.status)}`}>
                    {scan.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>🎯 {scan.target}</span>
                  {scan.progress > 0 && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {scan.progress}%
                    </span>
                  )}
                </div>

                {scan.status === 'running' && (
                  <div className="mt-3">
                    <div className="w-full bg-dark-bg rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${scan.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>

        {/* Scan Details */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Scan Output</h2>
          
          {selectedScan ? (
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold gradient-text">{selectedScan.name}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedScan.status)}`}>
                  {selectedScan.status}
                </span>
              </div>

              <div className="space-y-2 mb-4 text-sm">
                <p className="text-gray-400">
                  <span className="text-gray-500">Tool:</span> {selectedScan.tool_name}
                </p>
                <p className="text-gray-400">
                  <span className="text-gray-500">Target:</span> {selectedScan.target}
                </p>
                <p className="text-gray-400">
                  <span className="text-gray-500">Created:</span> {new Date(selectedScan.created_at).toLocaleString()}
                </p>
                {selectedScan.started_at && (
                  <p className="text-gray-400">
                    <span className="text-gray-500">Started:</span> {new Date(selectedScan.started_at).toLocaleString()}
                  </p>
                )}
                {selectedScan.completed_at && (
                  <p className="text-gray-400">
                    <span className="text-gray-500">Completed:</span> {new Date(selectedScan.completed_at).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="bg-dark-bg rounded-lg p-4 font-mono text-sm text-green-400 max-h-96 overflow-y-auto">
                {selectedScan.output ? (
                  <pre className="whitespace-pre-wrap">{selectedScan.output}</pre>
                ) : selectedScan.error ? (
                  <pre className="text-red-400">{selectedScan.error}</pre>
                ) : (
                  <p className="text-gray-500 italic">No output yet...</p>
                )}
              </div>
            </div>
          ) : (
            <div className="glass rounded-xl p-12 text-center">
              <Terminal className="w-24 h-24 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Select a scan to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
