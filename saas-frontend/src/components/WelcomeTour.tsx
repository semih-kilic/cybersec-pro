import { useState, useEffect } from 'react';
import { XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface WelcomeTourProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  planType: string;
}

const tourSteps = [
  {
    title: "Welcome to CyberSec Pro! 🎉",
    description: "You're about to access the power of 350+ Kali Linux security tools - all from your browser. Let us show you around!",
    image: "🛡️",
    highlight: null
  },
  {
    title: "Run Your First Scan",
    description: "Head to the Tools section to browse available security tools. Click on any tool to see details and run a scan.",
    image: "🔍",
    highlight: "tools"
  },
  {
    title: "Try Demo Targets",
    description: "Use our safe demo targets to test without risk:\n• scanme.nmap.org (Nmap testing)\n• testphp.vulnweb.com (Web scanning)\n• demo.testfire.net (SQL injection tests)",
    image: "🎯",
    highlight: "targets"
  },
  {
    title: "View Your Results",
    description: "All scan results appear in the Scans section. You can view detailed outputs, export reports, and track vulnerabilities.",
    image: "📊",
    highlight: "scans"
  },
  {
    title: "You're Ready!",
    description: "Start exploring CyberSec Pro. If you need help, check out our Documentation or send us Feedback anytime!",
    image: "🚀",
    highlight: null
  }
];

export default function WelcomeTour({ isOpen, onClose, planType }: WelcomeTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const step = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      // Save that user has seen the tour
      localStorage.setItem('cybersec_tour_completed', 'true');
      onClose();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('cybersec_tour_completed', 'true');
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
                  {planType === 'enterprise' ? '350+' : planType === 'team' ? '200' : planType === 'professional' ? '120' : '33'}
                </span>{' '}
                security tools.
              </p>
            </div>
          )}

          {/* Demo Targets Box (step 3) */}
          {currentStep === 2 && (
            <div className="mb-6 p-4 bg-gray-800/50 rounded-lg text-left">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">🎯 Safe Demo Targets:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <code className="text-cyan-300 bg-gray-800 px-2 py-1 rounded">scanme.nmap.org</code>
                  <span className="text-gray-500">- Port scanning</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <code className="text-cyan-300 bg-gray-800 px-2 py-1 rounded">testphp.vulnweb.com</code>
                  <span className="text-gray-500">- Web vulnerabilities</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <code className="text-cyan-300 bg-gray-800 px-2 py-1 rounded">demo.testfire.net</code>
                  <span className="text-gray-500">- OWASP testing</span>
                </li>
              </ul>
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
