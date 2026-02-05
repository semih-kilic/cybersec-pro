import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';

interface Report {
  id: string;
  name: string;
  scan_id: string;
  scan_name: string;
  target: string;
  created_at: string;
  format: 'pdf' | 'html' | 'json' | 'csv';
  status: 'generating' | 'ready' | 'failed';
  size?: string;
  findings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  executive_summary?: boolean;
  technical_details?: boolean;
  remediation_guide?: boolean;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  sections: string[];
}

const reportTemplates: ReportTemplate[] = [
  {
    id: 'executive',
    name: 'Executive Summary',
    description: 'High-level overview for management and stakeholders',
    icon: '📊',
    sections: ['Risk Overview', 'Key Findings', 'Recommendations'],
  },
  {
    id: 'technical',
    name: 'Technical Report',
    description: 'Detailed technical analysis for security teams',
    icon: '🔧',
    sections: ['Vulnerability Details', 'Proof of Concept', 'Technical Remediation'],
  },
  {
    id: 'compliance',
    name: 'Compliance Report',
    description: 'Compliance-focused report for auditors',
    icon: '📋',
    sections: ['Compliance Status', 'Control Mappings', 'Gap Analysis'],
  },
  {
    id: 'full',
    name: 'Full Report',
    description: 'Comprehensive report with all sections',
    icon: '📑',
    sections: ['Executive Summary', 'Technical Details', 'Remediation', 'Appendix'],
  },
];

