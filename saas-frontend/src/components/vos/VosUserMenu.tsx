/**
 * VosUserMenu — Apple-grade dropdown for the topbar user pill.
 *
 * Composition:
 *   • Trigger button (avatar + name/email) — current behaviour preserved
 *   • Dropdown panel:
 *       — Account header (name + email + role badge + plan)
 *       — Profile · Settings · Upgrade
 *       — Theme submenu (Dark / Light / System)
 *       — Language submenu (EN / DE / FR / ES / IT)
 *       — Keyboard shortcuts · Help
 *       — Sign out (danger tone)
 */
import { Fragment, useMemo } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User as UserIcon,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  Languages,
  Keyboard,
  HelpCircle,
  LogOut,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { useColorMode } from '../../contexts/ColorModeContext';
import { cn } from '../../lib/cn';

const LANGUAGES: Array<{ code: string; label: string; native: string }> = [
  { code: 'en', label: 'English',  native: 'English' },
  { code: 'de', label: 'German',   native: 'Deutsch' },
  { code: 'fr', label: 'French',   native: 'Français' },
  { code: 'es', label: 'Spanish',  native: 'Español' },
  { code: 'it', label: 'Italian',  native: 'Italiano' },
];

export interface VosUserMenuProps {
  user?: { name?: string; email?: string; avatarUrl?: string; role?: string; plan?: string };
  onLogout?: () => void;
  onShortcuts?: () => void;
}

