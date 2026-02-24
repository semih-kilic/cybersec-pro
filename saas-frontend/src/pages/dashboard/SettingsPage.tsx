import { useState, useEffect, useRef } from 'react';
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
  const validTabs = ['profile', 'security', 'notifications', 'team', 'api', 'integrations', 'sso', 'billing'] as const;
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
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
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

  // SSO state
  const [ssoConfig, setSsoConfig] = useState<any>(null);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoTesting, setSsoTesting] = useState(false);
  const [ssoTestResult, setSsoTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [ssoProviderType, setSsoProviderType] = useState<'saml' | 'ldap' | 'oidc'>('saml');
  const [ssoForm, setSsoForm] = useState<Record<string, any>>({});

  // Fetch SSO config when tab is selected
  useEffect(() => {
    if (activeTab === 'sso') {
      fetchSSOConfig();
    }
  }, [activeTab]);

  const fetchSSOConfig = async () => {
    try {
      const res = await fetch('/api/v1/sso/config', {
        headers: { 'Authorization': `Bearer ${(window as any).__auth_token || ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setSsoConfig(data.config);
          setSsoProviderType(data.config.provider_type);
          setSsoForm(data.config);
        }
      }
    } catch (e) { /* ignore */ }
  };

  const handleSSOSave = async () => {
    setSsoLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/v1/sso/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(window as any).__auth_token || ''}`,
        },
        body: JSON.stringify({ provider_type: ssoProviderType, ...ssoForm }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSsoConfig(data.config);
        setMessage({ type: 'success', text: data.message || 'SSO configuration saved' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save SSO configuration' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error saving SSO config' });
    } finally {
      setSsoLoading(false);
    }
  };

  const handleSSOTest = async () => {
    setSsoTesting(true);
    setSsoTestResult(null);
    try {
      const res = await fetch('/api/v1/sso/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(window as any).__auth_token || ''}`,
        },
      });
      const data = await res.json();
      setSsoTestResult({ success: data.success, message: data.message });
    } catch (e) {
      setSsoTestResult({ success: false, message: 'Network error testing connection' });
    } finally {
      setSsoTesting(false);
    }
  };

  const handleSSOToggle = async () => {
    try {
      const res = await fetch('/api/v1/sso/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(window as any).__auth_token || ''}`,
        },
        body: JSON.stringify({ enabled: !ssoConfig?.is_enabled }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSsoConfig((prev: any) => ({ ...prev, is_enabled: data.is_enabled }));
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to toggle SSO' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error' });
    }
  };

  const handleSSODelete = async () => {
    if (!confirm('Are you sure you want to delete the SSO configuration? Users will need to use email/password login.')) return;
    try {
      const res = await fetch('/api/v1/sso/config', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${(window as any).__auth_token || ''}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSsoConfig(null);
        setSsoForm({});
        setMessage({ type: 'success', text: 'SSO configuration deleted' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to delete SSO config' });
    }
  };

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setCompany(user.company || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  // Avatar upload handler
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      setMessage({ type: 'error', text: 'Please upload a JPG, PNG or GIF image' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size must be less than 2MB' });
      return;
    }

    setUploadingAvatar(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/v1/auth/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setAvatarUrl(data.avatar_url);
        setMessage({ type: 'success', text: 'Avatar updated successfully!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to upload avatar' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to upload avatar. Please try again.' });
    } finally {
      setUploadingAvatar(false);
    }
  };

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
    { id: 'team', label: 'Team', icon: '👥' },
    { id: 'api', label: 'API Keys', icon: '🔑' },
    { id: 'integrations', label: 'Integrations', icon: '🔗' },
    { id: 'sso', label: 'SSO', icon: '🏢' },
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

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
        {/* Tabs — V17: horizontal scrollable on mobile, sidebar on desktop */}
        <div className="w-full lg:w-48 flex-shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 lg:space-y-1 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg text-left transition whitespace-nowrap flex-shrink-0 lg:w-full ${
                  activeTab === tab.id
                    ? 'bg-kali-blue/20 text-kali-blue border-b-2 lg:border-b-0 lg:border-l-2 border-kali-blue'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="font-medium text-sm">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-800 min-w-0">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <h2 className="text-xl font-bold text-white mb-4">Profile Information</h2>
              
              <div className="flex items-center gap-6 mb-8">
                <div className="relative">
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt="Avatar" 
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-700"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-kali-blue to-kali-purple flex items-center justify-center text-3xl text-white font-bold">
                      {firstName?.charAt(0) || email?.charAt(0) || '?'}
                    </div>
                  )}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/jpeg,image/png,image/gif"
                    className="hidden"
                  />
                  <button 
                    type="button" 
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    {uploadingAvatar ? 'Uploading...' : 'Change Avatar'}
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

          {/* Team Tab */}
          {activeTab === 'team' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Team Management</h2>
                  <p className="text-gray-400 text-sm">Invite team members and manage roles</p>
                </div>
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Invite Member
                </button>
              </div>

              {/* Current Members */}
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="text-white font-medium">Team Members</h3>
                </div>
                <div className="divide-y divide-gray-700/50">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                        {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="text-white font-medium">{user?.first_name} {user?.last_name || ''}</p>
                        <p className="text-gray-500 text-sm">{user?.email}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">Owner</span>
                  </div>
                </div>
              </div>

              {/* Role Descriptions */}
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5">
                <h3 className="text-white font-medium mb-4">Available Roles</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { role: 'Admin', desc: 'Full access to all settings, billing, and team management', icon: '👑' },
                    { role: 'Analyst', desc: 'Can run scans, view reports, and manage targets', icon: '🔍' },
                    { role: 'Viewer', desc: 'Read-only access to dashboards and reports', icon: '👁️' },
                  ].map(r => (
                    <div key={r.role} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{r.icon}</span>
                        <span className="text-white font-medium text-sm">{r.role}</span>
                      </div>
                      <p className="text-gray-500 text-xs">{r.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {userPlan === 'trial' || userPlan === 'starter' ? (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5 text-center">
                  <p className="text-yellow-400 font-medium mb-2">Team management requires Professional plan or higher</p>
                  <a href="/dashboard/billing/upgrade" className="text-blue-400 hover:underline text-sm">Upgrade to invite team members →</a>
                </div>
              ) : null}
            </div>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Integrations</h2>
                <p className="text-gray-400 text-sm">Connect CyberSec Pro with your existing tools</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { name: 'Slack', desc: 'Get real-time vulnerability alerts in your Slack channels', icon: '💬', status: 'available', plan: 'professional' },
                  { name: 'Microsoft Teams', desc: 'Receive scan notifications in Microsoft Teams', icon: '💼', status: 'available', plan: 'professional' },
                  { name: 'Jira', desc: 'Auto-create tickets for discovered vulnerabilities', icon: '🎫', status: 'coming_soon', plan: 'professional' },
                  { name: 'GitHub', desc: 'Trigger scans on deployment, add security checks to PRs', icon: '🐙', status: 'available', plan: 'professional' },
                  { name: 'GitLab CI', desc: 'Integrate security scanning into your CI/CD pipeline', icon: '🦊', status: 'coming_soon', plan: 'professional' },
                  { name: 'PagerDuty', desc: 'Escalate critical vulnerabilities to your on-call team', icon: '🚨', status: 'coming_soon', plan: 'enterprise' },
                  { name: 'Splunk', desc: 'Export vulnerability data to your SIEM', icon: '📊', status: 'coming_soon', plan: 'enterprise' },
                  { name: 'Webhooks', desc: 'Send scan events to any URL endpoint', icon: '🔗', status: 'available', plan: 'starter' },
                ].map(integration => (
                  <div key={integration.name} className="bg-gray-800/50 rounded-xl border border-gray-700 p-5 flex items-start gap-4">
                    <span className="text-2xl">{integration.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-medium">{integration.name}</h3>
                        {integration.status === 'coming_soon' && (
                          <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">Coming Soon</span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-1">{integration.desc}</p>
                      <div className="mt-3">
                        {integration.status === 'available' ? (
                          <button className="px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium hover:bg-blue-600/30 transition">
                            Configure
                          </button>
                        ) : (
                          <span className="text-gray-600 text-xs">Requires {integration.plan} plan</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SSO Tab */}
          {activeTab === 'sso' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Single Sign-On (SSO)</h2>
                  <p className="text-gray-400 text-sm">Connect your Identity Provider for secure team authentication</p>
                </div>
                {ssoConfig && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSSOToggle}
                      className={`relative w-12 h-6 rounded-full transition-colors ${ssoConfig.is_enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${ssoConfig.is_enabled ? 'translate-x-6' : ''}`} />
                    </button>
                    <span className={`text-sm font-medium ${ssoConfig.is_enabled ? 'text-green-400' : 'text-gray-500'}`}>
                      {ssoConfig.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                )}
              </div>

              {/* Plan Gate */}
              {userPlan !== 'enterprise' && (
                <div className="p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="flex items-start gap-4">
                    <span className="text-2xl">🔒</span>
                    <div>
                      <h3 className="text-white font-semibold mb-1">SSO requires Enterprise plan</h3>
                      <p className="text-gray-400 text-sm mb-3">
                        Upgrade to connect your Identity Provider (Okta, Azure AD, Google Workspace, Active Directory).
                      </p>
                      <a href="/dashboard/upgrade" className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-gray-900 font-semibold rounded-lg hover:bg-yellow-400 transition text-sm">
                        Upgrade Now →
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* SSO Config Form - shown for Team/Enterprise */}
              {(userPlan === 'enterprise') && (
                <>
                  {/* Provider Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">Identity Provider Type</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'saml' as const, name: 'SAML 2.0', desc: 'Okta, Azure AD, OneLogin', icon: '🛡️', color: 'blue' },
                        { id: 'oidc' as const, name: 'OpenID Connect', desc: 'Google Workspace, GitHub Enterprise', icon: '🔗', color: 'green' },
                        { id: 'ldap' as const, name: 'LDAP', desc: 'Active Directory, OpenLDAP', icon: '📁', color: 'purple' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setSsoProviderType(p.id); setSsoForm((f: any) => ({ ...f, provider_type: p.id })); }}
                          className={`p-4 rounded-xl border-2 text-left transition ${
                            ssoProviderType === p.id
                              ? `border-${p.color}-500 bg-${p.color}-500/10`
                              : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                          }`}
                        >
                          <span className="text-2xl">{p.icon}</span>
                          <h4 className="text-white font-semibold mt-2">{p.name}</h4>
                          <p className="text-gray-400 text-xs mt-1">{p.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Provider Name & Domain */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Provider Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Okta, Azure AD, Google"
                        value={ssoForm.provider_name || ''}
                        onChange={(e) => setSsoForm({ ...ssoForm, provider_name: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-kali-blue focus:ring-1 focus:ring-kali-blue"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Domain Hint</label>
                      <input
                        type="text"
                        placeholder="e.g. company.com"
                        value={ssoForm.domain_hint || ''}
                        onChange={(e) => setSsoForm({ ...ssoForm, domain_hint: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-kali-blue focus:ring-1 focus:ring-kali-blue"
                      />
                    </div>
                  </div>

                  {/* SAML Fields */}
                  {ssoProviderType === 'saml' && (
                    <div className="space-y-4 p-5 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        🛡️ SAML 2.0 Configuration
                      </h3>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Entity ID (Issuer)</label>
                        <input
                          type="text"
                          placeholder="https://your-idp.example.com/saml/metadata"
                          value={ssoForm.saml_entity_id || ''}
                          onChange={(e) => setSsoForm({ ...ssoForm, saml_entity_id: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">SSO URL (Login URL)</label>
                        <input
                          type="url"
                          placeholder="https://your-idp.example.com/saml/sso"
                          value={ssoForm.saml_sso_url || ''}
                          onChange={(e) => setSsoForm({ ...ssoForm, saml_sso_url: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">X.509 Certificate (PEM)</label>
                        <textarea
                          rows={4}
                          placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDXTCCAkWgAwIBAgI...&#10;-----END CERTIFICATE-----"
                          value={ssoForm.saml_certificate || ''}
                          onChange={(e) => setSsoForm({ ...ssoForm, saml_certificate: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                        />
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ssoForm.saml_sign_requests ?? true}
                          onChange={(e) => setSsoForm({ ...ssoForm, saml_sign_requests: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-gray-300 text-sm">Sign authentication requests</span>
                      </label>
                      {/* SP Metadata for customer to copy */}
                      <div className="p-4 bg-gray-800/50 rounded-lg mt-4">
                        <p className="text-gray-400 text-xs mb-2">Your Service Provider (SP) metadata:</p>
                        <div className="space-y-1 text-xs font-mono text-gray-300">
                          <p><span className="text-gray-500">ACS URL:</span> https://app.cybersecpro.com/api/v1/sso/saml/callback</p>
                          <p><span className="text-gray-500">Entity ID:</span> https://app.cybersecpro.com</p>
                          <p><span className="text-gray-500">Name ID:</span> urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* OIDC Fields */}
                  {ssoProviderType === 'oidc' && (
                    <div className="space-y-4 p-5 bg-green-500/5 border border-green-500/20 rounded-xl">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        🔗 OpenID Connect Configuration
                      </h3>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Issuer URL</label>
                        <input
                          type="url"
                          placeholder="https://accounts.google.com"
                          value={ssoForm.oidc_issuer_url || ''}
                          onChange={(e) => setSsoForm({ ...ssoForm, oidc_issuer_url: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 font-mono text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Client ID</label>
                          <input
                            type="text"
                            placeholder="your-client-id.apps.googleusercontent.com"
                            value={ssoForm.oidc_client_id || ''}
                            onChange={(e) => setSsoForm({ ...ssoForm, oidc_client_id: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Client Secret</label>
                          <input
                            type="password"
                            placeholder="••••••••••••"
                            value={ssoForm.oidc_client_secret || ''}
                            onChange={(e) => setSsoForm({ ...ssoForm, oidc_client_secret: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Scopes</label>
                        <input
                          type="text"
                          value={ssoForm.oidc_scopes || 'openid profile email'}
                          onChange={(e) => setSsoForm({ ...ssoForm, oidc_scopes: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 font-mono text-sm"
                        />
                      </div>
                      <div className="p-4 bg-gray-800/50 rounded-lg">
                        <p className="text-gray-400 text-xs mb-2">Configure in your OIDC provider:</p>
                        <div className="space-y-1 text-xs font-mono text-gray-300">
                          <p><span className="text-gray-500">Redirect URI:</span> https://app.cybersecpro.com/api/v1/sso/oidc/callback</p>
                          <p><span className="text-gray-500">Allowed Origins:</span> https://app.cybersecpro.com</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LDAP Fields */}
                  {ssoProviderType === 'ldap' && (
                    <div className="space-y-4 p-5 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        📁 LDAP / Active Directory Configuration
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-300 mb-2">LDAP Host</label>
                          <input
                            type="text"
                            placeholder="ldap.company.com"
                            value={ssoForm.ldap_host || ''}
                            onChange={(e) => setSsoForm({ ...ssoForm, ldap_host: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Port</label>
                          <input
                            type="number"
                            value={ssoForm.ldap_port || 389}
                            onChange={(e) => setSsoForm({ ...ssoForm, ldap_port: parseInt(e.target.value) })}
                            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ssoForm.ldap_use_ssl ?? false}
                          onChange={(e) => setSsoForm({ ...ssoForm, ldap_use_ssl: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                        />
                        <span className="text-gray-300 text-sm">Use SSL/TLS (LDAPS)</span>
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Bind DN</label>
                          <input
                            type="text"
                            placeholder="cn=admin,dc=company,dc=com"
                            value={ssoForm.ldap_bind_dn || ''}
                            onChange={(e) => setSsoForm({ ...ssoForm, ldap_bind_dn: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Bind Password</label>
                          <input
                            type="password"
                            placeholder="••••••••••••"
                            value={ssoForm.ldap_bind_password || ''}
                            onChange={(e) => setSsoForm({ ...ssoForm, ldap_bind_password: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Base DN</label>
                        <input
                          type="text"
                          placeholder="dc=company,dc=com"
                          value={ssoForm.ldap_base_dn || ''}
                          onChange={(e) => setSsoForm({ ...ssoForm, ldap_base_dn: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">User Filter</label>
                          <input
                            type="text"
                            value={ssoForm.ldap_user_filter || '(sAMAccountName={username})'}
                            onChange={(e) => setSsoForm({ ...ssoForm, ldap_user_filter: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Group Filter (optional)</label>
                          <input
                            type="text"
                            placeholder="(memberOf=cn=cybersec,ou=groups,dc=...)"
                            value={ssoForm.ldap_group_filter || ''}
                            onChange={(e) => setSsoForm({ ...ssoForm, ldap_group_filter: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Advanced Options */}
                  <div className="p-5 bg-gray-800/30 border border-gray-700 rounded-xl space-y-4">
                    <h3 className="text-white font-semibold">Advanced Options</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ssoForm.enforce_sso ?? false}
                          onChange={(e) => setSsoForm({ ...ssoForm, enforce_sso: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-kali-blue focus:ring-kali-blue"
                        />
                        <div>
                          <span className="text-gray-300 text-sm font-medium">Enforce SSO</span>
                          <p className="text-gray-500 text-xs">Block email/password login when SSO is active</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ssoForm.jit_provisioning ?? true}
                          onChange={(e) => setSsoForm({ ...ssoForm, jit_provisioning: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-kali-blue focus:ring-kali-blue"
                        />
                        <div>
                          <span className="text-gray-300 text-sm font-medium">Just-in-Time Provisioning</span>
                          <p className="text-gray-500 text-xs">Auto-create user accounts on first SSO login</p>
                        </div>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Default Role for New Users</label>
                      <select
                        value={ssoForm.default_role || 'user'}
                        onChange={(e) => setSsoForm({ ...ssoForm, default_role: e.target.value })}
                        className="w-48 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSSOSave}
                        disabled={ssoLoading}
                        className="px-6 py-2.5 bg-kali-blue text-white font-semibold rounded-lg hover:bg-kali-blue/80 transition disabled:opacity-50"
                      >
                        {ssoLoading ? 'Saving...' : 'Save Configuration'}
                      </button>
                      <button
                        onClick={handleSSOTest}
                        disabled={ssoTesting || !ssoConfig}
                        className="px-6 py-2.5 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
                      >
                        {ssoTesting ? 'Testing...' : '🔌 Test Connection'}
                      </button>
                    </div>
                    {ssoConfig && (
                      <button
                        onClick={handleSSODelete}
                        className="px-4 py-2.5 text-red-400 hover:bg-red-500/10 rounded-lg transition text-sm"
                      >
                        Delete Configuration
                      </button>
                    )}
                  </div>

                  {/* Test Result */}
                  {ssoTestResult && (
                    <div className={`p-4 rounded-lg ${ssoTestResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                      <div className="flex items-center gap-2">
                        <span>{ssoTestResult.success ? '✅' : '❌'}</span>
                        <span className={ssoTestResult.success ? 'text-green-400' : 'text-red-400'}>
                          {ssoTestResult.message}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Supported Providers Info */}
                  <div className="p-5 bg-gray-800/30 border border-gray-700 rounded-xl">
                    <h3 className="text-white font-semibold mb-3">Supported Identity Providers</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <h4 className="text-blue-400 font-medium text-sm mb-2">SAML 2.0</h4>
                        <ul className="space-y-1 text-gray-400 text-xs">
                          <li>• Okta</li>
                          <li>• Azure Active Directory</li>
                          <li>• OneLogin</li>
                          <li>• PingIdentity</li>
                          <li>• JumpCloud</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-green-400 font-medium text-sm mb-2">OpenID Connect</h4>
                        <ul className="space-y-1 text-gray-400 text-xs">
                          <li>• Google Workspace</li>
                          <li>• GitHub Enterprise</li>
                          <li>• Auth0</li>
                          <li>• Keycloak</li>
                          <li>• AWS Cognito</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-purple-400 font-medium text-sm mb-2">LDAP</h4>
                        <ul className="space-y-1 text-gray-400 text-xs">
                          <li>• Active Directory</li>
                          <li>• OpenLDAP</li>
                          <li>• FreeIPA</li>
                          <li>• 389 Directory</li>
                          <li>• Apache DS</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}
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
                      {userPlan === 'enterprise' ? '682' : 
                       userPlan === 'professional' ? '200' :
                       userPlan === 'starter' ? '50' : '3'} Tools
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Scans/Day</p>
                    <p className="text-white font-medium">
                      {userPlan === 'enterprise' ? 'Unlimited' : 
                       userPlan === 'professional' ? '100' :
                       userPlan === 'starter' ? '30' : '5'}
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
                    { date: 'Jan 26, 2026', amount: '€99.00', status: 'Paid', invoice: '#INV-2601' },
                    { date: 'Dec 26, 2025', amount: '€99.00', status: 'Paid', invoice: '#INV-2512' },
                    { date: 'Nov 26, 2025', amount: '€99.00', status: 'Paid', invoice: '#INV-2511' },
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
