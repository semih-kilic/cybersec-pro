import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import PurpleTeamPage from '../PurpleTeamPage';
import SettingsPage from '../SettingsPage';
import { PurpleTeamProfileTab } from '../settings/PurpleTeamProfileTab';
import api from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';
import {
  usePurpleTeamStats,
  usePurpleTeamProfileSummary,
  useAttackChains,
  usePlaybooks,
  usePurpleTeamExercises,
  usePurpleTeamExercise,
  useMitreMatrix,
  useStartExercise,
  useUploadAvatar,
  useUpdateProfile,
} from '../../../hooks/useApiQueries';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    form: ({ children, ...props }: React.FormHTMLAttributes<HTMLFormElement>) => <form {...props}>{children}</form>,
  },
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../hooks/useApiQueries', () => ({
  usePurpleTeamStats: vi.fn(),
  usePurpleTeamProfileSummary: vi.fn(),
  useAttackChains: vi.fn(),
  usePlaybooks: vi.fn(),
  usePurpleTeamExercises: vi.fn(),
  usePurpleTeamExercise: vi.fn(),
  useMitreMatrix: vi.fn(),
  useStartExercise: vi.fn(),
  useUploadAvatar: vi.fn(),
  useUpdateProfile: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  default: {
    getPurpleTeamProfile: vi.fn(),
    updatePurpleTeamProfile: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUsePurpleTeamStats = vi.mocked(usePurpleTeamStats);
const mockedUsePurpleTeamProfileSummary = vi.mocked(usePurpleTeamProfileSummary);
const mockedUseAttackChains = vi.mocked(useAttackChains);
const mockedUsePlaybooks = vi.mocked(usePlaybooks);
const mockedUsePurpleTeamExercises = vi.mocked(usePurpleTeamExercises);
const mockedUsePurpleTeamExercise = vi.mocked(usePurpleTeamExercise);
const mockedUseMitreMatrix = vi.mocked(useMitreMatrix);
const mockedUseStartExercise = vi.mocked(useStartExercise);
const mockedUseUploadAvatar = vi.mocked(useUploadAvatar);
const mockedUseUpdateProfile = vi.mocked(useUpdateProfile);
const mockedApi = vi.mocked(api);

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

function renderWithRoute(ui: React.ReactElement, initialRoute: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Purple Team admin navigation flow', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'admin-1', role: 'admin' },
      organization: { id: 'org-1', plan_type: 'professional' },
      token: 'test-token',
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
    } as never);

    mockedUsePurpleTeamStats.mockReturnValue({
      data: {
        total_exercises: 4,
        running: 1,
        completed: 3,
        total_attack_steps: 18,
        total_detected: 11,
        total_missed: 7,
        detection_rate: 61,
        average_risk_score: 42,
        available_chains: 3,
        available_playbooks: 5,
      },
      isLoading: false,
    } as never);

    mockedUsePurpleTeamProfileSummary.mockReturnValue({
      data: {
        organization_id: 'org-1',
        source: 'db',
        profile: {
          chains: { credential: 0.55, lateral: 0.62, default: 0.72 },
          target: { prod_penalty: 0.1, dev_bonus: 0.08 },
          bounds: { min: 0.25, max: 0.9 },
        },
      },
    } as never);

    mockedUseAttackChains.mockReturnValue({ data: [], isLoading: false } as never);
    mockedUsePlaybooks.mockReturnValue({ data: [] } as never);
    mockedUsePurpleTeamExercises.mockReturnValue({ data: [] } as never);
    mockedUsePurpleTeamExercise.mockReturnValue({ data: undefined } as never);
    mockedUseMitreMatrix.mockReturnValue({ data: {} } as never);
    mockedUseStartExercise.mockReturnValue({ isPending: false, mutateAsync: vi.fn() } as never);
    mockedUseUploadAvatar.mockReturnValue({ isPending: false, mutateAsync: vi.fn() } as never);
    mockedUseUpdateProfile.mockReturnValue({ isPending: false, mutateAsync: vi.fn() } as never);

    mockedApi.getPurpleTeamProfile.mockResolvedValue({
      data: {
        organization_id: 'org-1',
        source: 'db',
        profile: {
          chains: { credential: 0.55, lateral: 0.62, default: 0.72 },
          target: { prod_penalty: 0.1, dev_bonus: 0.08 },
          bounds: { min: 0.25, max: 0.9 },
        },
      },
    } as never);
  });

  it('shows a dashboard-to-settings deep link for admins', () => {
    renderWithProviders(<PurpleTeamPage />);

    const manageLink = screen.getByRole('link', { name: /Manage runtime tuning/i });
    expect(manageLink).toBeInTheDocument();
    expect(manageLink).toHaveAttribute('href', '/dashboard/settings?tab=purple-profile');
  });

  it('shows a settings-to-dashboard deep link for admins', async () => {
    renderWithProviders(
      <PurpleTeamProfileTab
        loading={false}
        setLoading={vi.fn()}
        setMessage={vi.fn()}
        user={{ id: 'admin-1', role: 'admin' }}
        organization={{ id: 'org-1' }}
        userPlan="professional"
      />
    );

    const dashboardLink = await screen.findByRole('link', { name: /Open Purple Team dashboard/i });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute('href', '/dashboard/purple-team');
  });

  it('opens purple-profile tab from deep-link query param', async () => {
    renderWithRoute(<SettingsPage />, '/dashboard/settings?tab=purple-profile');

    expect(await screen.findByText('Purple Team Runtime Profile')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Purple Team dashboard/i })).toHaveAttribute('href', '/dashboard/purple-team');
  });

  it('does not expose purple-profile tab for non-admin deep links', async () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'user-1', role: 'user' },
      organization: { id: 'org-1', plan_type: 'professional' },
      token: 'test-token',
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
    } as never);

    renderWithRoute(<SettingsPage />, '/dashboard/settings?tab=purple-profile');

    expect(screen.queryByText('Purple Team Runtime Profile')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Purple Team Profile/i })).not.toBeInTheDocument();
    expect(await screen.findByText('Profile Information')).toBeInTheDocument();
  });
});