/**
 * SSO Settings Tab
 * SAML 2.0, OpenID Connect, LDAP configuration
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { SettingsTabProps } from './types';
import { useSSOConfig, useSaveSSOConfig, useTestSSOConnection, useDeleteSSOConfig, useToggleSSO } from '../../../hooks/useApiQueries';

export function SSOTab({ setMessage, userPlan }: SettingsTabProps) {
  const { t } = useTranslation();
  const { data: ssoData } = useSSOConfig();
  const ssoConfig = ssoData?.config ?? null;
  const [ssoTestResult, setSsoTestResult] = useState<{ success: boolean; message: string } | null>(null);
  // Default to OIDC (the most common enterprise choice: Okta, Azure AD, Google,
  // GitHub). SAML 2.0 and LDAP are also fully supported — see the provider grid.
  const [ssoProviderType, setSsoProviderType] = useState<'saml' | 'ldap' | 'oidc'>('oidc');
  const [ssoForm, setSsoForm] = useState<Record<string, any>>({});

  const saveMutation = useSaveSSOConfig();
  const testMutation = useTestSSOConnection();
  const deleteMutation = useDeleteSSOConfig();
  const toggleMutation = useToggleSSO();

  const ssoLoading = saveMutation.isPending;
  const ssoTesting = testMutation.isPending;

  // Sync form from query data
  useEffect(() => {
    if (ssoConfig) {
      setSsoProviderType(ssoConfig.provider_type as 'saml' | 'ldap' | 'oidc' || 'oidc');
      setSsoForm(ssoConfig as Record<string, any>);
    }
  }, [ssoConfig]);

  const handleSSOSave = async () => {
    try {
      await saveMutation.mutateAsync({ ...ssoForm, provider_type: ssoProviderType });
      setMessage({ type: 'success', text: t('settings.sso.saved', 'SSO configuration saved!') });
    } catch {
      setMessage({ type: 'error', text: t('settings.sso.saveFailed', 'Failed to save SSO configuration') });
    }
  };

  const handleSSOTest = async () => {
    setSsoTestResult(null);
    try {
      const data = await testMutation.mutateAsync({ provider_type: ssoProviderType });
      setSsoTestResult({ success: data.success, message: data.message || (data.success ? t('settings.sso.connectionSuccessful', 'Connection successful!') : t('settings.sso.testFailed', 'Test failed')) });
    } catch {
      setSsoTestResult({ success: false, message: t('settings.sso.networkError', 'Network error during test') });
    }
  };

  const handleSSODelete = async () => {
    if (!confirm(t('settings.sso.deleteConfirm', 'Delete SSO configuration? Users will need to use email/password login.'))) return;
    try {
      await deleteMutation.mutateAsync();
      setSsoForm({});
      setMessage({ type: 'success', text: t('settings.sso.deleted', 'SSO configuration deleted') });
    } catch {
      setMessage({ type: 'error', text: t('settings.sso.deleteFailed', 'Failed to delete') });
    }
  };

  const handleSSOToggle = async () => {
    try {
      await toggleMutation.mutateAsync(!ssoConfig?.is_enabled);
      setMessage({ type: 'success', text: ssoConfig?.is_enabled ? t('settings.sso.disabled', 'SSO disabled') : t('settings.sso.enabled', 'SSO enabled') });
    } catch { /* ignore */ }
  };

  const inputCls = (color: string = 'kali-blue') =>
    `w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-${color} focus:ring-1 focus:ring-${color} font-mono text-sm transition`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">{t('settings.sso.heading', 'Single Sign-On (SSO)')}</h2>
          <p className="text-gray-400 text-sm">{t('settings.sso.subtitle', 'Connect your Identity Provider for secure team authentication')}</p>
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
              <h3 className="text-white font-semibold mb-1">{t('sso.enterpriseRequired', 'SSO requires Enterprise plan')}</h3>
              <p className="text-gray-400 text-sm mb-3">
                Upgrade to connect your Identity Provider (Okta, Azure AD, Google Workspace, Active Directory).
              </p>
              <a href="/dashboard/upgrade" className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-gray-900 font-semibold rounded-lg hover:bg-yellow-400 transition text-sm btn-micro">
                Upgrade Now →
              </a>
            </div>
          </div>
        </div>
      )}

      {userPlan === 'enterprise' && (
        <>
          {/* Provider Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">{t('sso.providerType', 'Identity Provider Type')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { id: 'oidc' as const, name: 'OpenID Connect', desc: 'Okta, Azure AD, Google Workspace, GitHub', icon: '🔗', available: true },
                { id: 'ldap' as const, name: 'LDAP', desc: 'Active Directory, OpenLDAP', icon: '📁', available: true },
                { id: 'saml' as const, name: 'SAML 2.0', desc: 'Okta, Azure AD, OneLogin, ADFS, Ping', icon: '🛡️', available: true },
              ]).map((p) => (
                <button
                  key={p.id}
                  disabled={!p.available}
                  onClick={() => { if (!p.available) return; setSsoProviderType(p.id); setSsoForm((f: any) => ({ ...f, provider_type: p.id })); }}
                  className={`relative p-4 rounded-xl border-2 text-left transition ${
                    !p.available
                      ? 'border-gray-800 bg-gray-800/30 opacity-60 cursor-not-allowed'
                      : ssoProviderType === p.id
                        ? 'border-kali-blue bg-kali-blue/10'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  {!p.available && (
                    <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wide bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                      {t('sso.comingSoon', 'Coming soon')}
                    </span>
                  )}
                  <span className="text-2xl">{p.icon}</span>
                  <h4 className="text-white font-semibold mt-2">{p.name}</h4>
                  <p className="text-gray-400 text-xs mt-1">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Name & Domain */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('sso.providerName', 'Provider Name')}</label>
              <input type="text" placeholder={t('sso.providerPlaceholder', 'e.g. Okta, Azure AD')} value={ssoForm.provider_name || ''} onChange={(e) => setSsoForm({ ...ssoForm, provider_name: e.target.value })} className={inputCls()} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('sso.domainHint', 'Domain Hint')}</label>
              <input type="text" placeholder={t('sso.domainPlaceholder', 'e.g. company.com')} value={ssoForm.domain_hint || ''} onChange={(e) => setSsoForm({ ...ssoForm, domain_hint: e.target.value })} className={inputCls()} />
            </div>
          </div>

          {/* SAML */}
          {ssoProviderType === 'saml' && (
            <div className="space-y-4 p-5 bg-blue-500/5 border border-blue-500/20 rounded-xl">
              <h3 className="text-white font-semibold flex items-center gap-2">🛡️ SAML 2.0 Configuration</h3>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('sso.entityId', 'Entity ID (Issuer)')}</label>
                <input type="text" placeholder={t('sso.entityIdPlaceholder', 'https://your-idp.example.com/saml/metadata')} value={ssoForm.saml_entity_id || ''} onChange={(e) => setSsoForm({ ...ssoForm, saml_entity_id: e.target.value })} className={inputCls('blue-500')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('sso.ssoUrl', 'SSO URL (Login URL)')}</label>
                <input type="url" placeholder={t('sso.ssoUrlPlaceholder', 'https://your-idp.example.com/saml/sso')} value={ssoForm.saml_sso_url || ''} onChange={(e) => setSsoForm({ ...ssoForm, saml_sso_url: e.target.value })} className={inputCls('blue-500')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">X.509 Certificate (PEM)</label>
                <textarea rows={4} placeholder="-----BEGIN CERTIFICATE-----" value={ssoForm.saml_certificate || ''} onChange={(e) => setSsoForm({ ...ssoForm, saml_certificate: e.target.value })} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-xs transition" />
              </div>
              <div className="p-4 bg-gray-800/50 rounded-lg mt-4">
                <p className="text-gray-400 text-xs mb-2">{t('sso.spMetadata', 'Your Service Provider (SP) metadata:')}</p>
                <div className="space-y-1 text-xs font-mono text-gray-300">
                  <p><span className="text-gray-500">ACS URL:</span> https://api.cyber-sec-pro.com/v1/auth/sso/saml/callback</p>
                  <p><span className="text-gray-500">Entity ID:</span> https://api.cyber-sec-pro.com/saml/metadata</p>
                  <p><span className="text-gray-500">Metadata:</span> https://api.cyber-sec-pro.com/v1/auth/sso/saml/metadata</p>
                  <p><span className="text-gray-500">Name ID:</span> urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</p>
                </div>
              </div>
            </div>
          )}

          {/* OIDC */}
          {ssoProviderType === 'oidc' && (
            <div className="space-y-4 p-5 bg-green-500/5 border border-green-500/20 rounded-xl">
              <h3 className="text-white font-semibold flex items-center gap-2">🔗 OpenID Connect Configuration</h3>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('sso.issuerUrl', 'Issuer URL')}</label>
                <input type="url" placeholder={t('sso.issuerUrlPlaceholder', 'https://accounts.google.com')} value={ssoForm.oidc_issuer_url || ''} onChange={(e) => setSsoForm({ ...ssoForm, oidc_issuer_url: e.target.value })} className={inputCls('green-500')} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t('sso.clientId', 'Client ID')}</label>
                  <input type="text" placeholder={t('sso.clientIdPlaceholder', 'your-client-id')} value={ssoForm.oidc_client_id || ''} onChange={(e) => setSsoForm({ ...ssoForm, oidc_client_id: e.target.value })} className={inputCls('green-500')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t('sso.clientSecret', 'Client Secret')}</label>
                  <input type="password" placeholder="••••••••" value={ssoForm.oidc_client_secret || ''} onChange={(e) => setSsoForm({ ...ssoForm, oidc_client_secret: e.target.value })} className={inputCls('green-500')} />
                </div>
              </div>
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <p className="text-gray-400 text-xs mb-2">{t('sso.oidcProviderHint', 'Configure in your OIDC provider:')}</p>
                <div className="space-y-1 text-xs font-mono text-gray-300">
                  <p><span className="text-gray-500">Redirect URI:</span> https://app.cyber-sec-pro.com/api/v1/sso/oidc/callback</p>
                </div>
              </div>
            </div>
          )}

          {/* LDAP */}
          {ssoProviderType === 'ldap' && (
            <div className="space-y-4 p-5 bg-purple-500/5 border border-purple-500/20 rounded-xl">
              <h3 className="text-white font-semibold flex items-center gap-2">📁 LDAP / Active Directory</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t('sso.ldapHost', 'LDAP Host')}</label>
                  <input type="text" placeholder={t('sso.ldapHostPlaceholder', 'ldap.company.com')} value={ssoForm.ldap_host || ''} onChange={(e) => setSsoForm({ ...ssoForm, ldap_host: e.target.value })} className={inputCls('purple-500')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t('sso.port', 'Port')}</label>
                  <input type="number" value={ssoForm.ldap_port || 389} onChange={(e) => setSsoForm({ ...ssoForm, ldap_port: parseInt(e.target.value) })} className={inputCls('purple-500')} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t('sso.bindDn', 'Bind DN')}</label>
                  <input type="text" placeholder={t('sso.bindDnPlaceholder', 'cn=admin,dc=company,dc=com')} value={ssoForm.ldap_bind_dn || ''} onChange={(e) => setSsoForm({ ...ssoForm, ldap_bind_dn: e.target.value })} className={inputCls('purple-500')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{t('sso.bindPassword', 'Bind Password')}</label>
                  <input type="password" placeholder="••••••••" value={ssoForm.ldap_bind_password || ''} onChange={(e) => setSsoForm({ ...ssoForm, ldap_bind_password: e.target.value })} className={inputCls('purple-500')} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('sso.baseDn', 'Base DN')}</label>
                <input type="text" placeholder={t('sso.baseDnPlaceholder', 'dc=company,dc=com')} value={ssoForm.ldap_base_dn || ''} onChange={(e) => setSsoForm({ ...ssoForm, ldap_base_dn: e.target.value })} className={inputCls('purple-500')} />
              </div>
            </div>
          )}

          {/* Advanced */}
          <div className="p-5 bg-gray-800/30 border border-gray-700 rounded-xl space-y-4">
            <h3 className="text-white font-semibold">{t('sso.advancedOptions', 'Advanced Options')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={ssoForm.enforce_sso ?? false} onChange={(e) => setSsoForm({ ...ssoForm, enforce_sso: e.target.checked })} className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-kali-blue focus:ring-kali-blue" />
                <div>
                  <span className="text-gray-300 text-sm font-medium">{t('sso.enforceSSO', 'Enforce SSO')}</span>
                  <p className="text-gray-500 text-xs">{t('sso.enforceDesc', 'Block email/password login')}</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={ssoForm.jit_provisioning ?? true} onChange={(e) => setSsoForm({ ...ssoForm, jit_provisioning: e.target.checked })} className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-kali-blue focus:ring-kali-blue" />
                <div>
                  <span className="text-gray-300 text-sm font-medium">{t('sso.jitProvisioning', 'JIT Provisioning')}</span>
                  <p className="text-gray-500 text-xs">{t('sso.jitDesc', 'Auto-create accounts on first SSO login')}</p>
                </div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <button onClick={handleSSOSave} disabled={ssoLoading} className="px-6 py-2.5 bg-kali-blue text-white font-semibold rounded-lg hover:bg-kali-blue/80 transition disabled:opacity-50 btn-micro">
                {ssoLoading ? 'Saving...' : 'Save Configuration'}
              </button>
              <button onClick={handleSSOTest} disabled={ssoTesting || !ssoConfig} className="px-6 py-2.5 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition disabled:opacity-50 btn-micro">
                {ssoTesting ? 'Testing...' : '🔌 Test Connection'}
              </button>
            </div>
            {ssoConfig && (
              <button onClick={handleSSODelete} className="px-4 py-2.5 text-red-400 hover:bg-red-500/10 rounded-lg transition text-sm">
                Delete Configuration
              </button>
            )}
          </div>

          {/* Test Result */}
          {ssoTestResult && (
            <div className={`p-4 rounded-lg ${ssoTestResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <div className="flex items-center gap-2">
                <span>{ssoTestResult.success ? '✅' : '❌'}</span>
                <span className={ssoTestResult.success ? 'text-green-400' : 'text-red-400'}>{ssoTestResult.message}</span>
              </div>
            </div>
          )}

          {/* Supported Providers */}
          <div className="p-5 bg-gray-800/30 border border-gray-700 rounded-xl">
            <h3 className="text-white font-semibold mb-3">{t('sso.supportedProviders', 'Supported Identity Providers')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { title: 'SAML 2.0', color: 'text-blue-400', items: ['Okta', 'Azure AD', 'OneLogin', 'PingIdentity', 'JumpCloud'] },
                { title: 'OpenID Connect', color: 'text-green-400', items: ['Google Workspace', 'GitHub Enterprise', 'Auth0', 'Keycloak', 'AWS Cognito'] },
                { title: 'LDAP', color: 'text-purple-400', items: ['Active Directory', 'OpenLDAP', 'FreeIPA', '389 Directory', 'Apache DS'] },
              ].map(cat => (
                <div key={cat.title}>
                  <h4 className={`${cat.color} font-medium text-sm mb-2`}>{cat.title}</h4>
                  <ul className="space-y-1 text-gray-400 text-xs">
                    {cat.items.map(item => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
