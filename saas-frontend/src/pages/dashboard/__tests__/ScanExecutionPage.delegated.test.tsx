import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ScanExecutionPage } from '../ScanExecutionPage';
import api from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';
import { useToolExecutionMode, useFetchBusinessReport, normalizeAgentsPayload } from '../../../hooks/useApiQueries';

// ── i18n ──────────────────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

// ── framer-motion ─────────────────────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Layout / UI components ────────────────────────────────────────────────────
vi.mock('../../../components/layout/Header', () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock('../../../components/ui', () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../../components/dashboard/ScanProgress', () => ({
  ScanProgress: () => <div data-testid="scan-progress" />,
}));

// ── Auth / context hooks ──────────────────────────────────────────────────────
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../../../contexts/TargetContext', () => ({
  useTarget: () => ({ target: '', addRecentTarget: vi.fn() }),
}));
vi.mock('../../../hooks/useWebSocket', () => ({
  useScanSubscription: () => ({ lastMessage: null, readyState: 0, output: [] }),
}));
vi.mock('../../../hooks/useUtilities', () => ({
  useDocumentTitle: vi.fn(),
}));

// ── API queries hooks ─────────────────────────────────────────────────────────
vi.mock('../../../hooks/useApiQueries', () => ({
  useToolExecutionMode: vi.fn(),
  useFetchBusinessReport: vi.fn(),
  normalizeAgentsPayload: vi.fn((v: unknown) => (Array.isArray(v) ? v : [])),
}));

// ── API service ───────────────────────────────────────────────────────────────
vi.mock('../../../services/api', () => ({
  default: {
    getToolConfig: vi.fn(),
    getAgents: vi.fn(),
    executeScan: vi.fn(),
    getScanResult: vi.fn(),
    stopScan: vi.fn(),
    streamScanOutput: vi.fn(() => () => {}),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
const mockedUseAuth = vi.mocked(useAuth);
const mockedUseToolExecutionMode = vi.mocked(useToolExecutionMode);
const mockedUseFetchBusinessReport = vi.mocked(useFetchBusinessReport);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedApi = vi.mocked(api) as any;

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage(toolId = 'nmap') {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/dashboard/scan?tool=${toolId}`]}>
        <ScanExecutionPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();

  mockedUseAuth.mockReturnValue({ token: 'mock-token' } as any);
  mockedUseToolExecutionMode.mockReturnValue({ data: null } as any);
  mockedUseFetchBusinessReport.mockReturnValue({ mutateAsync: vi.fn() } as any);

  mockedApi.getToolConfig.mockResolvedValue({ data: { tool: null } } as any);
  mockedApi.getAgents.mockResolvedValue({ data: [] } as any);
  mockedApi.getScanResult.mockResolvedValue({ data: null } as any);
  mockedApi.streamScanOutput.mockReturnValue(() => {});
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('ScanExecutionPage — delegated execution mode', () => {
  it('shows ⚙️ Scan Engine badge when execution_mode is delegated', async () => {
    mockedApi.executeScan.mockResolvedValueOnce({
      data: {
        scan_id: 'scan-delegate-001',
        execution_mode: 'delegated',
        engine: 'rust-scan-engine',
        command: '',
      },
      error: null,
    } as any);

    renderPage('nmap');

    // Fill target
    const targetInput = screen.getByPlaceholderText(/192\.168\.1\.0/i);
    fireEvent.change(targetInput, { target: { value: '10.0.0.1' } });

    // Click Start Scan
    const startBtn = screen.getByRole('button', { name: /start scan/i });
    fireEvent.click(startBtn);

    // Badge should appear
    await waitFor(() => {
      expect(screen.getByText('⚙️ Scan Engine')).toBeInTheDocument();
    });
    expect(screen.getByText('rust-scan-engine')).toBeInTheDocument();
  });

  it('shows engine name fallback when engine field is absent', async () => {
    mockedApi.executeScan.mockResolvedValueOnce({
      data: {
        scan_id: 'scan-delegate-002',
        execution_mode: 'delegated',
        // no `engine` field
        command: '',
      },
      error: null,
    } as any);

    renderPage('nmap');

    const targetInput = screen.getByPlaceholderText(/192\.168\.1\.0/i);
    fireEvent.change(targetInput, { target: { value: '10.0.0.2' } });

    fireEvent.click(screen.getByRole('button', { name: /start scan/i }));

    await waitFor(() => {
      expect(screen.getByText('⚙️ Scan Engine')).toBeInTheDocument();
    });
    // Fallback text
    expect(screen.getByText('rust-scan-engine')).toBeInTheDocument();
  });

  it('appends delegated header line to terminal output', async () => {
    mockedApi.executeScan.mockResolvedValueOnce({
      data: {
        scan_id: 'scan-delegate-003',
        execution_mode: 'delegated',
        engine: 'rust-scan-engine',
        command: '',
      },
      error: null,
    } as any);

    renderPage('nmap');

    const targetInput = screen.getByPlaceholderText(/192\.168\.1\.0/i);
    fireEvent.change(targetInput, { target: { value: '10.0.0.3' } });

    fireEvent.click(screen.getByRole('button', { name: /start scan/i }));

    await waitFor(() => {
      const el = screen.queryByText((content) =>
        content.includes('Delegated to scan engine') && content.includes('rust-scan-engine'),
      );
      expect(el).toBeInTheDocument();
    });
  });

  it('does NOT show ⚙️ Scan Engine badge for local execution mode', async () => {
    mockedApi.executeScan.mockResolvedValueOnce({
      data: {
        scan_id: 'scan-local-001',
        execution_mode: 'local',
        command: 'nmap -sV 10.0.0.4',
      },
      error: null,
    } as any);

    renderPage('nmap');

    const targetInput = screen.getByPlaceholderText(/192\.168\.1\.0/i);
    fireEvent.change(targetInput, { target: { value: '10.0.0.4' } });

    fireEvent.click(screen.getByRole('button', { name: /start scan/i }));

    await waitFor(() => {
      expect(screen.getByText('🖥️ Running on Server')).toBeInTheDocument();
    });
    expect(screen.queryByText('⚙️ Scan Engine')).not.toBeInTheDocument();
  });
});
