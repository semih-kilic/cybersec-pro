/**
 * API Keys Settings Tab
 * Generate, manage, and revoke API keys
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { SettingsTabProps, ApiKey } from './types';
import api from '../../../services/api';

export function ApiKeysTab({ loading, setLoading, setMessage }: SettingsTabProps) {
  const { t } = useTranslation();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    const res = await api.getApiKeys();
    if (res.data?.api_keys) {
      setApiKeys(res.data.api_keys.map(k => ({
        id: k.id,
        name: k.name,
        key_preview: k.key,
        created_at: k.created_at,
        last_used: k.last_used,
        permissions: k.permissions,
      })));
    }
  };

  const generateApiKey = async () => {
    if (!newKeyName.trim()) {
      setMessage({ type: 'error', text: t('settings.apiKeys.enterName', 'Please enter a key name') });
      return;
    }
    setLoading(true);
    try {
      const res = await api.createApiKey(newKeyName.trim());
      if (res.error) {
        setMessage({ type: 'error', text: res.error });
        return;
      }
      if (res.data?.api_key) {
        setShowNewKey(res.data.api_key.key);
        setApiKeys(prev => [{
          id: res.data!.api_key.id,
          name: res.data!.api_key.name,
          key_preview: `csp_...${res.data!.api_key.key_preview}`,
          created_at: res.data!.api_key.created_at,
          last_used: null,
          permissions: res.data!.api_key.permissions,
        }, ...prev]);
        setNewKeyName('');
        setMessage({ type: 'success', text: t('settings.apiKeys.generated', 'API key generated! Copy it now — you won\'t see it again.') });
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    const res = await api.deleteApiKey(keyId);
    if (res.error) {
      setMessage({ type: 'error', text: res.error });
    } else {
      setApiKeys(apiKeys.filter(k => k.id !== keyId));
      setMessage({ type: 'success', text: t('settings.apiKeys.deleted', 'API key deleted') });
    }
    setDeleteConfirm(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: t('settings.apiKeys.copied', 'Copied to clipboard!') });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{t('settings.apiKeys.heading', 'API Keys')}</h2>
          <p className="text-gray-400 text-sm">{t('settings.apiKeys.subtitle', 'Manage API keys for programmatic access')}</p>
        </div>
        <span className="text-gray-500 text-sm">{apiKeys.length} key{apiKeys.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Generate */}
      <div className="flex gap-3">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Enter key name (e.g., Production API)"
          className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue transition"
          onKeyDown={(e) => e.key === 'Enter' && generateApiKey()}
        />
        <button
          onClick={generateApiKey}
          disabled={loading || !newKeyName.trim()}
          className="px-6 py-3 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition disabled:opacity-50 whitespace-nowrap btn-micro"
        >
          Generate Key
        </button>
      </div>

      {/* New Key Warning */}
      <AnimatePresence>
        {showNewKey && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-4 bg-green-500/10 border border-green-500 rounded-lg"
          >
            <p className="text-green-400 font-medium mb-2">🔑 New API Key Generated</p>
            <p className="text-gray-400 text-sm mb-3">Copy this key now. You won't be able to see it again!</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-2 bg-gray-800 rounded-lg text-kali-blue font-mono text-sm overflow-x-auto select-all">
                {showNewKey}
              </code>
              <button
                onClick={() => copyToClipboard(showNewKey)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition btn-micro"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => setShowNewKey(null)}
              className="mt-3 text-gray-500 text-sm hover:text-gray-300 transition"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keys List */}
      <div className="space-y-3">
        {apiKeys.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-4xl mb-4">🔑</p>
            <p className="font-medium mb-1">No API keys yet</p>
            <p className="text-sm">Generate one to get started with the API</p>
          </div>
        ) : (
          <AnimatePresence>
            {apiKeys.map((key) => (
              <motion.div
                key={key.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-800/80 transition"
              >
                <div>
                  <p className="text-white font-medium">{key.name}</p>
                  <p className="text-gray-500 text-sm font-mono">{key.key_preview}</p>
                  <p className="text-gray-600 text-xs mt-1">
                    Created: {new Date(key.created_at).toLocaleDateString()}
                    {key.last_used && ` · Last used: ${new Date(key.last_used).toLocaleDateString()}`}
                  </p>
                </div>
                {deleteConfirm === key.id ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => deleteApiKey(key.id)} className="px-3 py-1 bg-red-600 text-white rounded text-sm btn-micro">Confirm</button>
                    <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm btn-micro">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(key.id)} className="px-3 py-1 text-red-400 hover:bg-red-500/20 rounded transition text-sm">
                    Delete
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Docs */}
      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
        <p className="text-white font-medium mb-2">📚 API Documentation</p>
        <p className="text-gray-400 text-sm mb-3">Learn how to use the CyberSec Pro API in your applications.</p>
        <a href="/docs.html#api" target="_blank" rel="noreferrer" className="text-kali-blue hover:underline text-sm">
          View API Documentation →
        </a>
      </div>
    </motion.div>
  );
}