export function VosUserMenu({ user, onLogout, onShortcuts }: VosUserMenuProps) {
  const { i18n, t } = useTranslation();
  const { colorMode, setColorMode } = useColorMode();

  const currentLang = useMemo(
    () => LANGUAGES.find((l) => i18n.language?.startsWith(l.code)) ?? LANGUAGES[0],
    [i18n.language],
  );

  const displayName = user?.name ?? 'Operator';
  const displayEmail = user?.email;
  const role = user?.role;
  const plan = user?.plan;

  return (
    <Menu as="div" className="relative">
      <Menu.Button
        className={cn(
          'flex items-center gap-vos-2 pl-vos-2 pr-1 py-1 rounded-vos-full',
          'border border-vos-border-1 bg-vos-bg-elev-1',
          'hover:bg-vos-bg-elev-2 transition-colors duration-vos-2',
        )}
      >
        <div className="hidden sm:flex flex-col items-end leading-tight pl-1">
          <span className="text-vos-xs font-medium text-vos-text truncate max-w-[160px]">
            {displayName}
          </span>
          {displayEmail && (
            <span className="text-[10px] text-vos-text-muted truncate max-w-[160px]">
              {displayEmail}
            </span>
          )}
        </div>
        <Avatar name={displayName} src={user?.avatarUrl} size="sm" />
        <ChevronDown size={12} className="hidden sm:block text-vos-text-muted mr-0.5" />
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-vos-out duration-vos-2"
        enterFrom="opacity-0 -translate-y-1 scale-[0.98]"
        enterTo="opacity-100 translate-y-0 scale-100"
        leave="transition ease-vos-in-out duration-vos-1"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Menu.Items
          className={cn(
            'absolute right-0 mt-vos-2 w-72 origin-top-right z-vos-popover',
            'rounded-vos-lg overflow-hidden',
            'bg-vos-bg-elev-3 border border-vos-border-1',
            'shadow-vos-3 focus:outline-none',
          )}
        >
          {/* Account header */}
          <div className="px-vos-4 pt-vos-4 pb-vos-3 border-b border-vos-border-1 flex items-center gap-vos-3">
            <Avatar name={displayName} src={user?.avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
              <div className="text-vos-sm font-semibold text-vos-text truncate">
                {displayName}
              </div>
              {displayEmail && (
                <div className="text-vos-xs text-vos-text-3 truncate">{displayEmail}</div>
              )}
              {(role || plan) && (
                <div className="flex items-center gap-1.5 mt-1">
                  {role && (
                    <span className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 bg-vos-bg-elev-1 px-1.5 py-0.5 rounded">
                      {role}
                    </span>
                  )}
                  {plan && (
                    <span className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-accent bg-vos-accent/10 px-1.5 py-0.5 rounded">
                      {plan}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Account links */}
          <Section>
            <Item to="/dashboard/settings?tab=profile" icon={UserIcon}>
              {t('userMenu.profile', 'Profile')}
            </Item>
            <Item to="/dashboard/settings" icon={SettingsIcon}>
              {t('userMenu.settings', 'Settings')}
            </Item>
            <Item to="/dashboard/upgrade" icon={Sparkles} accent>
              {t('userMenu.upgrade', 'Upgrade plan')}
            </Item>
          </Section>

          {/* Theme submenu */}
          <Section heading={t('userMenu.appearance', 'Appearance')}>
            <ThemeChoice
              current={colorMode}
              choice="light"
              icon={Sun}
              label={t('userMenu.themeLight', 'Light')}
              onSelect={setColorMode}
            />
            <ThemeChoice
              current={colorMode}
              choice="dark"
              icon={Moon}
              label={t('userMenu.themeDark', 'Dark')}
              onSelect={setColorMode}
            />
            <ThemeChoice
              current={colorMode}
              choice="system"
              icon={Monitor}
              label={t('userMenu.themeSystem', 'System')}
              onSelect={setColorMode}
            />
          </Section>

          {/* Language submenu */}
          <Section heading={t('userMenu.language', 'Language')}>
            <LanguagePicker
              current={currentLang.code}
              onChange={(code) => i18n.changeLanguage(code)}
            />
          </Section>

          {/* Help links */}
          <Section>
            {onShortcuts && (
              <Item icon={Keyboard} onClick={onShortcuts}>
                {t('userMenu.shortcuts', 'Keyboard shortcuts')}
                <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-vos-bg-elev-1 border border-vos-border-1 text-vos-text-3">
                  ?
                </kbd>
              </Item>
            )}
            <Item href="/docs.html" icon={HelpCircle} external>
              {t('userMenu.help', 'Help & documentation')}
            </Item>
          </Section>

          {/* Sign out */}
          {onLogout && (
            <div className="border-t border-vos-border-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    type="button"
                    onClick={onLogout}
                    className={cn(
                      'w-full flex items-center gap-vos-3 px-vos-4 py-vos-3',
                      'text-vos-sm font-medium text-vos-danger',
                      active && 'bg-vos-danger/10',
                    )}
                  >
                    <LogOut size={14} />
                    <span>{t('userMenu.signOut', 'Sign out')}</span>
                  </button>
                )}
              </Menu.Item>
            </div>
          )}
        </Menu.Items>
      </Transition>
    </Menu>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Section({ children, heading }: { children: React.ReactNode; heading?: string }) {
  return (
    <div className="border-b border-vos-border-1 py-vos-1">
      {heading && (
        <div className="px-vos-4 pt-vos-2 pb-1 text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-muted">
          {heading}
        </div>
      )}
      {children}
    </div>
  );
}

function Item({
  children,
  to,
  href,
  icon: Icon,
  external,
  onClick,
  accent,
}: {
  children: React.ReactNode;
  to?: string;
  href?: string;
  icon?: React.ComponentType<{ size?: number | string; className?: string }>;
  external?: boolean;
  onClick?: () => void;
  accent?: boolean;
}) {
  const inner = (active: boolean) => (
    <span
      className={cn(
        'flex items-center gap-vos-3 px-vos-4 py-vos-2 text-vos-sm transition-colors',
        accent ? 'text-vos-accent font-medium' : 'text-vos-text',
        active && 'bg-vos-bg-elev-2',
      )}
    >
      {Icon && <Icon size={14} className={cn(!accent && 'text-vos-text-3')} />}
      <span className="flex-1 inline-flex items-center gap-2">{children}</span>
    </span>
  );

  return (
    <Menu.Item>
      {({ active }) => {
        if (to) {
          return (
            <Link to={to} className="block">
              {inner(active)}
            </Link>
          );
        }
        if (href) {
          return (
            <a
              href={href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noreferrer' : undefined}
              className="block"
            >
              {inner(active)}
            </a>
          );
        }
        return (
          <button type="button" onClick={onClick} className="block w-full text-left">
            {inner(active)}
          </button>
        );
      }}
    </Menu.Item>
  );
}

function ThemeChoice({
  current,
  choice,
  icon: Icon,
  label,
  onSelect,
}: {
  current: string;
  choice: 'light' | 'dark' | 'system';
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  onSelect: (mode: 'light' | 'dark' | 'system') => void;
}) {
  const isCurrent = current === choice;
  return (
    <Menu.Item>
      {({ active }) => (
        <button
          type="button"
          onClick={() => onSelect(choice)}
          className={cn(
            'w-full flex items-center gap-vos-3 px-vos-4 py-vos-2 text-vos-sm text-vos-text transition-colors',
            active && 'bg-vos-bg-elev-2',
          )}
        >
          <Icon size={14} className="text-vos-text-3" />
          <span className="flex-1 text-left">{label}</span>
          {isCurrent && <Check size={14} className="text-vos-accent" />}
        </button>
      )}
    </Menu.Item>
  );
}

function LanguagePicker({
  current,
  onChange,
}: {
  current: string;
  onChange: (code: string) => void;
}) {
  return (
    <div className="px-vos-2 pb-vos-1">
      <div className="grid grid-cols-5 gap-1">
        {LANGUAGES.map((lang) => {
          const active = current.startsWith(lang.code);
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => onChange(lang.code)}
              title={lang.native}
              className={cn(
                'flex flex-col items-center justify-center py-1.5 rounded-vos-sm text-[10px] font-semibold transition-colors',
                active
                  ? 'bg-vos-accent/15 text-vos-accent'
                  : 'text-vos-text-3 hover:bg-vos-bg-elev-2 hover:text-vos-text',
              )}
            >
              <span className="uppercase tracking-vos-wide">{lang.code}</span>
            </button>
          );
        })}
      </div>
      <div className="px-vos-2 pt-1.5 pb-vos-1 flex items-center gap-1.5 text-[10px] text-vos-text-muted">
        <Languages size={11} />
        <span>{LANGUAGES.find((l) => l.code === current)?.native ?? current}</span>
      </div>
    </div>
  );
}
