import { useState, useEffect, useRef } from 'react';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';
import {
  DocumentTextIcon,
  DocumentArrowDownIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  DocumentChartBarIcon,
  TrashIcon,
  EyeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

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

interface AvailableScan {
  id: string;
  name: string;
  tool: string;
  target: string;
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
    formats: ['html', 'pdf', 'json']
  },
  {
    id: 'technical',
    name: 'Technical Report',
    description: 'Detailed technical analysis for security teams',
    icon: '🔧',
    sections: ['Vulnerability Details', 'CVE References', 'Technical Remediation'],
    formats: ['html', 'pdf', 'json', 'csv']
  },
  {
    id: 'compliance',
    name: 'Compliance Report',
    description: 'Multi-framework compliance report for auditors',
    icon: '📋',
    sections: ['Compliance Status', 'Control Mappings', 'Gap Analysis'],
    formats: ['html', 'pdf', 'json']
  },
  {
    id: 'owasp',
    name: 'OWASP Top 10',
    description: 'Map scan results to OWASP Top 10 2021 categories',
    icon: '🛡️',
    sections: ['OWASP Category Mapping', 'Risk Matrix', 'Remediation Priority'],
    frameworks: ['OWASP Top 10'],
    formats: ['html', 'pdf', 'json']
  },
  {
    id: 'pci-dss',
    name: 'PCI-DSS Req 11',
    description: 'PCI-DSS 4.0 Requirement 11 vulnerability scanning compliance',
    icon: '💳',
    sections: ['PCI-DSS Compliance Status', 'Requirement 11 Controls', 'Gap Analysis'],
    frameworks: ['PCI-DSS 4.0'],
    formats: ['html', 'pdf', 'json']
  },
  {
    id: 'iso27001',
    name: 'ISO 27001 Annex A',
    description: 'ISO 27001 Annex A technical controls assessment',
    icon: '📜',
    sections: ['Annex A Control Mapping', 'Technical Controls Status', 'Gap Analysis'],
    frameworks: ['ISO 27001 Annex A'],
    formats: ['html', 'pdf', 'json']
  },
  {
    id: 'full',
    name: 'Full Report',
    description: 'Comprehensive report with all sections and frameworks',
    icon: '📑',
    sections: ['Executive Summary', 'Technical Details', 'Compliance Mapping', 'Remediation Guide'],
    formats: ['html', 'pdf', 'json', 'csv', 'markdown']
  }
];

