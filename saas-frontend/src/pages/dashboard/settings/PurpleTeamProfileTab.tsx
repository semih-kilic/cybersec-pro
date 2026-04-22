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

interface PurpleTeamProfileForm {
  chains: {
    credential: number;
    lateral: number;
    default: number;
  };
  target: {
    prod_penalty: number;
    dev_bonus: number;
  };
  bounds: {
    min: number;
    max: number;
  };
}

function toFiniteNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeProfile(rawProfile: Record<string, unknown> | null | undefined): PurpleTeamProfileForm {
  const chains = typeof rawProfile?.chains === 'object' && rawProfile.chains !== null
    ? rawProfile.chains as Record<string, unknown>
    : {};
  const target = typeof rawProfile?.target === 'object' && rawProfile.target !== null
    ? rawProfile.target as Record<string, unknown>
    : {};
  const bounds = typeof rawProfile?.bounds === 'object' && rawProfile.bounds !== null
    ? rawProfile.bounds as Record<string, unknown>
    : {};

  return {
    chains: {
      credential: toFiniteNumber(chains.credential, DEFAULT_PROFILE.chains.credential),
      lateral: toFiniteNumber(chains.lateral, DEFAULT_PROFILE.chains.lateral),
      default: toFiniteNumber(chains.default, DEFAULT_PROFILE.chains.default),
    },
    target: {
      prod_penalty: toFiniteNumber(target.prod_penalty, DEFAULT_PROFILE.target.prod_penalty),
      dev_bonus: toFiniteNumber(target.dev_bonus, DEFAULT_PROFILE.target.dev_bonus),
    },
    bounds: {
      min: toFiniteNumber(bounds.min, DEFAULT_PROFILE.bounds.min),
      max: toFiniteNumber(bounds.max, DEFAULT_PROFILE.bounds.max),
    },
  };
}

function profileToJson(profile: PurpleTeamProfileForm) {
  return JSON.stringify(profile, null, 2);
}

