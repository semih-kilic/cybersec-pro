import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const provider = searchParams.get('provider') || 'google';
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError(`OAuth error: ${errorParam}`);
        return;
      }

      if (!code) {
        setError('No authorization code received');
        return;
      }

      try {
        // Send redirect_uri so backend uses the same one for token exchange
        const redirectUri = `${window.location.origin}/auth/callback?provider=${provider}`;
        const response = await fetch(`/api/v1/auth/${provider}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'OAuth authentication failed');
        }

        // Store token and update auth state
        localStorage.setItem('token', data.access_token);
        
        // Reload the page to update auth state
        window.location.href = '/dashboard';
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handleCallback();
  }, [searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-8">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Authentication Failed</h2>
            <p className="text-red-400 mb-6">{error}</p>
            <a 
              href="/login"
              className="inline-block px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Back to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Completing Sign In</h2>
        <p className="text-gray-400">Please wait while we authenticate you...</p>
      </div>
    </div>
  );
}

export default OAuthCallback;
