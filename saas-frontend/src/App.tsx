import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// Auth
import { AuthProvider, useAuth } from './hooks/useAuth';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import ToolsCatalogPage from './pages/ToolsCatalogPage';
import ToolDetailPage from './pages/ToolDetailPage';

// Styles
import './index.css';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-cyan-400">Loading...</div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// Public Route - Redirect to dashboard if authenticated
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-cyan-400">Loading...</div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

/**
 * 🐉 CyberSec Pro SaaS Application
 * World-class cybersecurity testing platform
 */
function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Tools Routes - Public (like kali.org/tools) */}
      <Route path="/tools" element={<ToolsCatalogPage />} />
      <Route path="/tools/:slug" element={<ToolDetailPage />} />
      
      {/* Auth Routes */}
      <Route path="/login" element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute>
          <RegisterPage />
        </PublicRoute>
      } />
      
      {/* Protected Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      } />
      
      {/* 404 - Redirect to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <HelmetProvider>
      <Router>
        <AuthProvider>
          <div className="min-h-screen cyberpunk-theme">
            <AppRoutes />
          </div>
        </AuthProvider>
      </Router>
    </HelmetProvider>
  );
}

export default App;