export function ReportsPage() {
  const { token } = useAuth();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [availableScans, setAvailableScans] = useState<AvailableScan[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>(defaultTemplates);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewReport, setPreviewReport] = useState<ReportSummary | null>(null);
  
  // Generate form states
  const [selectedTemplate, setSelectedTemplate] = useState('full');
  const [selectedScans, setSelectedScans] = useState<string[]>([]);
  const [reportName, setReportName] = useState('Security Assessment Report');
  const [reportFormat, setReportFormat] = useState<'html' | 'pdf' | 'json' | 'csv' | 'markdown'>('html');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetchData();
    fetchTemplates();
  }, [token]);

  useEffect(() => {
    // Update sections when template changes
    const template = templates.find(t => t.id === selectedTemplate);
    if (template) {
      setSelectedSections(template.sections);
    }
  }, [selectedTemplate, templates]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/v1/reports', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        setAvailableScans(data.available_scans || []);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/v1/reports/templates', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.templates?.length > 0) {
          setTemplates(data.templates);
        }
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const handleGenerateReport = async () => {
    if (selectedScans.length === 0) {
      alert('Please select at least one scan');
      return;
    }
    
    setGenerating(true);
    
    try {
      const res = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scan_ids: selectedScans,
          name: reportName,
          format: reportFormat,
          template: selectedTemplate,
          sections: selectedSections,
        }),
      });
      
      if (res.ok) {
        // PDF returns binary blob directly
        if (reportFormat === 'pdf') {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          const data = await res.json();
          const content = data.report.content;
          downloadReport(content, reportName, reportFormat);
        }
        
        // Refresh and close modal
        setShowGenerateModal(false);
        setSelectedScans([]);
        setReportName('Security Assessment Report');
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Generate report failed:', error);
      alert('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = (content: string, name: string, format: string) => {
    const extMap: Record<string, string> = {
      'html': 'html',
      'json': 'json',
      'csv': 'csv',
      'markdown': 'md',
      'pdf': 'pdf'
    };
    const mimeMap: Record<string, string> = {
      'html': 'text/html',
      'json': 'application/json',
      'csv': 'text/csv',
      'markdown': 'text/markdown',
      'pdf': 'application/pdf'
    };
    
    const blob = new Blob([content], { type: mimeMap[format] || 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${extMap[format] || 'txt'}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handlePreview = async (report: ReportSummary) => {
    try {
      const res = await fetch(`/api/v1/reports/${report.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewContent(data.content || '');
        setPreviewReport(report);
        setShowPreviewModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    }
  };

  const handleDownload = async (report: ReportSummary) => {
    try {
      const res = await fetch(`/api/v1/reports/${report.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        downloadReport(data.content, report.name, report.format);
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    
    try {
      const res = await fetch(`/api/v1/reports/${reportId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setReports(reports.filter(r => r.id !== reportId));
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const getRiskColor = (level: string) => {
    const colors: Record<string, string> = {
      'Critical': 'text-red-500 bg-red-500/10 border-red-500/30',
      'High': 'text-orange-500 bg-orange-500/10 border-orange-500/30',
      'Medium': 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
      'Low': 'text-green-500 bg-green-500/10 border-green-500/30',
      'None': 'text-blue-500 bg-blue-500/10 border-blue-500/30'
    };
    return colors[level] || colors['None'];
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredReports = reports.filter(report =>
    report.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate totals
  const criticalCount = reports.reduce((sum, r) => sum + (r.severity_breakdown?.critical || 0), 0);
  const highCount = reports.reduce((sum, r) => sum + (r.severity_breakdown?.high || 0), 0);
  const avgRiskScore = reports.length > 0 
    ? Math.round(reports.reduce((sum, r) => sum + (r.risk_score || 0), 0) / reports.length)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-kali-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Header 
        title="Security Reports"
        subtitle="Generate professional security assessment reports"
      />

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-kali-blue/20 flex items-center justify-center">
                <DocumentTextIcon className="w-5 h-5 text-kali-blue" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{reports.length}</p>
                <p className="text-xs text-gray-400">Reports</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <CheckCircleIcon className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{availableScans.length}</p>
                <p className="text-xs text-gray-400">Scans Available</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
                <p className="text-xs text-gray-400">Critical</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <ChartBarIcon className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-400">{highCount}</p>
                <p className="text-xs text-gray-400">High</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <ShieldCheckIcon className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{avgRiskScore}</p>
                <p className="text-xs text-gray-400">Avg Risk Score</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
            />
          </div>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-kali-blue to-kali-purple text-white font-medium rounded-xl hover:opacity-90 transition flex items-center gap-2 justify-center"
          >
            <PlusIcon className="w-5 h-5" />
            Generate Report
          </button>
        </div>

        {/* Reports Grid */}
        {filteredReports.length === 0 ? (
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-12 text-center">
            <DocumentChartBarIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Reports Yet</h3>
            <p className="text-gray-400 mb-6">Generate your first professional security report from completed scans.</p>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-6 py-3 bg-kali-blue text-white rounded-xl hover:bg-kali-blue/90 transition inline-flex items-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Generate Report
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredReports.map((report) => (
              <div 
                key={report.id}
                className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition group"
              >
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold truncate">{report.name}</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {new Date(report.created_at).toLocaleDateString()} • {report.template} • {report.format.toUpperCase()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(report.risk_level)}`}>
                      {report.risk_level || 'N/A'}
                    </span>
                  </div>
                  
                  {/* Risk Score Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Risk Score</span>
                      <span className="text-white font-medium">{report.risk_score || 0}/100</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          (report.risk_score || 0) >= 70 ? 'bg-red-500' :
                          (report.risk_score || 0) >= 50 ? 'bg-orange-500' :
                          (report.risk_score || 0) >= 25 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${report.risk_score || 0}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Severity Breakdown */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {report.severity_breakdown?.critical > 0 && (
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                        {report.severity_breakdown.critical} Critical
                      </span>
                    )}
                    {report.severity_breakdown?.high > 0 && (
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">
                        {report.severity_breakdown.high} High
                      </span>
                    )}
                    {report.severity_breakdown?.medium > 0 && (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                        {report.severity_breakdown.medium} Med
                      </span>
                    )}
                    {(report.total_findings || 0) === 0 && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                        Clean
                      </span>
                    )}
                  </div>
                  
                  {/* Meta */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <span>{report.total_findings || 0} findings</span>
                    <span>{formatFileSize(report.file_size)}</span>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePreview(report)}
                      className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition flex items-center justify-center gap-1.5 text-sm"
                    >
                      <EyeIcon className="w-4 h-4" />
                      Preview
                    </button>
                    <button
                      onClick={() => handleDownload(report)}
                      className="flex-1 px-3 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white rounded-lg transition flex items-center justify-center gap-1.5 text-sm"
                    >
                      <DocumentArrowDownIcon className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="px-3 py-2 bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Generate Report</h2>
                <p className="text-gray-400 text-sm mt-1">Create a professional security assessment report</p>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition"
              >
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Report Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Report Name</label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-kali-blue"
                  placeholder="Security Assessment Report"
                />
              </div>
              
              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Choose Template</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplate(template.id);
                        // Auto-select best format for template
                        if (!template.formats.includes(reportFormat)) {
                          setReportFormat((template.formats[0] || 'html') as 'html' | 'pdf' | 'json' | 'csv' | 'markdown');
                        }
                      }}
                      className={`p-4 rounded-xl border text-left transition ${
                        selectedTemplate === template.id
                          ? 'bg-kali-blue/20 border-kali-blue'
                          : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="text-2xl mb-2">{template.icon}</div>
                      <div className="text-white font-medium text-sm">{template.name}</div>
                      <div className="text-gray-400 text-xs mt-1 line-clamp-2">{template.description}</div>
                      {template.frameworks && template.frameworks.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {template.frameworks.map(fw => (
                            <span key={fw} className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                              {fw}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Output Format</label>
                <div className="flex flex-wrap gap-2">
                  {(templates.find(t => t.id === selectedTemplate)?.formats || ['html', 'pdf', 'json', 'csv', 'markdown']).map((format) => (
                    <button
                      key={format}
                      onClick={() => setReportFormat(format as 'html' | 'pdf' | 'json' | 'csv' | 'markdown')}
                      className={`px-4 py-2 rounded-lg border transition ${
                        reportFormat === format
                          ? 'bg-kali-blue/20 border-kali-blue text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {format === 'pdf' ? '📄 PDF' : format.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Scan Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Select Scans ({selectedScans.length} selected)
                </label>
                {availableScans.length === 0 ? (
                  <div className="bg-gray-800 rounded-xl p-6 text-center">
                    <ClipboardDocumentListIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No completed scans available</p>
                    <p className="text-gray-500 text-sm mt-1">Run some scans first to generate reports</p>
                  </div>
                ) : (
                  <div className="bg-gray-800 rounded-xl border border-gray-700 max-h-64 overflow-y-auto">
                    {availableScans.map((scan) => (
                      <label
                        key={scan.id}
                        className={`flex items-center gap-3 p-4 border-b border-gray-700 last:border-b-0 cursor-pointer hover:bg-gray-750 transition ${
                          selectedScans.includes(scan.id) ? 'bg-kali-blue/10' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedScans.includes(scan.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedScans([...selectedScans, scan.id]);
                            } else {
                              setSelectedScans(selectedScans.filter(id => id !== scan.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-600 text-kali-blue focus:ring-kali-blue focus:ring-offset-gray-900"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">{scan.name}</div>
                          <div className="text-gray-500 text-xs">{scan.target} • {scan.completed_at}</div>
                        </div>
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                          {scan.tool}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-gray-800 flex items-center justify-between">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-6 py-2 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={generating || selectedScans.length === 0}
                className="px-6 py-3 bg-gradient-to-r from-kali-blue to-kali-purple text-white font-medium rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <DocumentTextIcon className="w-5 h-5" />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewReport && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{previewReport.name}</h2>
                <p className="text-gray-400 text-sm">
                  {previewReport.template} • {previewReport.format.toUpperCase()} • Risk: {previewReport.risk_level}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(previewReport)}
                  className="px-4 py-2 bg-kali-blue text-white rounded-lg hover:bg-kali-blue/90 transition flex items-center gap-2"
                >
                  <DocumentArrowDownIcon className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              {previewReport.format === 'html' ? (
                <iframe
                  ref={iframeRef}
                  srcDoc={previewContent}
                  className="w-full h-full border-0"
                  title="Report Preview"
                />
              ) : (
                <pre className="p-6 overflow-auto h-full text-gray-300 text-sm font-mono whitespace-pre-wrap">
                  {previewContent}
                </pre>
              )}n            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportsPage;
