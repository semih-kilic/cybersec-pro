import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  useAbortExercise,
  useIngestExerciseTelemetry,
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
  useAbortExercise: vi.fn(),
  useIngestExerciseTelemetry: vi.fn(),
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
const mockedUseAbortExercise = vi.mocked(useAbortExercise);
const mockedUseIngestExerciseTelemetry = vi.mocked(useIngestExerciseTelemetry);
const mockedUseUploadAvatar = vi.mocked(useUploadAvatar);
const mockedUseUpdateProfile = vi.mocked(useUpdateProfile);
const mockedApi = vi.mocked(api);

const abortMutateAsync = vi.fn();
const telemetryMutateAsync = vi.fn();

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>
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
      <MemoryRouter initialEntries={[initialRoute]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>
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
    abortMutateAsync.mockReset();
    telemetryMutateAsync.mockReset();
    mockedUseAbortExercise.mockReturnValue({ isPending: false, mutateAsync: abortMutateAsync } as never);
    mockedUseIngestExerciseTelemetry.mockReturnValue({ isPending: false, mutateAsync: telemetryMutateAsync } as never);
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

  it('triggers abort mutation for running exercise detail', async () => {
    mockedUsePurpleTeamExercises.mockReturnValue({
      data: [{
        id: 'exercise-1',
        name: 'Runtime Exercise',
        attack_chain_id: 'chain-1',
        target: '10.0.0.5',
        status: 'running',
        started_at: '2026-04-22T10:00:00Z',
        completed_at: '',
        total_steps: 2,
        completed_steps: 1,
        detected_attacks: 1,
        missed_attacks: 0,
        risk_score: 45,
        red_team_results: [],
        blue_team_alerts: [],
        gap_analysis: {},
        coverage_map: {},
      }],
    } as never);

    mockedUsePurpleTeamExercise.mockReturnValue({
      data: {
        id: 'exercise-1',
        name: 'Runtime Exercise',
        attack_chain_id: 'chain-1',
        target: '10.0.0.5',
        status: 'running',
        started_at: '2026-04-22T10:00:00Z',
        completed_at: '',
        total_steps: 2,
        completed_steps: 1,
        detected_attacks: 1,
        missed_attacks: 0,
        risk_score: 45,
        red_team_results: [{
          step_index: 0,
          phase: 'recon',
          technique_id: 'T1595',
          technique_name: 'Active Scanning',
          tool: 'nmap',
          command: 'nmap -sV 10.0.0.5',
          status: 'completed',
          output: '',
          findings: [],
          started_at: '2026-04-22T10:00:05Z',
          completed_at: '2026-04-22T10:00:10Z',
          duration_seconds: 5,
          detected_by_blue: true,
        }],
        blue_team_alerts: [],
        gap_analysis: { total_attacks: 1, detected: 1, missed: 0, detection_rate: 100, missed_techniques: [], recommendations: [] },
        coverage_map: {},
      },
    } as never);

    renderWithProviders(<PurpleTeamPage />);

    fireEvent.click(await screen.findByText('Runtime Exercise'));
    fireEvent.click(await screen.findByRole('button', { name: 'Abort' }));

    await waitFor(() => {
      expect(abortMutateAsync).toHaveBeenCalledWith('exercise-1');
    });
  });

  it('sends telemetry mutation payload when marking step detected or missed', async () => {
    mockedUsePurpleTeamExercises.mockReturnValue({
      data: [{
        id: 'exercise-1',
        name: 'Runtime Exercise',
        attack_chain_id: 'chain-1',
        target: '10.0.0.5',
        status: 'running',
        started_at: '2026-04-22T10:00:00Z',
        completed_at: '',
        total_steps: 2,
        completed_steps: 1,
        detected_attacks: 1,
        missed_attacks: 0,
        risk_score: 45,
        red_team_results: [],
        blue_team_alerts: [],
        gap_analysis: {},
        coverage_map: {},
      }],
    } as never);

    mockedUsePurpleTeamExercise.mockReturnValue({
      data: {
        id: 'exercise-1',
        name: 'Runtime Exercise',
        attack_chain_id: 'chain-1',
        target: '10.0.0.5',
        status: 'running',
        started_at: '2026-04-22T10:00:00Z',
        completed_at: '',
        total_steps: 2,
        completed_steps: 1,
        detected_attacks: 1,
        missed_attacks: 0,
        risk_score: 45,
        red_team_results: [{
          step_index: 0,
          phase: 'recon',
          technique_id: 'T1595',
          technique_name: 'Active Scanning',
          tool: 'nmap',
          command: 'nmap -sV 10.0.0.5',
          status: 'completed',
          output: '',
          findings: [],
          started_at: '2026-04-22T10:00:05Z',
          completed_at: '2026-04-22T10:00:10Z',
          duration_seconds: 5,
          detected_by_blue: true,
        }],
        blue_team_alerts: [],
        gap_analysis: { total_attacks: 1, detected: 1, missed: 0, detection_rate: 100, missed_techniques: [], recommendations: [] },
        coverage_map: {},
      },
    } as never);

    renderWithProviders(<PurpleTeamPage />);

    fireEvent.click(await screen.findByText('Runtime Exercise'));

    fireEvent.click(await screen.findByRole('button', { name: 'Mark Detected' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Missed' }));

    await waitFor(() => {
      expect(telemetryMutateAsync).toHaveBeenCalledWith({
        exerciseId: 'exercise-1',
        telemetry: {
          step_index: 0,
          technique_id: 'T1595',
          detected: true,
          source: 'dashboard.manual',
          confidence: 0.95,
        },
      });

      expect(telemetryMutateAsync).toHaveBeenCalledWith({
        exerciseId: 'exercise-1',
        telemetry: {
          step_index: 0,
          technique_id: 'T1595',
          detected: false,
          source: 'dashboard.manual',
          confidence: 0.4,
        },
      });
    });
  });

  it('shows high_coverage alert banner when telemetry mutation returns high_coverage', async () => {
    mockedUsePurpleTeamExercises.mockReturnValue({
      data: [{
        id: 'exercise-hc',
        name: 'High Coverage Exercise',
        attack_chain_id: 'chain-1',
        target: '10.0.0.1',
        status: 'running',
        started_at: '2026-04-22T10:00:00Z',
        completed_at: '',
        total_steps: 5,
        completed_steps: 4,
        detected_attacks: 4,
        missed_attacks: 1,
        risk_score: 20,
        red_team_results: [],
        blue_team_alerts: [],
        gap_analysis: {},
        coverage_map: {},
      }],
    } as never);

    mockedUsePurpleTeamExercise.mockReturnValue({
      data: {
        id: 'exercise-hc',
        name: 'High Coverage Exercise',
        attack_chain_id: 'chain-1',
        target: '10.0.0.1',
        status: 'running',
        started_at: '2026-04-22T10:00:00Z',
        completed_at: '',
        total_steps: 5,
        completed_steps: 4,
        detected_attacks: 4,
        missed_attacks: 1,
        risk_score: 20,
        red_team_results: [{
          step_index: 0,
          phase: 'recon',
          technique_id: 'T1595',
          technique_name: 'Active Scanning',
          tool: 'nmap',
          command: 'nmap -sV 10.0.0.1',
          status: 'completed',
          output: '',
          findings: [],
          started_at: '2026-04-22T10:00:05Z',
          completed_at: '2026-04-22T10:00:10Z',
          duration_seconds: 5,
          detected_by_blue: true,
        }],
        blue_team_alerts: [],
        gap_analysis: { total_attacks: 5, detected: 4, missed: 1, detection_rate: 80, missed_techniques: [], recommendations: [] },
        coverage_map: {},
      },
    } as never);

    mockedUseIngestExerciseTelemetry.mockReturnValue({
      isPending: false,
      mutateAsync: telemetryMutateAsync,
      data: { success: true, id: 'exercise-hc', status: 'running', detected_attacks: 4, missed_attacks: 1, detection_coverage_alert: 'high_coverage' },
    } as never);

    renderWithProviders(<PurpleTeamPage />);

    fireEvent.click(await screen.findByText('High Coverage Exercise'));

    expect(await screen.findByText(/High Detection Coverage/i)).toBeInTheDocument();
    expect(screen.getByText(/Blue Team is catching/i)).toBeInTheDocument();
  });

  it('shows low_coverage alert banner when telemetry mutation returns low_coverage', async () => {
    mockedUsePurpleTeamExercises.mockReturnValue({
      data: [{
        id: 'exercise-lc',
        name: 'Low Coverage Exercise',
        attack_chain_id: 'chain-2',
        target: '10.0.0.9',
        status: 'running',
        started_at: '2026-04-22T11:00:00Z',
        completed_at: '',
        total_steps: 5,
        completed_steps: 4,
        detected_attacks: 1,
        missed_attacks: 4,
        risk_score: 85,
        red_team_results: [],
        blue_team_alerts: [],
        gap_analysis: {},
        coverage_map: {},
      }],
    } as never);

    mockedUsePurpleTeamExercise.mockReturnValue({
      data: {
        id: 'exercise-lc',
        name: 'Low Coverage Exercise',
        attack_chain_id: 'chain-2',
        target: '10.0.0.9',
        status: 'running',
        started_at: '2026-04-22T11:00:00Z',
        completed_at: '',
        total_steps: 5,
        completed_steps: 4,
        detected_attacks: 1,
        missed_attacks: 4,
        risk_score: 85,
        red_team_results: [{
          step_index: 0,
          phase: 'lateral',
          technique_id: 'T1021',
          technique_name: 'Remote Services',
          tool: 'crackmapexec',
          command: 'cme smb 10.0.0.9',
          status: 'completed',
          output: '',
          findings: [],
          started_at: '2026-04-22T11:00:05Z',
          completed_at: '2026-04-22T11:00:12Z',
          duration_seconds: 7,
          detected_by_blue: false,
        }],
        blue_team_alerts: [],
        gap_analysis: { total_attacks: 5, detected: 1, missed: 4, detection_rate: 20, missed_techniques: [], recommendations: [] },
        coverage_map: {},
      },
    } as never);

    mockedUseIngestExerciseTelemetry.mockReturnValue({
      isPending: false,
      mutateAsync: telemetryMutateAsync,
      data: { success: true, id: 'exercise-lc', status: 'running', detected_attacks: 1, missed_attacks: 4, detection_coverage_alert: 'low_coverage' },
    } as never);

    renderWithProviders(<PurpleTeamPage />);

    fireEvent.click(await screen.findByText('Low Coverage Exercise'));

    expect(await screen.findByText(/Low Detection Coverage/i)).toBeInTheDocument();
    expect(screen.getByText(/Review detection rules/i)).toBeInTheDocument();
  });
});