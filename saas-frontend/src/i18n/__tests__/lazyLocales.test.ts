import { describe, it, expect, beforeAll } from 'vitest';
import i18n, { i18nReady } from '../index';

/**
 * Locales are loaded on demand (one chunk per language) instead of being
 * bundled into the entry chunk. These tests prove the lazy backend actually
 * resolves bundles — a silent failure here would ship a UI full of raw keys.
 */
describe('lazy locale loading', () => {
  beforeAll(async () => {
    await i18nReady;
  });

  it('resolves the initial language before the app mounts', () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.t('common.save')).toBe('Save');
  });

  it('loads a different language on demand', async () => {
    await i18n.changeLanguage('tr');
    expect(i18n.t('common.save')).toBe('Kaydet');
    expect(i18n.t('common.loading')).toBe('Yükleniyor');
  });

  it('loads a non-latin language on demand', async () => {
    await i18n.changeLanguage('ja');
    // Any real translation is fine; what matters is that it is not the key.
    expect(i18n.t('common.save')).not.toBe('common.save');
    expect(i18n.t('common.save').length).toBeGreaterThan(0);
  });

  it('falls back to English for an unsupported language', async () => {
    await i18n.changeLanguage('xx');
    expect(i18n.t('common.save')).toBe('Save');
  });

  it('keeps every supported language resolvable', async () => {
    const langs = ['en', 'tr', 'de', 'fr', 'es', 'pt', 'it', 'ar', 'ja', 'zh', 'ko', 'ru'];
    for (const lang of langs) {
      await i18n.changeLanguage(lang);
      expect(i18n.t('common.save'), `${lang} failed to resolve`).not.toBe('common.save');
    }
  });
});
