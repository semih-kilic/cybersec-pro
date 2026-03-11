import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';
import { useSendChatMessage } from '../../hooks/useApiQueries';

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  type?: string;
  timestamp: Date;
}

interface QuickAction {
  id: string;
  label: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'bot',
  content: `Hi! I'm **CyberBot**, your security assistant. 👋

I can help you with:
- 💰 **Plan pricing** and comparisons
- 🔍 **What we test** — 401 security tests explained
- 🛡️ **Scan results** — I'll explain findings in plain language
- 🔧 **Fix guidance** — Step-by-step remediation instructions
- 📞 **Support** — Connect with our team

Just type your question or use the quick actions below!`,
  type: 'welcome',
  timestamp: new Date(),
};

export default function AIAssistantPage() {
  useDocumentTitle('AI Assistant — CyberSec Pro');
  const { token: _token } = useAuth();
  const chatMutation = useSendChatMessage();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([
    { id: 'pricing', label: '💰 Pricing' },
    { id: 'what_we_test', label: '🔍 What do you test?' },
    { id: 'free_trial', label: '🎁 Free Trial' },
    { id: 'support', label: '📞 Support' },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string, quickAction?: string) => {
    if (!text.trim() && !quickAction) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: quickAction ? quickActions.find(q => q.id === quickAction)?.label || text : text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await chatMutation.mutateAsync({
        message: text,
        quick_action: quickAction || undefined,
      });

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        content: data.response || 'Sorry, I could not process that. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);

      if (data.quick_actions) {
        setQuickActions(data.quick_actions);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'bot',
        content: 'Connection error. Please check your internet and try again.',
        type: 'error',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    }

    setLoading(false);
    inputRef.current?.focus();
  };

  const handleQuickAction = (actionId: string) => {
    sendMessage('', actionId);
  };

  const renderMarkdown = (text: string) => {
    // Simple markdown renderer
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded text-cyan-400 text-xs">$1</code>')
      .replace(/^• /gm, '&bull; ')
      .replace(/^(\d+)\. /gm, '$1. ')
      .replace(/\n/g, '<br/>');
  };

  return (
    <PageTransition>
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-700/50">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-lg">
          🤖
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">CyberBot</h1>
          <p className="text-xs text-gray-400">AI Security Assistant — Always here to help</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs text-emerald-400">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-50'
                  : msg.type === 'error'
                  ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                  : 'bg-gray-800/60 border border-gray-700/50 text-gray-200'
              }`}
            >
              {msg.role === 'bot' && (
                <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-700/30">
                  <span className="text-sm">🤖</span>
                  <span className="text-xs font-medium text-cyan-400">CyberBot</span>
                  <span className="text-xs text-gray-500">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              <div
                className="text-sm leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
              />
              {msg.role === 'user' && (
                <div className="text-right mt-1">
                  <span className="text-xs text-gray-500">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-700/30">
                <span className="text-sm">🤖</span>
                <span className="text-xs font-medium text-cyan-400">CyberBot</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-gray-400">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 py-3 overflow-x-auto">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleQuickAction(action.id)}
            disabled={loading}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-full text-xs text-gray-300 hover:text-white transition whitespace-nowrap disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-gray-700/50 pt-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Ask CyberBot anything about security, scans, pricing..."
            className="flex-1 bg-gray-800/80 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 text-sm"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="px-5 py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white rounded-xl hover:from-cyan-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
          >
            Send
          </button>
        </div>
        <p className="text-center text-xs text-gray-600 mt-2">
          CyberBot uses business language — no technical jargon. Your data stays private.
        </p>
      </div>
    </div>
    </PageTransition>
  );
}
