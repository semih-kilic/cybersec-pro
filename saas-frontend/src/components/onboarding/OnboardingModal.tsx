import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
  userName: string;
  planType: string;
  toolsCount: number;
  scansPerDay: number;
  trialDaysLeft?: number;
}

const PLAN_COLORS: Record<string, string> = {
  trial: 'from-gray-500 to-gray-600',
  starter: 'from-green-500 to-emerald-600',
  professional: 'from-blue-500 to-cyan-600',
  team: 'from-purple-500 to-violet-600',
  enterprise: 'from-yellow-500 to-orange-600',
};

const PLAN_NAMES: Record<string, string> = {
  trial: 'Trial',
  starter: 'Starter',
  professional: 'Professional',
  team: 'Team',
  enterprise: 'Enterprise',
};

export function OnboardingModal({
  isOpen,
  onComplete,
  userName,
  planType,
  toolsCount,
  scansPerDay,
  trialDaysLeft,
}: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const steps = [
    // Step 0: Welcome
    {
      title: `Welcome to CyberSec Pro, ${userName}! 🎉`,
      content: (
        <div className="text-center space-y-6">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r ${PLAN_COLORS[planType]} mb-4`}>
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r ${PLAN_COLORS[planType]} text-white`}>
                {PLAN_NAMES[planType]} Plan
              </span>
              {trialDaysLeft && (
                <span className="px-3 py-1 rounded-full text-sm bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                  {trialDaysLeft} days left
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-3xl font-bold text-cyan-400">{toolsCount}</div>
                <div className="text-gray-400 text-sm">Security Tools</div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-3xl font-bold text-purple-400">{scansPerDay === -1 ? '∞' : scansPerDay}</div>
                <div className="text-gray-400 text-sm">Scans/Day</div>
              </div>
            </div>
          </div>
          
          <p className="text-gray-400">
            You're ready to run professional security scans with Kali Linux tools.
            Let's take a quick tour!
          </p>
        </div>
      ),
    },
    // Step 1: Tools Overview
    {
      title: 'Powerful Security Tools 🛡️',
      content: (
        <div className="space-y-6">
          <p className="text-gray-400 text-center">
            Access industry-leading penetration testing tools directly from your browser.
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '🔍', name: 'Nmap', desc: 'Network scanning' },
              { icon: '🌐', name: 'Nikto', desc: 'Web vulnerabilities' },
              { icon: '📁', name: 'Dirb', desc: 'Directory brute-force' },
              { icon: '🔐', name: 'SSLScan', desc: 'SSL/TLS analysis' },
              { icon: '💉', name: 'SQLMap', desc: 'SQL injection', locked: planType === 'trial' || planType === 'starter' },
              { icon: '📝', name: 'WPScan', desc: 'WordPress security', locked: planType === 'trial' || planType === 'starter' },
            ].map((tool, i) => (
              <div 
                key={i}
                className={`p-4 rounded-lg border ${
                  tool.locked 
                    ? 'bg-gray-800/30 border-gray-700/50 opacity-60' 
                    : 'bg-gray-800/50 border-gray-700 hover:border-cyan-500/50'
                } transition`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{tool.icon}</span>
                  <div>
                    <div className="font-semibold text-white flex items-center gap-2">
                      {tool.name}
                      {tool.locked && <span className="text-xs text-yellow-500">🔒 Pro</span>}
                    </div>
                    <div className="text-xs text-gray-500">{tool.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {(planType === 'trial' || planType === 'starter') && (
            <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-xl p-4 border border-cyan-500/30">
              <p className="text-sm text-center text-gray-300">
                🚀 <span className="text-cyan-400 font-semibold">Upgrade to Professional</span> to unlock all {planType === 'trial' ? '15' : '13'} tools!
              </p>
            </div>
          )}
        </div>
      ),
    },
    // Step 2: How It Works
    {
      title: 'How It Works ⚡',
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            {[
              {
                step: '1',
                title: 'Choose a Tool',
                desc: 'Select from Nmap, Nikto, and other professional tools',
                icon: '🎯',
                color: 'cyan',
              },
              {
                step: '2',
                title: 'Enter Target',
                desc: 'Specify the domain, IP, or URL to scan',
                icon: '🎪',
                color: 'purple',
              },
              {
                step: '3',
                title: 'Run Scan',
                desc: 'Execute the scan and watch results in real-time',
                icon: '🚀',
                color: 'green',
              },
              {
                step: '4',
                title: 'Get Report',
                desc: 'Download detailed vulnerability reports',
                icon: '📊',
                color: 'yellow',
              },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full bg-${item.color}-500/20 flex items-center justify-center text-2xl`}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white">{item.title}</div>
                  <div className="text-sm text-gray-400">{item.desc}</div>
                </div>
                {i < 3 && (
                  <div className="text-gray-600">→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ),
    },
    // Step 3: Ready to Start
    {
      title: "You're All Set! 🎊",
      content: (
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 mb-4">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <p className="text-gray-400">
            You're ready to start your first security scan!
          </p>
          
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 space-y-4">
            <h4 className="font-semibold text-white">Quick Start Options:</h4>
            
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => {
                  onComplete();
                  navigate('/dashboard/scans/new');
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold hover:opacity-90 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Run Your First Scan
              </button>
              
              <button
                onClick={() => {
                  onComplete();
                  navigate('/dashboard/tools');
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Browse All Tools
              </button>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg overflow-hidden shadow-2xl"
        >
          {/* Progress Bar */}
          <div className="h-1 bg-gray-800">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-2xl font-bold text-white text-center mb-6">
                  {steps[step].title}
                </h2>
                {steps[step].content}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-8 pb-8 flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-gray-500 hover:text-gray-400 text-sm transition"
            >
              Skip tour
            </button>
            
            <div className="flex items-center gap-4">
              {/* Step Indicators */}
              <div className="flex gap-2">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition ${
                      i === step ? 'bg-cyan-500' : i < step ? 'bg-cyan-500/50' : 'bg-gray-700'
                    }`}
                  />
                ))}
              </div>
              
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    onClick={handlePrev}
                    className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
                  >
                    Back
                  </button>
                )}
                
                {step < steps.length - 1 ? (
                  <button
                    onClick={handleNext}
                    className="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:opacity-90 transition"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={onComplete}
                    className="px-6 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:opacity-90 transition"
                  >
                    Go to Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
