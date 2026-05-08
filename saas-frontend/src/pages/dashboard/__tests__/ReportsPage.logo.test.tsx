/**
 * ReportsPage — Logo Upload integration test
 *
 * Verifies the per-organization logo flow on the Reports page:
 *  - file input triggers `useUploadOrgLogo` mutation with the chosen file
 *  - oversized files are rejected before the mutation is called
 *  - the delete button calls `useDeleteOrgLogo`
 *
 * Hooks and side-effecting providers are mocked so the test focuses purely
 * on the logo branding panel behavior.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ReportsPage from '../ReportsPage';
import {
  useReports,
  useReportTemplates,
  useGenerateReport,
  useFetchReport,
  useDeleteReport,
  useOrgLogo,
  useUploadOrgLogo,
  useDeleteOrgLogo,
} from '../../../hooks/useApiQueries';

// --- i18n stub: return fallback or key ---
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

// --- framer-motion stub: render plain elements, drop animation props ---
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
          React.createElement('div', props as React.HTMLAttributes<HTMLDivElement>, children),
    },
  ),
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// --- Toast stub: capture errors so we can assert them ---
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('../../../components/ui/Toast', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '../../../components/ui/Toast',
  );
  return {
    ...actual,
    useToast: () => ({
      success: toastSuccess,
      error: toastError,
      info: vi.fn(),
      warning: vi.fn(),
    }),
  };
});

// --- React Query hooks ---
vi.mock('../../../hooks/useApiQueries', () => ({
  useReports: vi.fn(),
  useReportTemplates: vi.fn(),
  useGenerateReport: vi.fn(),
  useFetchReport: vi.fn(),
  useDeleteReport: vi.fn(),
  useOrgLogo: vi.fn(),
  useUploadOrgLogo: vi.fn(),
  useDeleteOrgLogo: vi.fn(),
}));

const mockedUseReports = vi.mocked(useReports);
const mockedUseReportTemplates = vi.mocked(useReportTemplates);
const mockedUseGenerateReport = vi.mocked(useGenerateReport);
const mockedUseFetchReport = vi.mocked(useFetchReport);
const mockedUseDeleteReport = vi.mocked(useDeleteReport);
const mockedUseOrgLogo = vi.mocked(useOrgLogo);
const mockedUseUploadOrgLogo = vi.mocked(useUploadOrgLogo);
const mockedUseDeleteOrgLogo = vi.mocked(useDeleteOrgLogo);

function buildClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderReportsPage() {
  const client = buildClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const baseMutation = () =>
  ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    isError: false,
    isSuccess: false,
    reset: vi.fn(),
  }) as unknown as ReturnType<typeof useUploadOrgLogo>;

describe('ReportsPage — per-organization logo branding', () => {
  let uploadMutation: ReturnType<typeof baseMutation>;
  let deleteMutation: ReturnType<typeof baseMutation>;

  beforeEach(() => {
    vi.clearAllMocks();
    toastError.mockReset();
    toastSuccess.mockReset();

    mockedUseReports.mockReturnValue({
      data: { reports: [], available_scans: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof useReports>);

    mockedUseReportTemplates.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useReportTemplates>);

    mockedUseGenerateReport.mockReturnValue(baseMutation() as never);
    mockedUseFetchReport.mockReturnValue(baseMutation() as never);
    mockedUseDeleteReport.mockReturnValue(baseMutation() as never);

    uploadMutation = baseMutation();
    deleteMutation = baseMutation();
    mockedUseUploadOrgLogo.mockReturnValue(uploadMutation as never);
    mockedUseDeleteOrgLogo.mockReturnValue(deleteMutation as never);
  });

  it('calls useUploadOrgLogo with the chosen file when a valid PNG is selected', async () => {
    mockedUseOrgLogo.mockReturnValue({ data: undefined } as unknown as ReturnType<
      typeof useOrgLogo
    >);

    const { container } = renderReportsPage();

    const file = new File(['logo-bytes'], 'org-logo.png', { type: 'image/png' });
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadMutation.mutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(uploadMutation.mutateAsync).toHaveBeenCalledWith(file);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('rejects files larger than 5 MB without calling the upload mutation', async () => {
    mockedUseOrgLogo.mockReturnValue({ data: undefined } as unknown as ReturnType<
      typeof useOrgLogo
    >);

    const { container } = renderReportsPage();

    const oversized = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', {
      type: 'image/png',
    });
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [oversized] } });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(uploadMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('renders the existing org logo and triggers delete when the trash button is clicked', async () => {
    mockedUseOrgLogo.mockReturnValue({
      data: 'https://cdn.example.com/orgs/acme/logo.png',
    } as unknown as ReturnType<typeof useOrgLogo>);

    renderReportsPage();

    const logo = await screen.findByAltText(/organization logo/i);
    expect(logo).toBeTruthy();
    expect((logo as HTMLImageElement).src).toContain('acme/logo.png');

    const removeBtn = screen.getByTitle(/remove logo/i);
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(deleteMutation.mutateAsync).toHaveBeenCalledTimes(1);
    });
  });
});
