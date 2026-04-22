import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import SettingsPage from '../SettingsPage';
import { useAuth } from '../../../hooks/useAuth';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../hooks/useUtilities', () => ({
  useDocumentTitle: () => undefined,
}));

vi.mock('../settings', () => ({
  ProfileTab: () => <div>Mock Profile Tab</div>,
  SecurityTab: () => <div>Mock Security Tab</div>,
  NotificationsTab: () => <div>Mock Notifications Tab</div>,
  ApiKeysTab: () => <div>Mock API Keys Tab</div>,
  TeamTab: () => <div>Mock Team Tab</div>,
  IntegrationsTab: () => <div>Mock Integrations Tab</div>,
  SSOTab: () => <div>Mock SSO Tab</div>,
  BillingTab: () => <div>Mock Billing Tab</div>,
  PurpleTeamProfileTab: () => <div>Mock Purple Team Profile Tab</div>,
}));

const mockedUseAuth = vi.mocked(useAuth);

function renderWithRoute(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SettingsPage />
    </MemoryRouter>
  );
}

describe('SettingsPage role-based tab visibility', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'admin-1', role: 'admin' },
      organization: { id: 'org-1', plan_type: 'professional' },
      token: 'token',
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
    } as never);
  });

  it('shows Purple Team Profile tab for admins', async () => {
    renderWithRoute('/dashboard/settings');

    expect(await screen.findByRole('button', { name: /Purple Team Profile/i })).toBeInTheDocument();
  });

  it('hides Purple Team Profile tab for non-admin users', async () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'user-1', role: 'user' },
      organization: { id: 'org-1', plan_type: 'professional' },
      token: 'token',
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
    } as never);

    renderWithRoute('/dashboard/settings');

    expect(screen.queryByRole('button', { name: /Purple Team Profile/i })).not.toBeInTheDocument();
    expect(await screen.findByText('Mock Profile Tab')).toBeInTheDocument();
  });

  it('falls back to profile tab when non-admin opens purple-profile deep link', async () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'user-2', role: 'viewer' },
      organization: { id: 'org-1', plan_type: 'professional' },
      token: 'token',
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
    } as never);

    renderWithRoute('/dashboard/settings?tab=purple-profile');

    expect(screen.queryByText('Mock Purple Team Profile Tab')).not.toBeInTheDocument();
    expect(await screen.findByText('Mock Profile Tab')).toBeInTheDocument();
  });
});