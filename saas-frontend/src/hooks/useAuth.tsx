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
  login: (email: string, password: string) => Promise<void>;
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

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
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
    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    setOrganization(data.organization);
    setInitialFetchDone(true);
  };

  const register = async (data: RegisterData) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const result = await response.json();
    localStorage.setItem('token', result.access_token);
    setToken(result.access_token);
    setUser(result.user);
    setOrganization(result.organization);
    setInitialFetchDone(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setOrganization(null);
    setInitialFetchDone(false);
  };

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
