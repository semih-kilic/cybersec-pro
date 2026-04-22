import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { SettingsTabProps } from './types';
import api from '../../../services/api';

const DEFAULT_PROFILE = {
  chains: {
    credential: 0.55,
    lateral: 0.62,
    default: 0.72,
  },
  target: {
    prod_penalty: 0.10,
    dev_bonus: 0.08,
  },
  bounds: {
    min: 0.25,
    max: 0.90,
  },
};

const PROFILE_JSON_ENV_VAR = 'PURPLE_TEAM_PROFILE_JSON';
const PROFILE_DETECT_ENV_VAR_PATTERN = 'PURPLE_TEAM_DETECT_*';

export function PurpleTeamProfileTab({ user, setLoading, setMessage }: SettingsTabProps) {
  const { t } = useTranslation();
  const [profileText, setProfileText] = useState(JSON.stringify(DEFAULT_PROFILE, null, 2));
  const [source, setSource] = useState<'db' | 'default'>('default');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await api.getPurpleTeamProfile();
      if (res.error) {
        setMessage({ type: 'error', text: res.error });
        return;
      }

      const nextProfile = res.data?.profile && Object.keys(res.data.profile).length > 0
        ? res.data.profile
        : DEFAULT_PROFILE;

      setProfileText(JSON.stringify(nextProfile, null, 2));
      setSource(res.data?.source || 'default');
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleReset = () => {
    setProfileText(JSON.stringify(DEFAULT_PROFILE, null, 2));
    setMessage(null);
  };

  const handleSave = async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(profileText) as Record<string, unknown>;
    } catch {
      setMessage({ type: 'error', text: t('settings.purpleTeamProfile.invalidJson', 'Profile JSON is not valid.') });
      return;
    }

    setSaving(true);
    setLoading(true);
    try {
      const res = await api.updatePurpleTeamProfile(parsed);
      if (res.error) {
        setMessage({ type: 'error', text: res.error });
        return;
      }

      setSource('db');
      setMessage({ type: 'success', text: t('settings.purpleTeamProfile.saved', 'Purple Team profile saved.') });
    } finally {
      setSaving(false);
      setLoading(false);
    }
  };

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <div className="text-center py-10 text-gray-400">
        {t('settings.purpleTeamProfile.adminOnly', 'Only organization admins can manage the Purple Team runtime profile.')}
      </div>
    );
  }

  if (!loaded) {
    return <div className="text-gray-400 py-8 text-center">{t('settings.purpleTeamProfile.loading', 'Loading Purple Team profile...')}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">{t('settings.purpleTeamProfile.heading', 'Purple Team Runtime Profile')}</h2>
          <p className="text-gray-400 text-sm">{t('settings.purpleTeamProfile.subtitle', 'Tune detection ratios and scenario penalties without redeploying the backend.')}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium self-start ${source === 'db' ? 'bg-purple-500/20 text-purple-300' : 'bg-gray-700 text-gray-300'}`}>
          {t('settings.purpleTeamProfile.source', 'Source')}: {source}
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-gray-900/70 border border-gray-700 p-3">
            <div className="text-gray-400 mb-1">{t('settings.purpleTeamProfile.priorityOne', 'Priority 1')}</div>
            <div className="text-white font-medium">{t('settings.purpleTeamProfile.priorityOneDesc', 'Organization DB profile')}</div>
          </div>
          <div className="rounded-lg bg-gray-900/70 border border-gray-700 p-3">
            <div className="text-gray-400 mb-1">{t('settings.purpleTeamProfile.priorityTwo', 'Priority 2')}</div>
            <div className="text-white font-medium">
              <span className="font-mono text-sm">{PROFILE_JSON_ENV_VAR}</span>
              <span className="text-gray-400 ml-2">{t('settings.purpleTeamProfile.priorityTwoDesc', 'Environment JSON override')}</span>
            </div>
          </div>
          <div className="rounded-lg bg-gray-900/70 border border-gray-700 p-3">
            <div className="text-gray-400 mb-1">{t('settings.purpleTeamProfile.priorityThree', 'Priority 3')}</div>
            <div className="text-white font-medium">
              <span className="font-mono text-sm">{PROFILE_DETECT_ENV_VAR_PATTERN}</span>
              <span className="text-gray-400 ml-2">{t('settings.purpleTeamProfile.priorityThreeDesc', 'Per-variable environment fallback')}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {t('settings.purpleTeamProfile.editorLabel', 'Profile JSON')}
          </label>
          <textarea
            value={profileText}
            onChange={(event) => setProfileText(event.target.value)}
            spellCheck={false}
            className="w-full min-h-[360px] px-4 py-3 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 font-mono text-sm focus:border-kali-blue focus:outline-none"
          />
        </div>

        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-gray-300">
          <div className="font-medium text-cyan-300 mb-2">{t('settings.purpleTeamProfile.exampleTitle', 'Supported keys')}</div>
          <ul className="space-y-1 text-gray-400">
            <li>{t('settings.purpleTeamProfile.exampleChainKeys', 'Chain weights: chains.credential, chains.lateral, chains.default')}</li>
            <li>{t('settings.purpleTeamProfile.exampleTargetKeys', 'Target modifiers: target.prod_penalty, target.dev_bonus')}</li>
            <li>{t('settings.purpleTeamProfile.exampleBoundKeys', 'Bounds: bounds.min, bounds.max')}</li>
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={loadProfile}
          disabled={saving}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition disabled:opacity-50"
        >
          {t('settings.purpleTeamProfile.reload', 'Reload')}
        </button>
        <button
          onClick={handleReset}
          disabled={saving}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition disabled:opacity-50"
        >
          {t('settings.purpleTeamProfile.reset', 'Reset to Defaults')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-kali-blue text-white rounded-lg font-medium hover:bg-kali-blue/80 transition disabled:opacity-50"
        >
          {saving ? t('settings.purpleTeamProfile.saving', 'Saving...') : t('settings.purpleTeamProfile.save', 'Save Profile')}
        </button>
      </div>
    </motion.div>
  );
}