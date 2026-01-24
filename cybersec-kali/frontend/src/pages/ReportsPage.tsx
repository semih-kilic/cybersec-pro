import React, { useState, useEffect } from 'react';

import { 
  FileText, Download, CheckCircle, Clock, Calendar,
  Shield, Target, AlertTriangle, Trash2
} from 'lucide-react';
import axios from 'axios';

const API_URL = '';

interface Scan {
  id: number;
  tool: string;
  target: string;
  status: string;
  created_at: string;
  results?: string;
}

interface Report {
  id: number;
  name: string;
  created_at: string;
  scan_count: number;
  file_path: string;
}

export default function ReportsPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedScans, setSelectedScans] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportName, setReportName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [scansRes, reportsRes] = await Promise.all([
        axios.get(`${API_URL}/api/scans?status=completed`),
        axios.get(`${API_URL}/api/reports`)
      ]);
      
      setScans(scansRes.data.scans || []);
      setReports(reportsRes.data.reports || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleScanSelection = (scanId: number) => {
    setSelectedScans(prev => 
      prev.includes(scanId) 
        ? prev.filter(id => id !== scanId)
        : [...prev, scanId]
    );
  };

  const generateReport = async () => {
    if (selectedScans.length === 0) {
      alert('Please select at least one scan!');
      return;
    }

    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          scan_ids: selectedScans,
          report_name: reportName || `Security_Report_${new Date().toISOString().split('T')[0]}`
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }
      const contentType = response.headers.get('content-type') || '';
      const buffer = await response.arrayBuffer();
      console.debug('Report response', {
        status: response.status,
        contentType,
        size: buffer.byteLength
      });
      if (!buffer || buffer.byteLength === 0) {
        const ids = selectedScans.join(',');
        const fallbackUrl = `${API_URL}/api/reports/generate?scan_ids=${encodeURIComponent(ids)}&title=${encodeURIComponent(reportName || 'Security Report')}`;
        window.location.href = fallbackUrl;
        return;
      }
      const signature = new TextDecoder().decode(new Uint8Array(buffer).slice(0, 4));
      if (!contentType.includes('application/pdf') && signature !== '%PDF') {
        const errorText = new TextDecoder().decode(buffer);
        throw new Error(errorText || 'Invalid PDF response');
      }
      // Download file
      const url = window.URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportName || 'Security_Report'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      alert('✅ Report generated successfully!');
      setSelectedScans([]);
      setReportName('');
      loadData();
    } catch (error: any) {
      alert(`❌ Report generation failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const deleteReport = async (reportId: number) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/reports/${reportId}`);
      loadData();
    } catch (error: any) {
      alert(`❌ Delete failed: ${error.response?.data?.error || error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl gradient-text animate-pulse">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <FileText className="text-primary" />
          Reports
        </h1>
        <p className="text-gray-400 text-lg">
          Generate professional PDF reports from your scans
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Generate Report */}
        <div
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="text-primary" />
            Generate New Report
          </h2>
          
          {/* Report Name */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Report Name</label>
            <input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Security Assessment Report"
              className="w-full px-4 py-3 bg-dark-bg text-white rounded-xl border border-dark-border focus:border-primary outline-none"
            />
          </div>
          
          {/* Select Scans */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Select Scans ({selectedScans.length} selected)
            </label>
            
            <div className="max-h-64 overflow-y-auto space-y-2">
              {scans.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No completed scans</p>
                  <p className="text-sm">Run some scans first</p>
                </div>
              ) : (
                scans.map((scan) => (
                  <button
                    key={scan.id}
                    onClick={() => toggleScanSelection(scan.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer ${
                      selectedScans.includes(scan.id)
                        ? 'bg-primary/20 border border-primary/50'
                        : 'bg-dark-bg/50 hover:bg-dark-bg border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedScans.includes(scan.id)
                            ? 'bg-primary border-primary'
                            : 'border-gray-500'
                        }`}>
                          {selectedScans.includes(scan.id) && (
                            <CheckCircle className="w-4 h-4 text-dark-bg" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-white">{scan.tool}</div>
                          <div className="text-sm text-gray-500">{scan.target}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(scan.created_at).toLocaleDateString('en-US')}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
          
          {/* Generate Button */}
          <button
            onClick={generateReport}
            disabled={generating || selectedScans.length === 0}
            className="w-full py-3 bg-gradient-to-r from-primary to-secondary text-dark-bg font-bold rounded-xl hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin w-5 h-5 border-2 border-dark-bg border-t-transparent rounded-full" />
                Generating...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Download className="w-5 h-5" />
                Generate PDF Report
              </span>
            )}
          </button>
        </div>

        {/* Previous Reports */}
        <div
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="text-primary" />
            Previous Reports
          </h2>
          
          {reports.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No reports yet</p>
              <p className="text-sm">Generate your first report above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 bg-dark-bg/50 rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/20 rounded-lg">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-bold text-white">{report.name}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {new Date(report.created_at).toLocaleDateString('en-US')}
                        <span>•</span>
                        {report.scan_count} scans
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <a
                      href={`${API_URL}/api/reports/${report.id}/download`}
                      className="p-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-all cursor-pointer"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                    <button
                      onClick={() => deleteReport(report.id)}
                      className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report Features */}
      <div
        className="mt-8 grid md:grid-cols-3 gap-4"
      >
        <FeatureCard
          icon={<Shield className="w-6 h-6" />}
          title="Professional Format"
          description="Clean, branded PDF reports ready for clients"
        />
        <FeatureCard
          icon={<Target className="w-6 h-6" />}
          title="Detailed Findings"
          description="Comprehensive vulnerability details and evidence"
        />
        <FeatureCard
          icon={<AlertTriangle className="w-6 h-6" />}
          title="Risk Assessment"
          description="Severity ratings and remediation recommendations"
        />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="glass rounded-xl p-4 flex items-start gap-4">
      <div className="p-2 bg-primary/20 rounded-lg text-primary">
        {icon}
      </div>
      <div>
        <div className="font-bold text-white">{title}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
    </div>
  );
}
