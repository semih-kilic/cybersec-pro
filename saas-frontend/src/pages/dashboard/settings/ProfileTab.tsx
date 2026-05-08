/**
 * Profile Settings Tab
 * Avatar upload, name, email, company
 */
import { useState, useRef, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { SettingsTabProps } from './types';
import { useUploadAvatar, useUpdateProfile } from '../../../hooks/useApiQueries';

export function ProfileTab({ loading, setLoading, setMessage, user }: SettingsTabProps) {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email] = useState(user?.email || '');
  const [company, setCompany] = useState(user?.company || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const avatarMutation = useUploadAvatar();
  const profileMutation = useUpdateProfile();
  const uploadingAvatar = avatarMutation.isPending;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: t('settings.profile.fileTooLarge', 'File too large. Maximum 2MB allowed.') });
      return;
    }

    try {
      const data = await avatarMutation.mutateAsync(file);
      setAvatarUrl(data.avatar_url || URL.createObjectURL(file));
      setMessage({ type: 'success', text: t('settings.profile.avatarUpdated', 'Avatar updated!') });
    } catch {
      setMessage({ type: 'error', text: t('settings.profile.avatarUploadFailed', 'Failed to upload avatar') });
    }
  };

  const handleProfileUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await profileMutation.mutateAsync({ first_name: firstName, last_name: lastName, company });
      setMessage({ type: 'success', text: t('settings.profile.updated', 'Profile updated successfully!') });
    } catch {
      setMessage({ type: 'error', text: t('settings.profile.updateFailed', 'Failed to update profile') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onSubmit={handleProfileUpdate}
      className="space-y-6"
    >
      <h2 className="text-xl font-bold text-white mb-4">{t('settings.profile.heading', 'Profile Information')}</h2>

      {/* Avatar */}
      <div className="flex items-center gap-6 mb-8">
        <div className="relative group">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-gray-700 group-hover:border-kali-blue transition" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-kali-blue to-kali-purple flex items-center justify-center text-3xl text-white font-bold">
              {firstName?.charAt(0) || email?.charAt(0) || '?'}
            </div>
          )}
          {uploadingAvatar && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div>
          <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/jpeg,image/png,image/gif" className="hidden" />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 btn-micro"
          >
            {uploadingAvatar ? 'Uploading...' : 'Change Avatar'}
          </button>
          <p className="text-gray-500 text-sm mt-1">{t('profile.avatarHint', 'JPG, PNG or GIF. Max 2MB.')}</p>
        </div>
      </div>

      {/* Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-gray-400 text-sm mb-2">{t('profile.firstName', 'First Name')}</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue transition"
          />
        </div>
        <div>
          <label className="block text-gray-400 text-sm mb-2">{t('profile.lastName', 'Last Name')}</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue transition"
          />
        </div>
      </div>

      {/* Email (read-only) */}
      <div>
        <label className="block text-gray-400 text-sm mb-2">{t('profile.email', 'Email')}</label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-500 cursor-not-allowed"
        />
        <p className="text-gray-500 text-sm mt-1">
          {t('profile.emailReadOnly', 'Email cannot be changed')} · 
          <a href="mailto:support@cybersec.pro?subject=Email%20change%20request" className="text-cyan-400 hover:underline">
            {t('profile.emailContactSupport', 'Contact support to change')}
          </a>
        </p>
      </div>

      {/* Company */}
      <div>
        <label className="block text-gray-400 text-sm mb-2">{t('profile.company', 'Company')}</label>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:ring-1 focus:ring-kali-blue transition"
          placeholder={t('profile.companyPlaceholder', 'Your company name')}
        />
      </div>

      <div className="pt-4 border-t border-gray-800">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition disabled:opacity-50 btn-micro"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </motion.form>
  );
}
