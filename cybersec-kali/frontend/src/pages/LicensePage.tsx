import { useState, useEffect } from 'react';
import { 
  Key, Shield, Check, X, Crown, 
  Users, AlertTriangle,
  CheckCircle, Sparkles
} from 'lucide-react';
import axios from 'axios';

const API_URL = '';

interface LicenseInfo {
  status: string;
  plan?: string;
  expires_at?: string;
  message?: string;
  features?: {
    tools: number;
    scans_per_day: number;
    reports: boolean;
    api_access: boolean;
    support: string;
  };
}

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
}

export default function LicensePage() {
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    loadLicenseInfo();
    loadPlans();
  }, []);

  const loadLicenseInfo = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/license/status`);
      setLicenseInfo(response.data);
    } catch (error) {
      console.error('Failed to load license info:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/license/plans`);
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('Failed to load plans:', error);
    }
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter a license key' });
      return;
    }

    setActivating(true);
    setMessage(null);

    try {
      const response = await axios.post(`${API_URL}/api/license/activate`, {
        license_key: licenseKey
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message });
        setLicenseKey('');
        loadLicenseInfo();
      } else {
        setMessage({ type: 'error', text: response.data.message });
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Activation failed' 
      });
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Are you sure you want to deactivate the license?')) return;

    try {
      await axios.post(`${API_URL}/api/license/deactivate`);
      setMessage({ type: 'success', text: 'License deactivated successfully' });
      loadLicenseInfo();
    } catch (error) {
      setMessage({ type: 'error', text: 'Deactivation failed' });
    }
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'basic': return <Shield className="w-8 h-8" />;
      case 'professional': return <Crown className="w-8 h-8" />;
      case 'enterprise': return <Sparkles className="w-8 h-8" />;
      default: return <Key className="w-8 h-8" />;
    }
  };

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'basic': return 'from-blue-500 to-cyan-500';
      case 'professional': return 'from-purple-500 to-pink-500';
      case 'enterprise': return 'from-yellow-500 to-orange-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-2xl text-white animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Key className="w-10 h-10 text-cyan-400" />
          License Management
        </h1>
        <p className="text-gray-400">Manage your CyberSec Pro license</p>
      </div>

      {/* Current License Status */}
      <div className={`bg-dark-card rounded-2xl p-6 border mb-8 ${
        licenseInfo?.status === 'active' 
          ? 'border-green-500/30' 
          : 'border-yellow-500/30'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {licenseInfo?.status === 'active' ? (
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-yellow-400" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">
                {licenseInfo?.status === 'active' 
                  ? `${licenseInfo.plan?.toUpperCase()} Plan Active` 
                  : 'License Not Active'}
              </h2>
              <p className="text-gray-400">
                {licenseInfo?.status === 'active' && licenseInfo.expires_at
                  ? `Expires: ${new Date(licenseInfo.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
                  : licenseInfo?.message}
              </p>
            </div>
          </div>

          {licenseInfo?.status === 'active' && (
            <button
              onClick={handleDeactivate}
              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              Deactivate
            </button>
          )}
        </div>

        {/* Features */}
        {licenseInfo?.features && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-gray-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">
                {licenseInfo.features.tools === -1 ? '∞' : licenseInfo.features.tools}
              </div>
              <div className="text-sm text-gray-400">Tools</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">
                {licenseInfo.features.scans_per_day === -1 ? '∞' : licenseInfo.features.scans_per_day}
              </div>
              <div className="text-sm text-gray-400">Scans/Day</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">
                {licenseInfo.features.reports ? <Check className="w-6 h-6 mx-auto" /> : <X className="w-6 h-6 mx-auto text-red-400" />}
              </div>
              <div className="text-sm text-gray-400">Reports</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">
                {licenseInfo.features.api_access ? <Check className="w-6 h-6 mx-auto" /> : <X className="w-6 h-6 mx-auto text-red-400" />}
              </div>
              <div className="text-sm text-gray-400">API Access</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-cyan-400 capitalize">
                {licenseInfo.features.support}
              </div>
              <div className="text-sm text-gray-400">Support</div>
            </div>
          </div>
        )}
      </div>

      {/* Activation Form */}
      {licenseInfo?.status !== 'active' && (
        <div className="bg-dark-card rounded-2xl p-6 border border-gray-700 mb-8">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-cyan-400" />
            License Activation
          </h3>

          <div className="flex gap-4">
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              placeholder="CSEC-XXXX-XXXX-XXXX-XXXX"
              className="flex-1 bg-dark-bg border border-gray-600 rounded-xl px-4 py-3 text-white font-mono focus:border-cyan-500 focus:outline-none"
            />
            <button
              onClick={handleActivate}
              disabled={activating}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {activating ? 'Activating...' : 'Activate'}
            </button>
          </div>

          {message && (
            <div className={`mt-4 p-3 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {message.text}
            </div>
          )}
        </div>
      )}

      {/* Pricing Plans */}
      <h3 className="text-2xl font-bold text-white mb-6">License Plans</h3>
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-dark-card rounded-2xl p-6 border border-gray-700 relative overflow-hidden ${
              plan.id === 'professional' ? 'ring-2 ring-purple-500' : ''
            }`}
          >
            {plan.id === 'professional' && (
              <div className="absolute top-4 right-4 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                Popular
              </div>
            )}

            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getPlanColor(plan.id)} flex items-center justify-center text-white mb-4`}>
              {getPlanIcon(plan.id)}
            </div>

            <h4 className="text-xl font-bold text-white mb-2">{plan.name}</h4>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-bold text-white">${plan.price}</span>
              <span className="text-gray-400">/year</span>
            </div>

            <ul className="space-y-3 mb-6">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-gray-300">
                  <Check className="w-5 h-5 text-green-400" />
                  {feature}
                </li>
              ))}
            </ul>

            <a
              href={`mailto:cybersecpro@semihkilic.com?subject=CyberSec Pro ${plan.name} License&body=Hello, I would like to purchase a ${plan.name} plan license.`}
              className={`block w-full py-3 rounded-xl text-center font-medium transition-colors ${
                plan.id === 'professional'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              Purchase
            </a>
          </div>
        ))}
      </div>

      {/* Contact */}
      <div className="mt-8 bg-dark-card rounded-2xl p-6 border border-gray-700 text-center">
        <h4 className="text-lg font-bold text-white mb-2">Enterprise Solutions</h4>
        <p className="text-gray-400 mb-4">
          Contact us for large teams and custom requirements
        </p>
        <a
          href="mailto:cybersecpro@semihkilic.com"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-medium hover:opacity-90"
        >
          <Users className="w-5 h-5" />
          Get Enterprise Quote
        </a>
      </div>
    </div>
  );
}