export function ReportsPage() {
  const { token } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [scans, setScans] = useState<{id: string, name: string, date: string, target: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('full');
  const [selectedScans, setSelectedScans] = useState<string[]>([]);
  const [reportName, setReportName] = useState('Security Assessment Report');
  const [reportFormat, setReportFormat] = useState<'pdf' | 'html' | 'json'>('pdf');
  const [selectedSections, setSelectedSections] = useState<string[]>([
    'Executive Summary', 'Technical Details', 'Remediation Guide', 'Risk Matrix', 'Compliance Mapping', 'Appendix'
  ]);

  useEffect(() => {
    fetchReports();
    fetchScans();
  }, [token]);

  const fetchScans = async () => {
    try {
      const res = await fetch('/api/v1/scans', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const scanList = (data.scans || []).map((s: any) => ({
          id: s.id,
          name: `${s.tool?.name || s.tool_id} scan - ${s.target}`,
          date: new Date(s.created_at).toLocaleDateString(),
          target: s.target
        }));
        setScans(scanList);
      }
    } catch (error) {
      console.error('Failed to fetch scans:', error);
    }
  };

  const fetchReports = async () => {
    try {
      // Fetch real reports from API
      const res = await fetch('/api/v1/reports', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      } else {
        setReports([]);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (report: Report) => {
    try {
      const res = await fetch(`/api/v1/reports/${report.id}/download`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.content || '';
        const filename = data.filename || `report-${report.id}.txt`;
        
        // Determine content type based on format
        let mimeType = 'text/plain';
        if (report.format === 'json') mimeType = 'application/json';
        else if (report.format === 'html') mimeType = 'text/html';
        else if (report.format === 'pdf') mimeType = 'application/pdf';
        
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download report');
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
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
        const data = await res.json();
        
        // Download the generated report immediately
        const content = data.report.content;
        const ext = reportFormat === 'json' ? 'json' : reportFormat === 'html' ? 'html' : 'txt';
        const mimeType = reportFormat === 'json' ? 'application/json' : reportFormat === 'html' ? 'text/html' : 'text/plain';
        
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${ext}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Close modal and refresh
        setShowNewModal(false);
        setSelectedScans([]);
        fetchReports();
        
        alert('Report generated and downloaded successfully!');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Generate report failed:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    setReports(reports.filter(r => r.id !== reportId));
  };

  const filteredReports = reports.filter(report =>
    (report.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (report.target || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: Report['status']) => {
    switch (status) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Ready
          </span>
        );
      case 'generating':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
            <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Generating
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Failed
          </span>
        );
    }
  };

  const getFormatIcon = (format: Report['format']) => {
    switch (format) {
      case 'pdf':
        return <span className="text-red-400">PDF</span>;
      case 'html':
        return <span className="text-orange-400">HTML</span>;
      case 'json':
        return <span className="text-yellow-400">JSON</span>;
      case 'csv':
        return <span className="text-green-400">CSV</span>;
    }
  };

  const totalFindings = (findings: Report['findings']) =>
    findings.critical + findings.high + findings.medium + findings.low + findings.info;

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
        title="Reports"
        subtitle="Generate and manage security reports"
      />

      <div className="p-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">{reports.length}</p>
                <p className="text-sm text-gray-400">Total Reports</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-kali-blue/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-kali-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-400">
                  {reports.filter(r => r.status === 'ready').length}
                </p>
                <p className="text-sm text-gray-400">Ready</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-400">
                  {reports.reduce((sum, r) => sum + r.findings.critical, 0)}
                </p>
                <p className="text-sm text-gray-400">Critical Findings</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">
                  {reports.reduce((sum, r) => sum + totalFindings(r.findings), 0)}
                </p>
                <p className="text-sm text-gray-400">Total Findings</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
            />
            <svg className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-6 py-2 bg-gradient-to-r from-kali-blue to-kali-purple text-white font-medium rounded-lg hover:opacity-90 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Generate Report
          </button>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => (
            <div 
              key={report.id}
              className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-1 line-clamp-1">{report.name}</h3>
                    <p className="text-sm text-gray-400">{report.target}</p>
                  </div>
                  {getStatusBadge(report.status)}
                </div>

                {/* Findings Summary */}
                <div className="flex gap-1 mb-4">
                  {report.findings.critical > 0 && (
                    <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                      {report.findings.critical} Critical
                    </span>
                  )}
                  {report.findings.high > 0 && (
                    <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded">
                      {report.findings.high} High
                    </span>
                  )}
                  {report.findings.medium > 0 && (
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                      {report.findings.medium} Med
                    </span>
                  )}
                </div>

                {/* Severity Bar */}
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex mb-4">
                  {report.findings.critical > 0 && (
                    <div 
                      className="h-full bg-red-500" 
                      style={{ width: `${(report.findings.critical / totalFindings(report.findings)) * 100}%` }}
                    />
                  )}
                  {report.findings.high > 0 && (
                    <div 
                      className="h-full bg-orange-500" 
                      style={{ width: `${(report.findings.high / totalFindings(report.findings)) * 100}%` }}
                    />
                  )}
                  {report.findings.medium > 0 && (
                    <div 
                      className="h-full bg-yellow-500" 
                      style={{ width: `${(report.findings.medium / totalFindings(report.findings)) * 100}%` }}
                    />
                  )}
                  {report.findings.low > 0 && (
                    <div 
                      className="h-full bg-blue-500" 
                      style={{ width: `${(report.findings.low / totalFindings(report.findings)) * 100}%` }}
                    />
                  )}
                  {report.findings.info > 0 && (
                    <div 
                      className="h-full bg-gray-500" 
                      style={{ width: `${(report.findings.info / totalFindings(report.findings)) * 100}%` }}
                    />
                  )}
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    {getFormatIcon(report.format)}
                    {report.size && <span>• {report.size}</span>}
                  </div>
                  <span>{new Date(report.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-gray-800 p-4 flex gap-2">
                {report.status === 'ready' ? (
                  <>
                    <button 
                      onClick={() => handleDownload(report)}
                      className="flex-1 py-2 bg-kali-blue hover:bg-kali-blue/90 text-white text-center rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                    <Link 
                      to={`/dashboard/reports/${report.id}`}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="px-3 py-2 bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg text-sm transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                ) : report.status === 'generating' ? (
                  <div className="flex-1 py-2 text-center text-gray-400 text-sm">
                    Generating report...
                  </div>
                ) : (
                  <button className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition">
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredReports.length === 0 && (
          <div className="text-center py-16 bg-gray-900 rounded-xl border border-gray-800">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No reports yet</h3>
            <p className="text-gray-400 mb-4">Generate your first security report from a completed scan.</p>
            <button 
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-6 py-2 bg-kali-blue text-white rounded-lg hover:bg-kali-blue/90 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Generate Report
            </button>
          </div>
        )}

        {/* New Report Modal */}
        {showNewModal && (
          <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowNewModal(false)}
          >
            <div 
              className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-2xl max-h-[90vh] overflow-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-gray-900">
                <h2 className="text-xl font-semibold text-white">Generate Report</h2>
                <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Template Selection */}
                <div>
                  <h3 className="text-white font-medium mb-3">Choose Template</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {reportTemplates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplate(template.id)}
                        className={`p-4 rounded-xl border text-left transition ${
                          selectedTemplate === template.id
                            ? 'bg-kali-blue/20 border-kali-blue'
                            : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="text-2xl mb-2">{template.icon}</div>
                        <h4 className="text-white font-medium mb-1">{template.name}</h4>
                        <p className="text-xs text-gray-400">{template.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scan Selection */}
                <div>
                  <h3 className="text-white font-medium mb-3">Select Scans ({scans.length} available)</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {scans.length > 0 ? scans.map(scan => (
                      <label
                        key={scan.id}
                        className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition"
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
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-kali-blue focus:ring-kali-blue"
                        />
                        <div className="flex-1">
                          <p className="text-white text-sm">{scan.name}</p>
                          <p className="text-xs text-gray-400">{scan.date}</p>
                        </div>
                      </label>
                    )) : (
                      <div className="text-center py-6 text-gray-400">
                        <p>No scans found. Run some scans first to generate reports.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Report Options */}
                <div>
                  <h3 className="text-white font-medium mb-3">Options</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Format</label>
                      <select 
                        value={reportFormat}
                        onChange={(e) => setReportFormat(e.target.value as 'pdf' | 'html' | 'json')}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-kali-blue transition"
                      >
                        <option value="pdf">PDF / TXT</option>
                        <option value="html">HTML</option>
                        <option value="json">JSON</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Report Name</label>
                      <input
                        type="text"
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                        placeholder="Security Assessment Report"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-kali-blue transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Sections */}
                <div>
                  <h3 className="text-white font-medium mb-3">Include Sections</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {['Executive Summary', 'Technical Details', 'Remediation Guide', 'Risk Matrix', 'Compliance Mapping', 'Appendix'].map(section => (
                      <label
                        key={section}
                        className="flex items-center gap-2 p-2 hover:bg-gray-800 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSections.includes(section)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSections([...selectedSections, section]);
                            } else {
                              setSelectedSections(selectedSections.filter(s => s !== section));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-kali-blue focus:ring-kali-blue"
                        />
                        <span className="text-sm text-gray-300">{section}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-800 sticky bottom-0 bg-gray-900">
                <button
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateReport}
                  disabled={selectedScans.length === 0 || generating}
                  className="px-6 py-2 bg-gradient-to-r from-kali-blue to-kali-purple hover:opacity-90 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Generate Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportsPage;
