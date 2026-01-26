import React, { useState, useEffect } from 'react';

import { 
  Download, RefreshCw, CheckCircle, Clock, AlertCircle,
  Shield, Database, Terminal, Package
} from 'lucide-react';
import axios from 'axios';
import { apiUrl } from '../config/api';

interface UpdateInfo {
  available_updates: number;
  last_check: string;
  system_version: string;
}

interface ToolUpdate {
  id: number;
  name: string;
  current_version: string;
  new_version: string;
  category: string;
}

export default function UpdatesPage() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [toolUpdates, setToolUpdates] = useState<ToolUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [updatingAll, setUpdatingAll] = useState(false);

  useEffect(() => {
    loadUpdates();
  }, []);

  const loadUpdates = async () => {
    try {
      const response = await axios.get(apiUrl('/api/updates/check'));
      setUpdateInfo(response.data);
      setToolUpdates(response.data.tools || []);
    } catch (error) {
      console.error('Failed to load updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      await axios.post(apiUrl('/api/updates/refresh'));
      await loadUpdates();
      alert('✅ Update check complete!');
    } catch (error: any) {
      alert(`❌ Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setChecking(false);
    }
  };

  const updateTool = async (toolId: number, toolName: string) => {
    setUpdating(toolId);
    try {
      await axios.post(apiUrl(`/api/tools/${toolId}/update`));
      alert(`✅ ${toolName} updated successfully!`);
      loadUpdates();
    } catch (error: any) {
      alert(`❌ Update failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const updateAll = async () => {
    setUpdatingAll(true);
    try {
      await axios.post(apiUrl('/api/updates/all'));
      alert('✅ All tools updated successfully!');
      loadUpdates();
    } catch (error: any) {
      alert(`❌ Update failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setUpdatingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl gradient-text animate-pulse">Checking updates...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Download className="text-primary" />
          System Updates
        </h1>
        <p className="text-gray-400 text-lg">
          Keep your security tools up to date
        </p>
      </div>

      {/* Status Card */}
      <div
        className="glass rounded-2xl p-6 mb-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className={`p-4 rounded-xl ${
              (updateInfo?.available_updates || 0) > 0 ? 'bg-yellow-500/20' : 'bg-green-500/20'
            }`}>
              {(updateInfo?.available_updates || 0) > 0 ? (
                <AlertCircle className="w-12 h-12 text-yellow-400" />
              ) : (
                <CheckCircle className="w-12 h-12 text-green-400" />
              )}
            </div>
            
            <div>
              <div className="text-2xl font-bold text-white">
                {(updateInfo?.available_updates || 0) > 0 
                  ? `${updateInfo?.available_updates} updates available`
                  : 'System is up to date'}
              </div>
              <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                <Clock className="w-4 h-4" />
                Last check: {updateInfo?.last_check 
                  ? new Date(updateInfo.last_check).toLocaleString('en-US')
                  : 'Never'}
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={checkForUpdates}
              disabled={checking}
              className="flex items-center gap-2 px-4 py-2 bg-dark-bg text-white rounded-xl hover:bg-dark-border transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${checking ? 'animate-spin' : ''}`} />
              Check Now
            </button>
            
            {(updateInfo?.available_updates || 0) > 0 && (
              <button
                onClick={updateAll}
                disabled={updatingAll}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-secondary text-dark-bg font-bold rounded-xl hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {updatingAll ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-dark-bg border-t-transparent rounded-full" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Update All
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <InfoCard
          icon={<Shield className="w-6 h-6" />}
          label="System Version"
          value={updateInfo?.system_version || 'v2.0.0'}
          color="primary"
        />
        <InfoCard
          icon={<Package className="w-6 h-6" />}
          label="Available Updates"
          value={String(updateInfo?.available_updates || 0)}
          color={updateInfo?.available_updates ? 'yellow' : 'green'}
        />
        <InfoCard
          icon={<Database className="w-6 h-6" />}
          label="Total Tools"
          value="245"
          color="blue"
        />
        <InfoCard
          icon={<Terminal className="w-6 h-6" />}
          label="Installed"
          value="144"
          color="purple"
        />
      </div>

      {/* Updates List */}
      {toolUpdates.length > 0 && (
        <div
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Package className="text-primary" />
            Available Updates
          </h2>
          
          <div className="space-y-3">
            {toolUpdates.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center justify-between p-4 bg-dark-bg/50 rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Download className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <div className="font-bold text-white">{tool.name}</div>
                    <div className="text-sm text-gray-500">{tool.category}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      {tool.current_version} → <span className="text-green-400">{tool.new_version}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => updateTool(tool.id, tool.name)}
                    disabled={updating === tool.id}
                    className="px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {updating === tool.id ? (
                      <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                    ) : (
                      'Update'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toolUpdates.length === 0 && (
        <div
          className="text-center py-12"
        >
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">All tools are up to date!</h3>
          <p className="text-gray-500">Check back later for new updates</p>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorClasses: Record<string, string> = {
    primary: 'text-primary bg-primary/20',
    green: 'text-green-400 bg-green-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/20',
    blue: 'text-blue-400 bg-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/20',
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}