export function PurpleTeamProfileTab({ user, setLoading, setMessage }: SettingsTabProps) {
  const { t } = useTranslation();
  const [formProfile, setFormProfile] = useState<PurpleTeamProfileForm>(DEFAULT_PROFILE);
  const [profileText, setProfileText] = useState(profileToJson(DEFAULT_PROFILE));
  const [source, setSource] = useState<'db' | 'default'>('default');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);

  const updateFormProfile = (nextProfile: PurpleTeamProfileForm) => {
    setFormProfile(nextProfile);
    setProfileText(profileToJson(nextProfile));
  };

  const handleNumberChange = (
    section: keyof PurpleTeamProfileForm,
    field: string,
    value: string
  ) => {
    const parsed = Number.parseFloat(value);
    const nextValue = Number.isFinite(parsed) ? parsed : 0;

    const nextProfile = {
      ...formProfile,
      [section]: {
        ...formProfile[section],
        [field]: nextValue,
      },
    } as PurpleTeamProfileForm;

    updateFormProfile(nextProfile);
    setMessage(null);
  };

  const applyJsonToForm = () => {
    try {
      const parsed = JSON.parse(profileText) as Record<string, unknown>;
      const normalized = normalizeProfile(parsed);
      updateFormProfile(normalized);
      setMessage({ type: 'success', text: t('settings.purpleTeamProfile.jsonApplied', 'JSON applied to form fields.') });
    } catch {
      setMessage({ type: 'error', text: t('settings.purpleTeamProfile.invalidJson', 'Profile JSON is not valid.') });
    }
  };

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
      const normalized = normalizeProfile(nextProfile);

      updateFormProfile(normalized);
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
    updateFormProfile(DEFAULT_PROFILE);
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setLoading(true);
    try {
      const res = await api.updatePurpleTeamProfile(formProfile as unknown as Record<string, unknown>);
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

        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-white font-semibold">{t('settings.purpleTeamProfile.guidedHeading', 'Guided tuning')}</h3>
                <p className="text-gray-400 text-sm">{t('settings.purpleTeamProfile.guidedSubtitle', 'Edit the supported detection knobs directly without writing JSON.')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4 space-y-3">
                <h4 className="text-white font-medium">{t('settings.purpleTeamProfile.chainsSection', 'Chain weights')}</h4>
                {[
                  ['credential', t('settings.purpleTeamProfile.credentialLabel', 'Credential attacks')],
                  ['lateral', t('settings.purpleTeamProfile.lateralLabel', 'Lateral movement')],
                  ['default', t('settings.purpleTeamProfile.defaultLabel', 'Default chain')],
                ].map(([field, label]) => (
                  <label key={field} className="block">
                    <span className="block text-sm text-gray-300 mb-2">{label}</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={formProfile.chains[field as keyof PurpleTeamProfileForm['chains']]}
                      onChange={(event) => handleNumberChange('chains', field, event.target.value)}
                      className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:outline-none"
                    />
                  </label>
                ))}
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4 space-y-3">
                <h4 className="text-white font-medium">{t('settings.purpleTeamProfile.targetSection', 'Target modifiers')}</h4>
                {[
                  ['prod_penalty', t('settings.purpleTeamProfile.prodPenaltyLabel', 'Production penalty')],
                  ['dev_bonus', t('settings.purpleTeamProfile.devBonusLabel', 'Development bonus')],
                ].map(([field, label]) => (
                  <label key={field} className="block">
                    <span className="block text-sm text-gray-300 mb-2">{label}</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={formProfile.target[field as keyof PurpleTeamProfileForm['target']]}
                      onChange={(event) => handleNumberChange('target', field, event.target.value)}
                      className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:outline-none"
                    />
                  </label>
                ))}
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4 space-y-3">
                <h4 className="text-white font-medium">{t('settings.purpleTeamProfile.boundsSection', 'Safety bounds')}</h4>
                {[
                  ['min', t('settings.purpleTeamProfile.minLabel', 'Minimum ratio')],
                  ['max', t('settings.purpleTeamProfile.maxLabel', 'Maximum ratio')],
                ].map(([field, label]) => (
                  <label key={field} className="block">
                    <span className="block text-sm text-gray-300 mb-2">{label}</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={formProfile.bounds[field as keyof PurpleTeamProfileForm['bounds']]}
                      onChange={(event) => handleNumberChange('bounds', field, event.target.value)}
                      className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white focus:border-kali-blue focus:outline-none"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-gray-300">
            <div className="font-medium text-cyan-300 mb-2">{t('settings.purpleTeamProfile.exampleTitle', 'Supported keys')}</div>
            <ul className="space-y-1 text-gray-400">
              <li>{t('settings.purpleTeamProfile.exampleChainKeys', 'Chain weights: chains.credential, chains.lateral, chains.default')}</li>
              <li>{t('settings.purpleTeamProfile.exampleTargetKeys', 'Target modifiers: target.prod_penalty, target.dev_bonus')}</li>
              <li>{t('settings.purpleTeamProfile.exampleBoundKeys', 'Bounds: bounds.min, bounds.max')}</li>
            </ul>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-white font-medium">{t('settings.purpleTeamProfile.advancedHeading', 'Advanced JSON editor')}</h4>
                <p className="text-gray-400 text-sm">{t('settings.purpleTeamProfile.advancedSubtitle', 'Use this only if you want to inspect or manually paste the normalized profile JSON.')}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowJsonEditor((value) => !value)}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
              >
                {showJsonEditor
                  ? t('settings.purpleTeamProfile.hideJson', 'Hide JSON')
                  : t('settings.purpleTeamProfile.showJson', 'Show JSON')}
              </button>
            </div>

            {showJsonEditor && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('settings.purpleTeamProfile.editorLabel', 'Profile JSON')}
                  </label>
                  <textarea
                    value={profileText}
                    onChange={(event) => setProfileText(event.target.value)}
                    spellCheck={false}
                    className="w-full min-h-[260px] px-4 py-3 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 font-mono text-sm focus:border-kali-blue focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={applyJsonToForm}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
                  >
                    {t('settings.purpleTeamProfile.applyJson', 'Apply JSON to Form')}
                  </button>
                  <div className="text-sm text-gray-400 self-center">
                    {t('settings.purpleTeamProfile.applyJsonHint', 'Unknown keys are ignored and supported fields are normalized.')}
                  </div>
                </div>
              </>
            )}
          </div>
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