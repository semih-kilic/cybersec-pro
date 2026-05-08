import { useState, useEffect } from 'react';
import { XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useToolCounts } from '../hooks/useApiQueries';

interface WelcomeTourProps {
  isOpen: boolean;
  onClose: () => void;
  planType: string;
  userId?: string | number;
}

function buildTourSteps(toolsTotal: number) {
  return [
  {
    title: "Welcome to CyberSec Pro! \uD83C\uDF89",
    description: `${toolsTotal} Kali Linux security tools at your fingertips. Let's get you started in 4 quick steps.`,
    image: "🛡️",
    highlight: null,
    shortcut: null
  },
  {
    title: "Step 1: Connect an Agent",
    description: "Navigate to Agents and add your first Kali Linux machine. Agents run the actual scans on your targets.",
    image: "🖥️",
    highlight: "agents",
    shortcut: "/dashboard/agents"
  },
  {
    title: "Step 2: Run Your First Scan",
    description: "Pick a tool (like Nmap), enter a target (try scanme.nmap.org), and hit Run. Results stream in real-time!",
    image: "🔍",
    highlight: "tools",
    shortcut: "/dashboard/tools"
  },
  {
    title: "Step 3: View Reports",
    description: "All scan results appear in Reports. Export as PDF, track vulnerabilities, and share with your team.",
    image: "📊",
    highlight: "reports",
    shortcut: "/dashboard/reports"
  },
  {
    title: "You're Ready! 🚀",
    description: "Use Ctrl+K to quickly navigate anywhere. Need help? Check Documentation or send Feedback anytime.",
    image: "⚡",
    highlight: null,
    shortcut: null
  }
  ];
}

export default function WelcomeTour({ isOpen, onClose, planType, userId }: WelcomeTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { data: toolCounts } = useToolCounts();
  const toolsTotal = toolCounts?.total ?? 0;
  const tourSteps = buildTourSteps(toolsTotal);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const step = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;

  const markComplete = () => {
    try {
      const key = userId ? `cybersec_tour_completed_${userId}` : 'cybersec_tour_completed';
      localStorage.setItem(key, 'true');
      // Also set legacy key for backward compat with older OverviewPage checks.
      localStorage.setItem('cybersec_tour_completed', 'true');
    } catch {
      // localStorage may be unavailable (private mode); ignore
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      markComplete();
      onClose();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    markComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleSkip} />
      
      {/* Modal */}
      <div className="relative bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-gray-800">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
          />
        </div>

        {/* Close Button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-1 text-gray-500 hover:text-white transition"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        {/* Content */}
        <div className="p-8 text-center">
          {/* Icon */}
          <div className="text-6xl mb-6">{step.image}</div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-4">{step.title}</h2>

          {/* Description */}
          <p className="text-gray-300 whitespace-pre-line leading-relaxed mb-8">
            {step.description}
          </p>

          {/* Plan Info (first step only) */}
          {currentStep === 0 && (
            <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
              <p className="text-gray-400 text-sm">
                You're on the <span className="text-cyan-400 font-semibold">{planType}</span> plan with access to{' '}
                <span className="text-cyan-400 font-semibold">
                  {planType === 'enterprise' || planType === 'professional' || planType === 'starter' ? toolsTotal : Math.min(3, toolsTotal)}
                </span>{' '}
                security tools.
              </p>
            </div>
          )}

          {/* Keyboard shortcut tip (last step) */}
          {currentStep === tourSteps.length - 1 && (
            <div className="mb-6 p-4 bg-gray-800/50 rounded-lg text-left">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">⌨️ Keyboard Shortcuts:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <kbd className="text-cyan-300 bg-gray-800 px-2 py-1 rounded text-xs">Ctrl+K</kbd>
                  <span className="text-gray-400">Quick search & navigate</span>
                </li>
                <li className="flex items-center gap-2">
                  <kbd className="text-cyan-300 bg-gray-800 px-2 py-1 rounded text-xs">/</kbd>
                  <span className="text-gray-400">Focus search bar</span>
                </li>
                <li className="flex items-center gap-2">
                  <kbd className="text-cyan-300 bg-gray-800 px-2 py-1 rounded text-xs">Esc</kbd>
                  <span className="text-gray-400">Close any dialog</span>
                </li>
              </ul>
            </div>
          )}

          {/* Sidebar highlight indicator */}
          {step.highlight && (
            <div className="mb-6 flex items-center justify-center gap-2 text-xs text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Look for the highlighted <strong>{step.highlight}</strong> section in the sidebar
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-gray-500 hover:text-gray-300 text-sm transition"
            >
              Skip tour
            </button>

            <div className="flex items-center gap-2">
              {/* Step indicators */}
              {tourSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-2 h-2 rounded-full transition ${
                    index === currentStep ? 'bg-cyan-500' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-semibold transition"
            >
              {isLastStep ? "Get Started" : "Next"}
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
