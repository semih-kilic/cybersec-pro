import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  BugAntIcon, 
  LightBulbIcon, 
  ExclamationTriangleIcon,
  HeartIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface FeedbackType {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const feedbackTypes: FeedbackType[] = [
  {
    id: 'bug',
    name: 'Bug Report',
    description: 'Report a problem or error',
    icon: BugAntIcon,
    color: 'red'
  },
  {
    id: 'suggestion',
    name: 'Suggestion',
    description: 'Share your ideas for improvement',
    icon: LightBulbIcon,
    color: 'yellow'
  },
  {
    id: 'complaint',
    name: 'Complaint',
    description: 'Let us know about issues',
    icon: ExclamationTriangleIcon,
    color: 'orange'
  },
  {
    id: 'thanks',
    name: 'Thank You',
    description: 'Share positive feedback',
    icon: HeartIcon,
    color: 'pink'
  },
  {
    id: 'other',
    name: 'Other',
    description: 'General feedback',
    icon: ChatBubbleLeftRightIcon,
    color: 'blue'
  }
];

export default function FeedbackPage() {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('medium');
  const [includeSystemInfo, setIncludeSystemInfo] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedType) {
      setError('Please select a feedback type');
      return;
    }
    
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setSending(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      
      // Gather system info if enabled
      const systemInfo = includeSystemInfo ? {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        currentUrl: window.location.href
      } : null;

      const response = await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: selectedType,
          subject,
          message,
          priority,
          systemInfo,
          user: {
            email: user?.email,
            name: user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'User'
          }
        })
      });

      if (response.ok) {
        setSent(true);
        setSelectedType('');
        setSubject('');
        setMessage('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to send feedback');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-2xl p-12 text-center border border-green-500/30">
            <CheckCircleIcon className="w-20 h-20 text-green-400 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-white mb-4">Thank You!</h2>
            <p className="text-gray-300 text-lg mb-8">
              Your feedback has been sent successfully. We appreciate you taking the time to help us improve CyberSec Pro.
            </p>
            <button
              onClick={() => setSent(false)}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold transition"
            >
              Send Another Feedback
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Feedback & Support</h1>
        <p className="text-gray-400">
          Help us improve CyberSec Pro by sharing your thoughts, reporting issues, or just saying hello!
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Feedback Type Selection */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">What type of feedback?</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {feedbackTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              const colorClasses = {
                red: 'border-red-500 bg-red-500/20 text-red-400',
                yellow: 'border-yellow-500 bg-yellow-500/20 text-yellow-400',
                orange: 'border-orange-500 bg-orange-500/20 text-orange-400',
                pink: 'border-pink-500 bg-pink-500/20 text-pink-400',
                blue: 'border-blue-500 bg-blue-500/20 text-blue-400'
              };

              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-center ${
                    isSelected
                      ? colorClasses[type.color as keyof typeof colorClasses]
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? '' : 'text-gray-400'}`} />
                  <div className={`font-semibold text-sm ${isSelected ? '' : 'text-white'}`}>
                    {type.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 hidden md:block">
                    {type.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Feedback Form */}
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Subject */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your feedback"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
              required
            />
          </div>

          {/* Message */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please describe in detail..."
              rows={6}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition resize-none"
              required
            />
          </div>

          {/* Priority (for bugs) */}
          {selectedType === 'bug' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Priority Level
              </label>
              <div className="flex gap-4">
                {[
                  { id: 'low', label: 'Low', color: 'green' },
                  { id: 'medium', label: 'Medium', color: 'yellow' },
                  { id: 'high', label: 'High', color: 'orange' },
                  { id: 'critical', label: 'Critical', color: 'red' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      priority === p.id
                        ? `bg-${p.color}-500/30 border border-${p.color}-500 text-${p.color}-400`
                        : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* System Info Toggle */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSystemInfo}
                onChange={(e) => setIncludeSystemInfo(e.target.checked)}
                className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-gray-300">
                Include system information (browser, screen size, etc.)
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-8">
              This helps us diagnose issues better
            </p>
          </div>

          {/* User Info */}
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
            <div className="text-sm text-gray-400">
              Sending as: <span className="text-white font-medium">{user?.email}</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={sending || !selectedType}
            className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition ${
              sending || !selectedType
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'
            }`}
          >
            {sending ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending...
              </>
            ) : (
              <>
                <PaperAirplaneIcon className="w-5 h-5" />
                Send Feedback
              </>
            )}
          </button>
        </form>

        {/* Contact Info */}
        <div className="mt-8 text-center">
          <p className="text-gray-400">
            You can also reach us directly at{' '}
            <a 
              href="mailto:cybersecpro@semihkilic.com" 
              className="text-cyan-400 hover:text-cyan-300 transition"
            >
              cybersecpro@semihkilic.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
