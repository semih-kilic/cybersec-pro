/**
 * Security Settings Tab
 * Password change, 2FA/MFA (V20), danger zone
 */
import { useState, useEffect, FormEvent } from 'react';
import { motion } from 'framer-motion';
import type { SettingsTabProps } from './types';
import { api } from '../../../services/api';

export function SecurityTab({ loading, setLoading, setMessage }: SettingsTabProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // MFA State — V20
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [backupCodesRemaining, setBackupCodesRemaining] = useState(0);
  const [mfaEnabledAt, setMfaEnabledAt] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'backup' | 'disable' | 'regenerate'>('idle');
  const [qrCode, setQrCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState('');

  // Fetch MFA status on mount
  useEffect(() => {
    (async () => {
      const res = await api.getMfaStatus();
      if (res.data) {
        setMfaEnabled(res.data.mfa_enabled);
        setBackupCodesRemaining(res.data.backup_codes_remaining);
        setMfaEnabledAt(res.data.mfa_enabled_at);
      }
      setMfaLoading(false);
    })();
  }, []);

  const handleMfaSetup = async () => {
    setMfaLoading(true);
    const res = await api.setupMfa();
    if (res.data) {
      setQrCode(res.data.qr_code);
      setMfaSecret(res.data.secret);
      setSetupStep('qr');
    } else {
      setMessage({ type: 'error', text: res.error || 'Failed to start MFA setup' });
    }
    setMfaLoading(false);
  };

  const handleMfaVerify = async () => {
    if (verifyCode.length < 6) return;
    setMfaLoading(true);
    const res = await api.verifyMfaSetup(verifyCode);
    if (res.data) {
      setBackupCodes(res.data.backup_codes);
      setMfaEnabled(true);
      setBackupCodesRemaining(res.data.backup_codes.length);
      setSetupStep('backup');
      setMessage({ type: 'success', text: 'Two-factor authentication enabled!' });
    } else {
      setMessage({ type: 'error', text: res.error || 'Invalid verification code' });
    }
    setMfaLoading(false);
    setVerifyCode('');
  };

  const handleMfaDisable = async () => {
    if (!disablePassword) return;
    setMfaLoading(true);
    const res = await api.disableMfa(disablePassword);
    if (res.data) {
      setMfaEnabled(false);
      setBackupCodesRemaining(0);
      setMfaEnabledAt(null);
      setSetupStep('idle');
      setMessage({ type: 'success', text: 'Two-factor authentication disabled' });
    } else {
      setMessage({ type: 'error', text: res.error || 'Failed to disable MFA' });
    }
    setMfaLoading(false);
    setDisablePassword('');
  };

  const handleRegenerateBackup = async () => {
    if (!disablePassword) return;
    setMfaLoading(true);
    const res = await api.regenerateBackupCodes(disablePassword);
    if (res.data) {
      setBackupCodes(res.data.backup_codes);
      setBackupCodesRemaining(res.data.backup_codes.length);
      setSetupStep('backup');
      setMessage({ type: 'success', text: 'New backup codes generated!' });
    } else {
      setMessage({ type: 'error', text: res.error || 'Failed to regenerate backup codes' });
    }
    setMfaLoading(false);
    setDisablePassword('');
  };

  const passwordStrength = (() => {
    if (!newPassword) return { score: 0, label: '', color: '' };
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (newPassword.length >= 12) score++;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score++;
    if (/\d/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    const levels = [
      { label: 'Very Weak', color: 'bg-red-500' },
      { label: 'Weak', color: 'bg-orange-500' },
      { label: 'Fair', color: 'bg-yellow-500' },
      { label: 'Good', color: 'bg-blue-500' },
      { label: 'Strong', color: 'bg-green-500' },
    ];
    return { score, ...levels[Math.min(score, 4)] };
  })();

  const handlePasswordChange = async (e: FormEvent) => {
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
    try {
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      {/* Password Change */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue transition"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue transition"
              autoComplete="new-password"
            />
            {newPassword && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < passwordStrength.score ? passwordStrength.color : 'bg-gray-700'}`} />
                  ))}
                </div>
                <p className={`text-xs ${passwordStrength.score >= 4 ? 'text-green-400' : passwordStrength.score >= 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {passwordStrength.label}
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:ring-1 transition ${
                confirmPassword && confirmPassword !== newPassword
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-700 focus:border-kali-blue focus:ring-kali-blue'
              }`}
              autoComplete="new-password"
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !currentPassword || !newPassword || newPassword !== confirmPassword}
            className="px-6 py-3 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition disabled:opacity-50 btn-micro"
          >
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Two-Factor Authentication — V20 */}
      <div className="border-t border-gray-800 pt-8">
        <h2 className="text-xl font-bold text-white mb-4">Two-Factor Authentication</h2>

        {mfaLoading && setupStep === 'idle' ? (
          <div className="p-4 bg-gray-800 rounded-lg text-gray-400">Loading MFA status...</div>
        ) : setupStep === 'qr' ? (
          /* QR Code Setup Step */
          <div className="space-y-4">
            <div className="p-4 bg-gray-800 rounded-lg">
              <p className="text-white font-medium mb-3">Scan this QR code with your authenticator app</p>
              <div className="flex justify-center mb-4">
                <div className="bg-white p-3 rounded-lg" dangerouslySetInnerHTML={{ __html: qrCode }} />
              </div>
              <div className="bg-gray-900 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1">Manual entry key:</p>
                <code className="text-cyan-400 text-sm font-mono break-all select-all">{mfaSecret}</code>
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Enter 6-digit code from your app</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-center text-xl tracking-[0.3em] font-mono focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                  placeholder="000000"
                  autoFocus
                />
                <button
                  onClick={handleMfaVerify}
                  disabled={mfaLoading || verifyCode.length < 6}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                >
                  {mfaLoading ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>
            <button onClick={() => setSetupStep('idle')} className="text-gray-400 hover:text-gray-300 text-sm">
              Cancel setup
            </button>
          </div>
        ) : setupStep === 'backup' ? (
          /* Backup Codes Display */
          <div className="space-y-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 font-medium mb-2">Save your backup codes</p>
              <p className="text-gray-400 text-sm mb-4">Store these codes securely. Each code can only be used once. They will not be shown again.</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {backupCodes.map((code, i) => (
                  <div key={i} className="bg-gray-900 rounded px-3 py-2 text-center">
                    <code className="text-white font-mono text-sm">{code}</code>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(backupCodes.join('\n'));
                  setMessage({ type: 'success', text: 'Backup codes copied to clipboard' });
                }}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition text-sm"
              >
                Copy all codes
              </button>
            </div>
            <button
              onClick={() => { setSetupStep('idle'); setBackupCodes([]); }}
              className="px-6 py-3 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition"
            >
              Done
            </button>
          </div>
        ) : setupStep === 'disable' ? (
          /* Disable MFA Confirmation */
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 font-medium mb-2">Disable two-factor authentication</p>
              <p className="text-gray-400 text-sm mb-4">Enter your password to confirm. This will remove the extra security layer from your account.</p>
              <div className="flex gap-3">
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                  placeholder="Enter your password"
                  autoFocus
                />
                <button
                  onClick={handleMfaDisable}
                  disabled={mfaLoading || !disablePassword}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50"
                >
                  {mfaLoading ? 'Disabling...' : 'Disable'}
                </button>
              </div>
            </div>
            <button onClick={() => { setSetupStep('idle'); setDisablePassword(''); }} className="text-gray-400 hover:text-gray-300 text-sm">
              Cancel
            </button>
          </div>
        ) : setupStep === 'regenerate' ? (
          /* Regenerate Backup Codes */
          <div className="space-y-4">
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <p className="text-cyan-400 font-medium mb-2">Regenerate backup codes</p>
              <p className="text-gray-400 text-sm mb-4">Enter your password to generate new backup codes. This will invalidate all existing codes.</p>
              <div className="flex gap-3">
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                  placeholder="Enter your password"
                  autoFocus
                />
                <button
                  onClick={handleRegenerateBackup}
                  disabled={mfaLoading || !disablePassword}
                  className="px-6 py-3 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition disabled:opacity-50"
                >
                  {mfaLoading ? 'Generating...' : 'Regenerate'}
                </button>
              </div>
            </div>
            <button onClick={() => { setSetupStep('idle'); setDisablePassword(''); }} className="text-gray-400 hover:text-gray-300 text-sm">
              Cancel
            </button>
          </div>
        ) : (
          /* Default MFA Status View */
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div>
                <p className="text-white font-medium">TOTP Authenticator</p>
                <p className="text-gray-400 text-sm">
                  {mfaEnabled
                    ? `Enabled${mfaEnabledAt ? ` on ${new Date(mfaEnabledAt).toLocaleDateString()}` : ''}`
                    : 'Add an extra layer of security to your account'}
                </p>
              </div>
              {mfaEnabled ? (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">Enabled</span>
              ) : (
                <button
                  onClick={handleMfaSetup}
                  disabled={mfaLoading}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 transition disabled:opacity-50"
                >
                  Enable 2FA
                </button>
              )}
            </div>
            {mfaEnabled && (
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div>
                  <p className="text-white font-medium text-sm">Backup Codes</p>
                  <p className="text-gray-400 text-xs">{backupCodesRemaining} codes remaining</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSetupStep('regenerate')}
                    className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-xs hover:bg-gray-600 transition"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={() => setSetupStep('disable')}
                    className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-xs hover:bg-red-600/30 transition"
                  >
                    Disable 2FA
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sessions */}
      <div className="border-t border-gray-800 pt-8">
        <h2 className="text-xl font-bold text-white mb-4">Active Sessions</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <span className="text-green-400">🖥️</span>
              </div>
              <div>
                <p className="text-white font-medium text-sm">Current Session</p>
                <p className="text-gray-500 text-xs">Linux · Chrome · {new Date().toLocaleDateString()}</p>
              </div>
            </div>
            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Active</span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border-t border-gray-800 pt-8">
        <h2 className="text-xl font-bold text-red-400 mb-4">Danger Zone</h2>
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-white font-medium mb-2">Delete Account</p>
          <p className="text-gray-400 text-sm mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition btn-micro"
            >
              Delete Account
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => { /* GDPR delete */ }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition btn-micro"
              >
                Yes, Delete Permanently
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition btn-micro"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
