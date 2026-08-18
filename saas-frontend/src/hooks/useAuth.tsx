import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react';

// Types
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  organization_id: string;
  avatar_url?: string;
  company?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_type: 'trial' | 'starter' | 'professional' | 'enterprise';
  is_active: boolean;
}

// Helper to get user's plan from organization
export function getUserPlan(organization: Organization | null): 'trial' | 'starter' | 'professional' | 'enterprise' {
  return organization?.plan_type || 'trial';
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  organization_name: string;
  first_name?: string;
  last_name?: string;
}

const API_URL = '/api/v1';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(() => !!localStorage.getItem('token'));
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const fetchingRef = useRef(false);

  const fetchUser = useCallback(async (currentToken: string) => {
    // Prevent multiple simultaneous fetches
    if (fetchingRef.current) return;
    
    fetchingRef.current = true;
    
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include',  // V18: Send httpOnly cookies
        headers: {
          'Authorization': `Bearer ${currentToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setOrganization(data.organization);
      } else if (response.status === 401) {
        // Token expired or invalid - clear auth state
        console.log('Token invalid, clearing auth state');
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setOrganization(null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      // Don't clear token on network errors - keep user logged in
      // Only clear if we've never successfully fetched user data
      if (!user && !initialFetchDone) {
        // Network error on initial load - don't logout, just mark as done
        console.log('Network error on initial fetch, keeping token');
      }
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setInitialFetchDone(true);
    }
  }, [user, initialFetchDone]);

  useEffect(() => {
    if (token && !initialFetchDone) {
      fetchUser(token);
    } else if (!token) {
      setLoading(false);
      setInitialFetchDone(true);
    }
  }, [token, fetchUser, initialFetchDone]);

  const login = async (email: string, password: string, mfaCode?: string) => {
    const body: Record<string, string> = { email, password };
    if (mfaCode) body.mfa_code = mfaCode;

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include',  // V18: Send/receive httpOnly cookies
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let error: any = {};
      try {
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          error = await response.json();
        } else {
          error = { error: `Server error (${response.status})` };
        }
      } catch { error = { error: 'Login failed' }; }
      // V13: Handle email verification requirement
      if (error.requires_verification) {
        const e: any = new Error(error.error || 'Please verify your email first.');
        e.requires_verification = true;
        e.email = error.email;
        throw e;
      }
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();

    // V20: Handle MFA challenge
    if (data.mfa_required) {
      const e: any = new Error(data.message || 'MFA verification required');
      e.requires_mfa = true;
      throw e;
    }

    // V18: Still store token for backward compat (will be removed once httpOnly-only)
    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    setOrganization(data.organization);
    setInitialFetchDone(true);
  };

  const register = async (data: RegisterData) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Registration failed');
    }

    // Backend returns verification_required: true — no tokens issued yet
    if (result.verification_required) {
      const e: any = new Error(result.message || 'Please verify your email before logging in.');
      e.requires_verification = true;
      e.email = result.user?.email;
      throw e;
    }

    // Shouldn't happen for normal registration (tokens require email verification)
    if (result.access_token) {
      localStorage.setItem('token', result.access_token);
      setToken(result.access_token);
      setUser(result.user);
      setOrganization(result.organization);
      setInitialFetchDone(true);
    }
  };

  // V18: Auto-refresh token before expiry using the refresh cookie
  const refreshToken = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',  // Sends refresh_token cookie
      });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        if (data.user) setUser(data.user);
        if (data.organization) setOrganization(data.organization);
        return true;
      }
    } catch {
      // Silent fail — user will be redirected to login if needed
    }
    return false;
  }, []);

  // V18: Schedule token refresh every 50 minutes (token expires in 60)
  useEffect(() => {
    if (!token || !user) return;
    const interval = setInterval(() => {
      refreshToken();
    }, 50 * 60 * 1000); // 50 minutes
    return () => clearInterval(interval);
  }, [token, user, refreshToken]);

  const logout = useCallback(async () => {
    // V18: Clear httpOnly cookies on server
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Continue with local cleanup even if server call fails
    }
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setOrganization(null);
    setInitialFetchDone(false);
  }, []);

  // isAuthenticated: true if we have a token AND (user is loaded OR we're still loading)
  // This prevents redirect to login during initial load
  const isAuthenticated = !!token && (!!user || loading);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
