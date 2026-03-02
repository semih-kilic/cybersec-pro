/**
 * 🐉 CyberSec Pro — ErrorBoundary Component
 * Global and per-route error boundaries with crash recovery
 */
import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <ErrorFallback error={this.state.error} onRetry={() => this.setState({ hasError: false, error: null })} />;
    }
    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onRetry?: () => void;
}

export function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {/* Glitch icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-400 mb-6">
          An unexpected error occurred. This has been logged and our team will look into it.
        </p>

        {/* Error details (dev mode) */}
        {error && (import.meta as any).env?.DEV && (
          <details className="mb-6 text-left">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
              Technical details
            </summary>
            <pre className="mt-2 p-3 bg-gray-900/80 border border-gray-800 rounded-lg text-xs text-red-400 overflow-auto max-h-40 font-mono">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}

        <div className="flex items-center justify-center gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20"
            >
              Try Again
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;
