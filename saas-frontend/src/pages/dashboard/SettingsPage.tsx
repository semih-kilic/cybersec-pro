import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useSearchParams } from 'react-router-dom';

interface UserSettings {
  notifications: {
    email_scan_complete: boolean;
    email_weekly_report: boolean;
    browser_notifications: boolean;
  };
  theme: 'dark' | 'light' | 'system';
  timezone: string;
  language: string;
}

interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  created_at: string;
  last_used: string | null;
  permissions: string[];
}

export default function SettingsPage() {
  const { user, organization } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const userPlan = organization?.plan_type || 'trial';
  
  // Get initial tab from URL params
  const tabParam = searchParams.get('tab');
  const validTabs = ['profile', 'security', 'notifications', 'api', 'billing'] as const;
  const initialTab = validTabs.includes(tabParam as typeof validTabs[number]) ? tabParam as typeof validTabs[number] : 'profile';
  
  const [activeTab, setActiveTab] = useState<typeof validTabs[number]>(initialTab);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Update URL when tab changes
  const handleTabChange = (tab: typeof validTabs[number]) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };
  
  // Profile state
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [company, setCompany] = useState(user?.company || '');
  
  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  
  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  
  // Notification settings
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      email_scan_complete: true,
      email_weekly_report: true,
      browser_notifications: true,
    },
    theme: 'dark',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: 'en',
  });

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setCompany(user.company || '');
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          company,
        }),
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        // Update local storage
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        userData.first_name = firstName;
        userData.last_name = lastName;
        userData.company = company;
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    
    setLoading(true);
    setMessage(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to change password' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = async () => {
    if (!newKeyName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a name for the API key' });
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/auth/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newKeyName }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setShowNewKey(data.api_key);
        setApiKeys([...apiKeys, {
          id: data.id,
          name: newKeyName,
          key_preview: data.api_key.slice(0, 12) + '...',
          created_at: new Date().toISOString(),
          last_used: null,
          permissions: ['read', 'write'],
        }]);
        setNewKeyName('');
        setMessage({ type: 'success', text: 'API key generated! Copy it now - you won\'t see it again.' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to generate API key' });
      }
    } catch {
      // Mock for demo
      const mockKey = `csp_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
      setShowNewKey(mockKey);
      setApiKeys([...apiKeys, {
        id: Math.random().toString(),
        name: newKeyName,
        key_preview: mockKey.slice(0, 12) + '...',
        created_at: new Date().toISOString(),
        last_used: null,
        permissions: ['read', 'write'],
      }]);
      setNewKeyName('');
      setMessage({ type: 'success', text: 'API key generated! Copy it now - you won\'t see it again.' });
    } finally {
      setLoading(false);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) return;
    
    setApiKeys(apiKeys.filter(k => k.id !== keyId));
    setMessage({ type: 'success', text: 'API key deleted' });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'Copied to clipboard!' });
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'security', label: 'Security', icon: '🔐' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'api', label: 'API Keys', icon: '🔑' },
    { id: 'billing', label: 'Billing', icon: '💳' },
  ] as const;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Manage your account settings and preferences</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 border border-green-500 text-green-400' : 'bg-red-500/20 border border-red-500 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-8">
        {/* Tabs Sidebar */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition ${
                  activeTab === tab.id
                    ? 'bg-kali-blue/20 text-kali-blue border-l-2 border-kali-blue'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-gray-900 rounded-xl p-6 border border-gray-800">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <h2 className="text-xl font-bold text-white mb-4">Profile Information</h2>
              
              <div className="flex items-center gap-6 mb-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-kali-blue to-kali-purple flex items-center justify-center text-3xl text-white font-bold">
                  {firstName?.charAt(0) || email?.charAt(0) || '?'}
                </div>
                <div>
                  <button type="button" className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition">
                    Change Avatar
                  </button>
                  <p className="text-gray-500 text-sm mt-1">JPG, PNG or GIF. Max 2MB.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-500 cursor-not-allowed"
                />
                <p className="text-gray-500 text-sm mt-1">Email cannot be changed</p>
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue"
                  placeholder="Your company name"
                />
              </div>
              
              <div className="pt-4 border-t border-gray-800">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-bold text-white mb-4">Change Password</h2>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition disabled:opacity-50"
                  >
                    {loading ? 'Changing...' : 'Change Password'}
                  </button>
                </form>
              </div>
              
              <div className="border-t border-gray-800 pt-8">
                <h2 className="text-xl font-bold text-white mb-4">Two-Factor Authentication</h2>
                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-white font-medium">2FA Authentication</p>
                    <p className="text-gray-400 text-sm">Add an extra layer of security to your account</p>
                  </div>
                  <button
                    onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      twoFactorEnabled
                        ? 'bg-green-500/20 text-green-400 border border-green-500'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {twoFactorEnabled ? 'Enabled ✓' : 'Enable'}
                  </button>
                </div>
              </div>
              
              <div className="border-t border-gray-800 pt-8">
                <h2 className="text-xl font-bold text-red-400 mb-4">Danger Zone</h2>
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-white font-medium mb-2">Delete Account</p>
                  <p className="text-gray-400 text-sm mb-4">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                  <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white mb-4">Notification Preferences</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Email on Scan Complete</p>
                    <p className="text-gray-400 text-sm">Get notified when a scan finishes</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.email_scan_complete}
                      onChange={(e) => setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, email_scan_complete: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kali-blue"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Weekly Security Report</p>
                    <p className="text-gray-400 text-sm">Receive a weekly summary of your security findings</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.email_weekly_report}
                      onChange={(e) => setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, email_weekly_report: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kali-blue"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Browser Notifications</p>
                    <p className="text-gray-400 text-sm">Show desktop notifications for important events</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.browser_notifications}
                      onChange={(e) => setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, browser_notifications: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kali-blue"></div>
                  </label>
                </div>
              </div>
              
              <div className="pt-4">
                <button className="px-6 py-3 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition">
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'api' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">API Keys</h2>
                  <p className="text-gray-400 text-sm">Manage API keys for programmatic access</p>
                </div>
              </div>
              
              {/* New Key Form */}
              <div className="flex gap-4">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Enter key name (e.g., Production API)"
                  className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue"
                />
                <button
                  onClick={generateApiKey}
                  disabled={loading}
                  className="px-6 py-3 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition disabled:opacity-50"
                >
                  Generate Key
                </button>
              </div>
              
              {/* Show New Key */}
              {showNewKey && (
                <div className="p-4 bg-green-500/10 border border-green-500 rounded-lg">
                  <p className="text-green-400 font-medium mb-2">🔑 New API Key Generated</p>
                  <p className="text-gray-400 text-sm mb-3">Copy this key now. You won't be able to see it again!</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-4 py-2 bg-gray-800 rounded-lg text-kali-blue font-mono text-sm overflow-x-auto">
                      {showNewKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(showNewKey)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
              
              {/* API Keys List */}
              <div className="space-y-3">
                {apiKeys.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-4xl mb-4">🔑</p>
                    <p>No API keys yet. Generate one to get started.</p>
                  </div>
                ) : (
                  apiKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{key.name}</p>
                        <p className="text-gray-500 text-sm font-mono">{key.key_preview}</p>
                        <p className="text-gray-500 text-xs mt-1">
                          Created: {new Date(key.created_at).toLocaleDateString()}
                          {key.last_used && ` • Last used: ${new Date(key.last_used).toLocaleDateString()}`}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteApiKey(key.id)}
                        className="px-3 py-1 text-red-400 hover:bg-red-500/20 rounded transition"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
              
              {/* API Documentation Link */}
              <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                <p className="text-white font-medium mb-2">📚 API Documentation</p>
                <p className="text-gray-400 text-sm mb-3">
                  Learn how to use the CyberSec Pro API in your applications.
                </p>
                <a
                  href="/docs.html#api"
                  target="_blank"
                  className="text-kali-blue hover:underline"
                >
                  View API Documentation →
                </a>
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white mb-4">Billing & Subscription</h2>
              
              {/* Current Plan */}
              <div className="p-6 bg-gradient-to-r from-kali-blue/20 to-kali-purple/20 rounded-xl border border-kali-blue/30">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-gray-400 text-sm">Current Plan</p>
                    <p className="text-2xl font-bold text-white capitalize">{userPlan}</p>
                  </div>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                    Active
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-700">
                  <div>
                    <p className="text-gray-400 text-sm">Tools Access</p>
                    <p className="text-white font-medium">
                      {userPlan === 'enterprise' ? '350+' : 
                       userPlan === 'team' ? '200' :
                       userPlan === 'professional' ? '120' :
                       userPlan === 'starter' ? '33' : '7'} Tools
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Scans/Day</p>
                    <p className="text-white font-medium">
                      {userPlan === 'enterprise' ? 'Unlimited' : 
                       userPlan === 'team' ? '100' :
                       userPlan === 'professional' ? '50' : '5'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Next Billing</p>
                    <p className="text-white font-medium">Feb 26, 2026</p>
                  </div>
                </div>
              </div>
              
              {/* Upgrade Options */}
              {userPlan !== 'enterprise' && (
                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <p className="text-white font-medium mb-2">🚀 Upgrade Your Plan</p>
                  <p className="text-gray-400 text-sm mb-4">
                    Get more tools, faster scans, and advanced features.
                  </p>
                  <a
                    href="/#pricing"
                    className="inline-block px-6 py-2 bg-kali-blue text-white rounded-lg hover:bg-kali-blue/80 transition"
                  >
                    View Plans
                  </a>
                </div>
              )}
              
              {/* Payment Method */}
              <div className="p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white font-medium">Payment Method</p>
                  <button className="text-kali-blue hover:underline text-sm">Change</button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold">
                    VISA
                  </div>
                  <div>
                    <p className="text-white">•••• •••• •••• 4242</p>
                    <p className="text-gray-500 text-sm">Expires 12/28</p>
                  </div>
                </div>
              </div>
              
              {/* Billing History */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Billing History</h3>
                <div className="space-y-2">
                  {[
                    { date: 'Jan 26, 2026', amount: '€29.00', status: 'Paid', invoice: '#INV-2601' },
                    { date: 'Dec 26, 2025', amount: '€29.00', status: 'Paid', invoice: '#INV-2512' },
                    { date: 'Nov 26, 2025', amount: '€29.00', status: 'Paid', invoice: '#INV-2511' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400">{item.date}</span>
                        <span className="text-white font-medium">{item.amount}</span>
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">{item.status}</span>
                      </div>
                      <button className="text-kali-blue hover:underline text-sm">{item.invoice}</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
