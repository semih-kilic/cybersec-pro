import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const DEMO_OUTPUT_NMAP = [
  '$ nmap -sV -sC scanme.nmap.org',
  'Starting Nmap 7.94SVN ( https://nmap.org )',
  'Nmap scan report for scanme.nmap.org (45.33.32.156)',
  'Host is up (0.042s latency).',
  '',
  'PORT     STATE SERVICE VERSION',
  '22/tcp   open  ssh     OpenSSH 6.6.1p1 Ubuntu 2ubuntu2.13',
  '80/tcp   open  http    Apache httpd 2.4.7',
  '9929/tcp open  npadmin',
  '',
  'Service detection performed. 3 services scanned.',
  '',
  'Nmap done: 1 IP address (1 host up) scanned in 12.47 seconds',
];

const DEMO_OUTPUT_NIKTO = [
  '$ nikto -h scanme.nmap.org',
  '- Nikto v2.5.0',
  '- Target IP:     45.33.32.156',
  '- Target Hostname: scanme.nmap.org',
  '- Target Port:   80',
  '- Start Time:    2026-08-20 12:00:00',
  '',
  '+ Server: Apache/2.4.7 (Ubuntu)',
  '+ Retrieved x-powered-by header: PHP/5.5.9-1ubuntu4.29',
  '+ /: The anti-clickjacking X-Frame-Options header is not present.',
  '+ /: Uncommon header 'x-content-type-options' found, with contents: nosniff',
  '+ OSVDB-3233: /icons/README: Apache default file found.',
  '+ 7915 requests: 0 error(s) and 5 item(s) reported on remote host',
  '',
  '- End Time:      2026-08-20 12:01:14',
];

const DEMO_OUTPUT_WHATWEB = [
  '$ whatweb scanme.nmap.org',
  'http://scanme.nmap.org [200 OK] Apache[2.4.7], Country[UNITED STATES]',
  '[US], HTTPServer[Ubuntu Linux][Apache/2.4.7 (Ubuntu)], IP[45.33.32.156]',
  ', Title[Go ahead and ScanMe!]',
  '',
  'Summary  : 3 plugins found',
];

const TOOL_MAP: Record<string, string[]> = {
  nmap: DEMO_OUTPUT_NMAP,
  nikto: DEMO_OUTPUT_NIKTO,
  whatweb: DEMO_OUTPUT_WHATWEB,
};

const TOOL_DURATION: Record<string, number> = {
  nmap: 8000,
  nikto: 7000,
  whatweb: 3000,
};

const RESULTS_MAP: Record<string, { openPorts: number; services: string; duration: string }> = {
  nmap: { openPorts: 3, services: 'SSH, HTTP, npadmin', duration: '12.47s' },
  nikto: { openPorts: 0, services: 'Apache 2.4.7, PHP 5.5.9', duration: '74s' },
  whatweb: { openPorts: 0, services: 'Apache, Ubuntu Linux, PHP', duration: '1.2s' },
};

export function DemoPage() {
  const { t } = useTranslation();
  const [target, setTarget] = useState('scanme.nmap.org');
  const [selectedTool, setSelectedTool] = useState('nmap');
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [output, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const runDemo = () => {
    if (isRunning || !target.trim()) return;
    setIsRunning(true);
    setOutput([]);
    setProgress(0);
    setShowResults(false);

    const lines = TOOL_MAP[selectedTool] ?? DEMO_OUTPUT_NMAP;
    const duration = TOOL_DURATION[selectedTool] ?? 8000;
    const progressStep = 100 / lines.length;
    let lineIndex = 0;

    intervalRef.current = setInterval(() => {
      if (lineIndex < lines.length) {
        setOutput((prev) => [...prev, lines[lineIndex]]);
        setProgress((prev) => Math.min(prev + progressStep, 100));
        lineIndex++;
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setProgress(100);
        setIsRunning(false);
        setShowResults(true);
      }
    }, duration / lines.length);
  };

  const results = RESULTS_MAP[selectedTool] ?? RESULTS_MAP.nmap;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-20">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-5xl font-bold mb-3">
            {t('demo.title', 'Try CyberSec Pro — Free Live Scan')}
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {t('demo.subtitle', 'Experience real security scanning directly in your browser. No sign-up required.')}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {t('demo.targetLabel', 'Target')}
          </label>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="scanme.nmap.org"
            disabled={isRunning}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-mono text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition disabled:opacity-50 mb-4"
          />

          <label className="block text-sm font-medium text-gray-300 mb-2">
            {t('demo.toolLabel', 'Select Tool')}
          </label>
          <div className="flex flex-wrap gap-3 mb-6">
            {(['nmap', 'nikto', 'whatweb'] as const).map((tool) => (
              <label
                key={tool}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition text-sm font-medium ${
                  selectedTool === tool
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="tool"
                  value={tool}
                  checked={selectedTool === tool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  disabled={isRunning}
                  className="sr-only"
                />
                {tool.charAt(0).toUpperCase() + tool.slice(1)}
              </label>
            ))}
          </div>

          <button
            onClick={runDemo}
            disabled={isRunning || !target.trim()}
            className="w-full sm:w-auto px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? t('demo.running', 'Scanning...') : t('demo.startButton', 'Start Demo Scan')}
          </button>

          <p className="text-xs text-gray-500 mt-3">
            {t('demo.disclaimer', 'This is a simulated demo. No real scans are executed from your browser.')}
          </p>
        </div>

        {(output.length > 0 || isRunning) && (
          <div className="mb-8">
            <div className="w-full bg-gray-800 rounded-full h-2 mb-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-800 border-b border-gray-700">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-400 text-xs ml-2 font-mono">terminal — demo</span>
              </div>
              <div
                ref={terminalRef}
                className="p-4 bg-black font-mono text-xs leading-relaxed h-72 overflow-y-auto"
              >
                {output.map((line, i) => (
                  <div key={i} className={`whitespace-pre-wrap ${
                    line.startsWith('$') ? 'text-cyan-400 font-bold' :
                    line.startsWith('+') || line.startsWith('PORT') ? 'text-yellow-300' :
                    line.startsWith('Nmap done') || line.includes('Summary') ? 'text-green-400 font-bold' :
                    'text-green-300'
                  }`}>
                    {line}
                  </div>
                ))}
                {isRunning && (
                  <span className="inline-block w-2 h-4 bg-green-400 animate-pulse align-middle ml-0.5" />
                )}
              </div>
            </div>
          </div>
        )}

        {showResults && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">{t('demo.results', 'Scan Results')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="text-3xl font-bold text-cyan-400 mb-1">{results.openPorts}</div>
                <div className="text-sm text-gray-400">Open Ports</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="text-sm font-semibold text-white mb-1">{results.services}</div>
                <div className="text-sm text-gray-400">Services Detected</div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="text-3xl font-bold text-emerald-400 mb-1">{results.duration}</div>
                <div className="text-sm text-gray-400">Scan Duration</div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mt-12">
          <p className="text-gray-400 mb-4">{t('demo.cta', 'Ready for a full security assessment?')}</p>
          <Link
            to="/register"
            className="inline-block px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition shadow-lg shadow-cyan-500/25"
          >
            {t('demo.ctaButton', 'Create Free Account')}
          </Link>
        </div>
      </div>
    </div>
  );
}
