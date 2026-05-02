/**
 * 🛡️ ReportsPage — V20 "Onyx" rewrite
 *
 * Apple-grade SOC reports view.
 * - PageHeader + StatCards summary
 * - Org branding (logo upload) panel
 * - Search bar + Generate button
 * - Report card grid: RiskScore gauge + SeverityHeatmap + actions
 * - Generate modal: template picker, format chips, scan picker
 * - Preview modal: iframe / pre
 *
 * Business logic preserved (React Query mutations, blob downloads,
 * iframe srcDoc preview, file size validation).
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  FileBarChart2,
  Plus,
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Download,
  Trash2,
  Eye,
  RotateCw,
  Image as ImageIcon,
  UploadCloud,
  ListChecks,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { PageTransition } from '../../components/ui';
import {
  useReports,
  useReportTemplates,
  useGenerateReport,
  useFetchReport,
  useDeleteReport,
  useOrgLogo,
  useUploadOrgLogo,
  useDeleteOrgLogo,
} from '../../hooks/useApiQueries';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useToast } from '../../components/ui/Toast';
import { ReportsPageSkeleton } from '../../components/ui/Skeleton';
import { StatCard } from '../../components/ui/Card';
import {
  PageHeader,
  StatusPill,
  RiskScore,
  SeverityHeatmap,
} from '../../components/vos';
import type { Severity } from '../../components/vos';

interface ReportSummary {
  id: string;
  name: string;
  template: string;
  format: string;
  status: string;
  scan_ids: string[];
  sections: string[];
  total_findings: number;
  severity_breakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  risk_score: number;
  risk_level: string;
  file_size: number;
  created_at: string;
  completed_at: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  sections: string[];
  formats: string[];
  frameworks?: string[];
}

const defaultTemplates: ReportTemplate[] = [
  {
    id: 'executive',
    name: 'Executive Summary',
    description: 'High-level overview for management and stakeholders',
    icon: '📊',
    sections: ['Risk Overview', 'Key Findings', 'Recommendations'],
    formats: ['html', 'pdf', 'json'],
  },
  {
    id: 'technical',
    name: 'Technical Report',
    description: 'Detailed technical analysis for security teams',
    icon: '🔧',
    sections: ['Vulnerability Details', 'CVE References', 'Technical Remediation'],
    formats: ['html', 'pdf', 'json', 'csv'],
  },
  {
    id: 'compliance',
    name: 'Compliance Report',
    description: 'Multi-framework compliance report for auditors',
    icon: '📋',
    sections: ['Compliance Status', 'Control Mappings', 'Gap Analysis'],
    formats: ['html', 'pdf', 'json'],
  },
  {
    id: 'owasp',
    name: 'OWASP Top 10',
    description: 'Map scan results to OWASP Top 10 2021 categories',
    icon: '🛡️',
    sections: ['OWASP Category Mapping', 'Risk Matrix', 'Remediation Priority'],
    frameworks: ['OWASP Top 10'],
    formats: ['html', 'pdf', 'json'],
  },
  {
    id: 'pci-dss',
    name: 'PCI-DSS Req 11',
    description: 'PCI-DSS 4.0 Requirement 11 vulnerability scanning compliance',
    icon: '💳',
    sections: ['PCI-DSS Compliance Status', 'Requirement 11 Controls', 'Gap Analysis'],
    frameworks: ['PCI-DSS 4.0'],
    formats: ['html', 'pdf', 'json'],
  },
  {
    id: 'iso27001',
    name: 'ISO 27001 Annex A',
    description: 'ISO 27001 Annex A technical controls assessment',
    icon: '📜',
    sections: ['Annex A Control Mapping', 'Technical Controls Status', 'Gap Analysis'],
    frameworks: ['ISO 27001 Annex A'],
    formats: ['html', 'pdf', 'json'],
  },
  {
    id: 'full',
    name: 'Full Report',
    description: 'Comprehensive report with all sections and frameworks',
    icon: '📑',
    sections: [
      'Executive Summary',
      'Technical Details',
      'Compliance Mapping',
      'Remediation Guide',
    ],
    formats: ['html', 'pdf', 'json', 'csv', 'markdown'],
  },
];

function formatFileSize(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const RISK_TONE: Record<
  string,
  'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent'
> = {
  Critical: 'danger',
  High: 'warning',
  Medium: 'warning',
  Low: 'success',
  None: 'neutral',
};

export function ReportsPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('reports.title', 'Reports')} — CyberSec Pro`);
  const toast = useToast();

  const { data: reportsData, isLoading: reportsLoading } = useReports();
  const generateMutation = useGenerateReport();
  const fetchReportMutation = useFetchReport();
  const deleteMutation = useDeleteReport();
  const { data: orgLogoUrl } = useOrgLogo();
  const uploadLogoMutation = useUploadOrgLogo();
  const deleteLogoMutation = useDeleteOrgLogo();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const reports = reportsData?.reports || [];
  const availableScans = reportsData?.available_scans || [];
  const { data: fetchedTemplates = [], isLoading: templatesLoading } =
    useReportTemplates();
  const templates =
    fetchedTemplates && fetchedTemplates.length > 0 ? fetchedTemplates : defaultTemplates;
  const loading = reportsLoading || templatesLoading;

  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewReport, setPreviewReport] = useState<ReportSummary | null>(null);

  const [selectedTemplate, setSelectedTemplate] = useState('full');
  const [selectedScans, setSelectedScans] = useState<string[]>([]);
  const [reportName, setReportName] = useState('Security Assessment Report');
  const [reportFormat, setReportFormat] = useState<
    'html' | 'pdf' | 'json' | 'csv' | 'markdown'
  >('html');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const template = templates.find((t) => t.id === selectedTemplate);
    if (template) setSelectedSections(template.sections);
  }, [selectedTemplate, templates]);

  const downloadReport = (content: string, name: string, format: string) => {
    const extMap: Record<string, string> = {
      html: 'html',
      json: 'json',
      csv: 'csv',
      markdown: 'md',
      pdf: 'pdf',
    };
    const mimeMap: Record<string, string> = {
      html: 'text/html',
      json: 'application/json',
      csv: 'text/csv',
      markdown: 'text/markdown',
      pdf: 'application/pdf',
    };
    const blob = new Blob([content], { type: mimeMap[format] || 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}_${
      new Date().toISOString().split('T')[0]
    }.${extMap[format] || 'txt'}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleGenerateReport = async () => {
    if (selectedScans.length === 0) {
      toast.warning(
        t('reports.noScansSelected', 'No Scans Selected'),
        t('reports.selectAtLeastOneScan', 'Please select at least one scan'),
      );
      return;
    }
    setGenerating(true);
    try {
      const res = await generateMutation.mutateAsync({
        scan_ids: selectedScans,
        name: reportName,
        format: reportFormat,
        template: selectedTemplate,
        sections: selectedSections,
      });
      if (reportFormat === 'pdf') {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportName.replace(/\s+/g, '_')}_${
          new Date().toISOString().split('T')[0]
        }.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await res.json();
        downloadReport(data.report.content, reportName, reportFormat);
      }
      setShowGenerateModal(false);
      setSelectedScans([]);
      setReportName('Security Assessment Report');
    } catch (error: any) {
      toast.error(
        t('reports.reportFailed', 'Report Failed'),
        error?.message ||
          t('reports.failedToGenerateReport', 'Failed to generate report'),
      );
    } finally {
      setGenerating(false);
    }
  };

  const handlePreview = async (report: ReportSummary) => {
    try {
      const data = await fetchReportMutation.mutateAsync(report.id);
      setPreviewContent(data.content || '');
      setPreviewReport(report);
      setShowPreviewModal(true);
    } catch {
      toast.error('Preview Failed', 'Failed to fetch report');
    }
  };

  const handleDownload = async (report: ReportSummary) => {
    try {
      const data = await fetchReportMutation.mutateAsync(report.id);
      downloadReport(data.content, report.name, report.format);
    } catch {
      toast.error('Download Failed', 'Could not download report');
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    try {
      await deleteMutation.mutateAsync(reportId);
    } catch {
      toast.error('Delete Failed', 'Could not delete report');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File Too Large', 'Maximum logo size is 5MB');
      return;
    }
    const validTypes = [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid Format', 'Accepted: PNG, JPG, GIF, WebP, SVG');
      return;
    }
    try {
      await uploadLogoMutation.mutateAsync(file);
      toast.success('Logo Uploaded', 'Your organization logo will appear on reports');
    } catch (err: any) {
      toast.error('Upload Failed', err.message || 'Could not upload logo');
    }
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleLogoDelete = async () => {
    try {
      await deleteLogoMutation.mutateAsync();
      toast.success('Logo Removed', 'Reports will use the default CyberSec Pro branding');
    } catch {
      toast.error('Delete Failed', 'Could not remove logo');
    }
  };

  const filteredReports = reports.filter((report) =>
    report.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const criticalCount = reports.reduce(
    (sum, r) => sum + (r.severity_breakdown?.critical || 0),
    0,
  );
  const highCount = reports.reduce(
    (sum, r) => sum + (r.severity_breakdown?.high || 0),
    0,
  );
  const avgRiskScore =
    reports.length > 0
      ? Math.round(
          reports.reduce((sum, r) => sum + (r.risk_score || 0), 0) / reports.length,
        )
      : 0;

  if (loading) return <ReportsPageSkeleton />;

  return (
    <PageTransition>
      <div className="p-vos-8 max-w-7xl mx-auto space-y-vos-6">
        <PageHeader
          eyebrow="Intel"
          icon={<FileBarChart2 size={22} />}
          title={t('reports.securityReports', 'Security Reports')}
          description={t(
            'reports.subtitle',
            'Generate professional security assessment reports',
          )}
          actions={
            <button
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-2 h-10 px-vos-4 rounded-vos-md bg-vos-accent text-white text-vos-sm font-medium hover:opacity-90"
            >
              <Plus size={14} />
              {t('reports.generateReport', 'Generate Report')}
            </button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-vos-3">
          <StatCard
            title={t('reports.statReports', 'Reports')}
            value={reports.length.toString()}
            icon={<FileText size={16} />}
          />
          <StatCard
            title={t('reports.statScansAvailable', 'Scans Available')}
            value={availableScans.length.toString()}
            icon={<CheckCircle2 size={16} />}
            variant="green"
          />
          <StatCard
            title={t('reports.statCritical', 'Critical')}
            value={criticalCount.toString()}
            icon={<AlertTriangle size={16} />}
            variant="red"
          />
          <StatCard
            title={t('reports.statHigh', 'High')}
            value={highCount.toString()}
            icon={<AlertTriangle size={16} />}
            variant="amber"
          />
          <StatCard
            title={t('reports.statAvgRisk', 'Avg Risk Score')}
            value={`${avgRiskScore}`}
            icon={<ShieldCheck size={16} />}
            variant="purple"
          />
        </div>

        {/* Branding */}
        <section className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 p-vos-4">
          <div className="flex items-center justify-between gap-vos-4 flex-wrap">
            <div className="flex items-center gap-vos-3 min-w-0">
              <span className="size-9 rounded-vos-md bg-vos-accent/10 border border-vos-accent/20 flex items-center justify-center text-vos-accent shrink-0">
                <ImageIcon size={16} />
              </span>
              <div className="min-w-0">
                <h3 className="text-vos-sm font-semibold text-vos-text">
                  {t('reports.brandingTitle', 'Report Branding')}
                </h3>
                <p className="text-vos-xs text-vos-text-3 mt-0.5">
                  {t(
                    'reports.brandingSubtitle',
                    'Your logo will appear on all generated reports',
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-vos-3">
              {orgLogoUrl && (
                <div className="flex items-center gap-vos-2">
                  <img
                    src={orgLogoUrl}
                    alt="Organization logo"
                    className="h-9 w-auto max-w-[120px] object-contain rounded-vos-sm border border-vos-border-1 bg-vos-bg-elev-3 p-1"
                  />
                  <button
                    onClick={handleLogoDelete}
                    disabled={deleteLogoMutation.isPending}
                    className="size-8 rounded-vos-md text-vos-text-3 hover:text-vos-danger hover:bg-vos-danger/10 flex items-center justify-center transition-colors"
                    title={t('reports.removeLogo', 'Remove logo')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadLogoMutation.isPending}
                className="inline-flex items-center gap-2 h-9 px-vos-3 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 text-vos-text text-vos-xs font-medium hover:bg-vos-bg-elev-4"
              >
                {uploadLogoMutation.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <UploadCloud size={12} />
                )}
                {orgLogoUrl ? 'Change Logo' : 'Upload Logo'}
              </button>
            </div>
          </div>
        </section>

        {/* Search */}
        <section className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 p-vos-3">
          <label className="flex items-center gap-2 px-vos-3 h-10 rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 focus-within:border-vos-accent focus-within:ring-2 focus-within:ring-vos-accent/30 transition-colors">
            <Search size={14} className="text-vos-text-3 shrink-0" />
            <input
              type="search"
              placeholder={t('reports.searchPlaceholder', 'Search reports…')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-0 outline-none text-vos-sm text-vos-text placeholder:text-vos-text-muted"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="size-5 rounded hover:bg-vos-bg-elev-4 flex items-center justify-center text-vos-text-3"
                aria-label="Clear"
              >
                <X size={12} />
              </button>
            )}
          </label>
        </section>

        {/* Reports grid */}
        {filteredReports.length === 0 ? (
          <div className="text-center py-vos-16 rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2">
            <span className="size-12 mx-auto rounded-vos-md bg-vos-bg-elev-3 border border-vos-border-1 flex items-center justify-center text-vos-text-3 mb-vos-3">
              <FileBarChart2 size={20} />
            </span>
            <h3 className="text-vos-md font-semibold text-vos-text mb-1">
              {t('reports.noReportsTitle', 'No Reports Yet')}
            </h3>
            <p className="text-vos-sm text-vos-text-3 mb-vos-4 max-w-md mx-auto">
              {t(
                'reports.noReportsDesc',
                'Generate your first professional security report from completed scans.',
              )}
            </p>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-2 h-10 px-vos-4 rounded-vos-md bg-vos-accent text-white text-vos-sm font-medium hover:opacity-90"
            >
              <Plus size={14} />
              Generate Report
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-vos-4">
            {filteredReports.map((report) => {
              const counts: Record<Severity, number> = {
                critical: report.severity_breakdown?.critical || 0,
                high: report.severity_breakdown?.high || 0,
                medium: report.severity_breakdown?.medium || 0,
                low: report.severity_breakdown?.low || 0,
                info: report.severity_breakdown?.info || 0,
              };
              const total =
                counts.critical + counts.high + counts.medium + counts.low + counts.info;
              return (
                <article
                  key={report.id}
                  className="rounded-vos-xl border border-vos-border-1 bg-vos-bg-elev-2 hover:border-vos-border-2 transition-colors overflow-hidden flex flex-col"
                >
                  <div className="p-vos-5 flex-1 space-y-vos-4">
                    <div className="flex items-start justify-between gap-vos-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-vos-md font-semibold text-vos-text truncate">
                          {report.name}
                        </h3>
                        <p className="text-vos-xs text-vos-text-3 mt-0.5">
                          {new Date(report.created_at).toLocaleDateString()} ·{' '}
                          {report.template} · {report.format.toUpperCase()}
                        </p>
                      </div>
                      <RiskScore
                        value={report.risk_score || 0}
                        size={56}
                        invert
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3">
                          Severity Mix
                        </span>
                        <StatusPill tone={RISK_TONE[report.risk_level] || 'neutral'}>
                          {report.risk_level || 'N/A'}
                        </StatusPill>
                      </div>
                      {total > 0 ? (
                        <SeverityHeatmap counts={counts} total={total} />
                      ) : (
                        <div className="h-2 rounded-full bg-vos-success/30 flex items-center justify-center text-[10px] text-vos-success font-medium uppercase tracking-vos-wide">
                          Clean
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-vos-xs text-vos-text-3 tabular-nums">
                      <span>
                        <span className="text-vos-text font-semibold">
                          {report.total_findings || 0}
                        </span>{' '}
                        findings
                      </span>
                      <span>{formatFileSize(report.file_size)}</span>
                    </div>
                  </div>

                  <div className="flex gap-1 p-vos-3 border-t border-vos-border-1 bg-vos-bg-elev-1/40">
                    <button
                      onClick={() => handlePreview(report)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-vos-sm bg-vos-bg-elev-3 hover:bg-vos-bg-elev-4 border border-vos-border-1 text-vos-text text-vos-xs font-medium transition-colors"
                    >
                      <Eye size={11} />
                      Preview
                    </button>
                    <button
                      onClick={() => handleDownload(report)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-vos-sm bg-vos-accent text-white text-vos-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <Download size={11} />
                      Download
                    </button>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="size-8 rounded-vos-sm text-vos-text-3 hover:text-vos-danger hover:bg-vos-danger/10 flex items-center justify-center transition-colors"
                      aria-label="Delete report"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Generate modal */}
        {showGenerateModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-vos-4 z-50"
            onClick={() => setShowGenerateModal(false)}
          >
            <div
              className="rounded-vos-2xl border border-vos-border-1 bg-vos-bg-elev-2 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-vos-elev-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-vos-5 border-b border-vos-border-1">
                <div>
                  <p className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3">
                    Workflow
                  </p>
                  <h2 className="text-vos-lg font-semibold text-vos-text">
                    {t('reports.generateTitle', 'Generate Report')}
                  </h2>
                  <p className="text-vos-xs text-vos-text-3 mt-0.5">
                    {t(
                      'reports.generateSubtitle',
                      'Create a professional security assessment report',
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="size-8 rounded-vos-md text-vos-text-3 hover:text-vos-text hover:bg-vos-bg-elev-3 flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-vos-5 space-y-vos-5">
                {/* Name */}
                <div>
                  <label className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-1.5 block">
                    {t('reports.reportNameLabel', 'Report Name')}
                  </label>
                  <input
                    type="text"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    className="w-full px-vos-3 h-10 bg-vos-bg-elev-3 border border-vos-border-1 rounded-vos-md text-vos-text text-vos-sm placeholder:text-vos-text-muted focus:outline-none focus:border-vos-accent focus:ring-2 focus:ring-vos-accent/30"
                    placeholder={t(
                      'reports.reportNamePlaceholder',
                      'Security Assessment Report',
                    )}
                  />
                </div>

                {/* Template */}
                <div>
                  <label className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-vos-2 block">
                    {t('reports.chooseTemplate', 'Choose Template')}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-vos-2">
                    {templates.map((template) => {
                      const active = selectedTemplate === template.id;
                      return (
                        <button
                          key={template.id}
                          onClick={() => {
                            setSelectedTemplate(template.id);
                            if (!template.formats.includes(reportFormat)) {
                              setReportFormat(
                                (template.formats[0] || 'html') as
                                  | 'html'
                                  | 'pdf'
                                  | 'json'
                                  | 'csv'
                                  | 'markdown',
                              );
                            }
                          }}
                          className={`p-vos-3 rounded-vos-md border text-left transition-colors ${
                            active
                              ? 'bg-vos-accent/10 border-vos-accent'
                              : 'bg-vos-bg-elev-3 border-vos-border-1 hover:border-vos-border-2'
                          }`}
                        >
                          <div className="text-xl mb-1.5">{template.icon}</div>
                          <div className="text-vos-sm font-medium text-vos-text">
                            {template.name}
                          </div>
                          <div className="text-vos-xs text-vos-text-3 mt-0.5 line-clamp-2">
                            {template.description}
                          </div>
                          {template.frameworks && template.frameworks.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {template.frameworks.map((fw) => (
                                <span
                                  key={fw}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-vos-info/15 text-vos-info"
                                >
                                  {fw}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Format */}
                <div>
                  <label className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-vos-2 block">
                    {t('reports.outputFormat', 'Output Format')}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      templates.find((t) => t.id === selectedTemplate)?.formats || [
                        'html',
                        'pdf',
                        'json',
                        'csv',
                        'markdown',
                      ]
                    ).map((format) => {
                      const active = reportFormat === format;
                      return (
                        <button
                          key={format}
                          onClick={() =>
                            setReportFormat(
                              format as 'html' | 'pdf' | 'json' | 'csv' | 'markdown',
                            )
                          }
                          className={`h-8 px-vos-3 rounded-vos-sm text-vos-xs font-medium uppercase tracking-wide border transition-colors ${
                            active
                              ? 'bg-vos-accent/10 border-vos-accent text-vos-accent'
                              : 'bg-vos-bg-elev-3 border-vos-border-1 text-vos-text-3 hover:text-vos-text'
                          }`}
                        >
                          {format}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scans */}
                <div>
                  <label className="text-[10px] uppercase tracking-vos-wide font-semibold text-vos-text-3 mb-vos-2 block">
                    Select Scans (
                    <span className="text-vos-text tabular-nums">
                      {selectedScans.length}
                    </span>{' '}
                    selected)
                  </label>
                  {availableScans.length === 0 ? (
                    <div className="rounded-vos-md border border-vos-border-1 bg-vos-bg-elev-3 p-vos-5 text-center">
                      <ListChecks
                        size={28}
                        className="mx-auto text-vos-text-3 mb-vos-2"
                      />
                      <p className="text-vos-sm text-vos-text-2">
                        {t('reports.noScansAvailable', 'No completed scans available')}
                      </p>
                      <p className="text-vos-xs text-vos-text-3 mt-1">
                        {t(
                          'reports.runScansFirst',
                          'Run some scans first to generate reports',
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-vos-md border border-vos-border-1 bg-vos-bg-elev-3 max-h-64 overflow-y-auto divide-y divide-vos-border-1">
                      {availableScans.map((scan) => {
                        const checked = selectedScans.includes(scan.id);
                        return (
                          <label
                            key={scan.id}
                            className={`flex items-center gap-vos-3 p-vos-3 cursor-pointer transition-colors ${
                              checked
                                ? 'bg-vos-accent/10'
                                : 'hover:bg-vos-bg-elev-4'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked)
                                  setSelectedScans([...selectedScans, scan.id]);
                                else
                                  setSelectedScans(
                                    selectedScans.filter((id) => id !== scan.id),
                                  );
                              }}
                              className="size-3.5 rounded border-vos-border-2 text-vos-accent focus:ring-vos-accent"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-vos-sm text-vos-text font-medium truncate">
                                {scan.name}
                              </div>
                              <div className="text-vos-xs text-vos-text-3 truncate">
                                {scan.target} · {scan.completed_at}
                              </div>
                            </div>
                            <StatusPill tone="neutral">{scan.tool}</StatusPill>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-vos-5 border-t border-vos-border-1 bg-vos-bg-elev-1/40">
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="px-vos-4 h-10 text-vos-text-3 hover:text-vos-text text-vos-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateReport}
                  disabled={generating || selectedScans.length === 0}
                  className="inline-flex items-center gap-2 h-10 px-vos-5 rounded-vos-md bg-vos-accent text-white text-vos-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  {generating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Generate Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview modal */}
        {showPreviewModal && previewReport && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-vos-4 z-50"
            onClick={() => setShowPreviewModal(false)}
          >
            <div
              className="rounded-vos-2xl border border-vos-border-1 bg-vos-bg-elev-2 w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col shadow-vos-elev-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-vos-4 border-b border-vos-border-1 flex items-center justify-between">
                <div className="min-w-0">
                  <h2 className="text-vos-md font-semibold text-vos-text truncate">
                    {previewReport.name}
                  </h2>
                  <p className="text-vos-xs text-vos-text-3 truncate">
                    {previewReport.template} · {previewReport.format.toUpperCase()} ·
                    Risk: {previewReport.risk_level}
                  </p>
                </div>
                <div className="flex items-center gap-vos-2">
                  <button
                    onClick={() => handleDownload(previewReport)}
                    className="inline-flex items-center gap-1.5 h-9 px-vos-3 rounded-vos-md bg-vos-accent text-white text-vos-xs font-medium hover:opacity-90"
                  >
                    <Download size={12} />
                    Download
                  </button>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="size-9 rounded-vos-md text-vos-text-3 hover:text-vos-text hover:bg-vos-bg-elev-3 flex items-center justify-center"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden bg-vos-bg-elev-1">
                {previewReport.format === 'html' ? (
                  <iframe
                    ref={iframeRef}
                    srcDoc={previewContent}
                    className="w-full h-full border-0 bg-white"
                    title={t('reports.reportPreview', 'Report Preview')}
                  />
                ) : (
                  <pre className="p-vos-5 overflow-auto h-full text-vos-text-2 text-vos-xs font-mono whitespace-pre-wrap">
                    {previewContent}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

export default ReportsPage;

void RotateCw;
