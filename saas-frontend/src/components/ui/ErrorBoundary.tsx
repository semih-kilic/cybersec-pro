/**
 * V18: Global Error Boundary
 * Catches React render crashes and shows a professional fallback UI
 * instead of a white screen. Logs errors for observability.
 */
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console (could be replaced with Sentry/DataDog)
    console.error('[ErrorBoundary] Caught:', error, info);
    this.setState({ errorInfo: info.componentStack || '' });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <div className="max-w-lg w-full text-center">
            {/* Icon */}
            <div className="mx-auto w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-gray-400 mb-6">
              An unexpected error occurred. Our team has been notified.
            </p>

            {/* Error details (dev only) */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-300 transition">
                  Error Details
                </summary>
                <pre className="mt-2 p-3 bg-gray-900 rounded-lg text-xs text-red-300 overflow-auto max-h-48 border border-gray-800">
                  {this.state.error.toString()}
                  {this.state.errorInfo}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors"
              >
                Go to Dashboard
              </button>
            </div>

            {/* Branding */}
            <p className="mt-8 text-xs text-gray-600">
              CyberSec Pro v3.0 &mdash; Enterprise Security Platform
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Inline ErrorBoundary for individual page sections (non-fatal)
 */
export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[SectionError]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-red-400 text-sm font-medium mb-2">This section failed to load</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs text-gray-400 hover:text-white underline transition"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
