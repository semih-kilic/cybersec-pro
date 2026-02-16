import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Suspense, lazy, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { OverviewSkeleton } from './components/ui/Skeleton';

// i18n - must be imported before any component that uses translations
import './i18n';

// Auth
import { AuthProvider, useAuth } from './hooks/useAuth';

// Layout
import { Sidebar } from './components/layout/Sidebar';

// Global Context
import { TargetProvider } from './contexts/TargetContext';

// UX: Toast, Color Mode, Keyboard Shortcuts, Command Palette
import { ToastProvider } from './components/ui/Toast';
import { ColorModeProvider } from './contexts/ColorModeContext';
import { CommandPalette } from './components/ui/CommandPalette';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Real-time: WebSocket manager + browser notifications
import { wsManager } from './lib/socketManager';
import { useBrowserNotifications } from './hooks/useBrowserNotifications';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OAuthCallback } from './pages/OAuthCallback';
import { DashboardPage } from './pages/DashboardPage';
import ToolsCatalogPage from './pages/ToolsCatalogPage';
import ToolDetailPagePublic from './pages/ToolDetailPage';

// Dashboard Pages (lazy loaded for performance)
const OverviewPage = lazy(() => import('./pages/dashboard/OverviewPage'));
const ToolsPage = lazy(() => import('./pages/dashboard/ToolsPage'));
const ToolDetailPage = lazy(() => import('./pages/dashboard/ToolDetailPage'));
const ScansPage = lazy(() => import('./pages/dashboard/ScansPage'));
const NewScanPage = lazy(() => import('./pages/dashboard/NewScanPage'));
const ScanExecutionPage = lazy(() => import('./pages/dashboard/ScanExecutionPage'));
const TargetsPage = lazy(() => import('./pages/dashboard/TargetsPage'));
const ReportsPage = lazy(() => import('./pages/dashboard/ReportsPage'));
const SchedulePage = lazy(() => import('./pages/dashboard/SchedulePage'));
const TerminalPage = lazy(() => import('./pages/dashboard/TerminalPage'));
const SettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));
const AgentsPage = lazy(() => import('./pages/dashboard/AgentsPage'));
const ProjectsPage = lazy(() => import('./pages/dashboard/ProjectsPage'));
const UpgradePage = lazy(() => import('./pages/dashboard/UpgradePage'));
const BillingPage = lazy(() => import('./pages/dashboard/BillingPage'));
const FeedbackPage = lazy(() => import('./pages/dashboard/FeedbackPage'));

// Legal/GDPR Pages (lazy loaded)
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const GDPRPage = lazy(() => import('./pages/GDPRPage'));

// GDPR Cookie Consent
import { CookieConsentBanner } from './components/CookieConsent';

// Styles
import './index.css';

// Loading Spinner
function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 border-4 border-kali-blue border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400">Loading...</span>
      </div>
    </div>
  );
}

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

// Dashboard Layout with Sidebar
function DashboardLayout() {
  const { isPaletteOpen, closePalette } = useKeyboardShortcuts();
  const { requestPermission } = useBrowserNotifications();

  // Connect WebSocket once when dashboard mounts
  useEffect(() => {
    wsManager.connect();
    requestPermission();
    return () => { /* keep connection alive across route changes */ };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TargetProvider>
      <div className="flex min-h-screen bg-gray-950">
        <Sidebar />
        <main className="flex-1 ml-64 overflow-auto">
          <Suspense fallback={<OverviewSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
        <CommandPalette isOpen={isPaletteOpen} onClose={closePalette} />
      </div>
    </TargetProvider>
  );
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
      
      {/* Legal & GDPR Routes (under /dashboard/ for nginx SPA routing) */}
      <Route path="/dashboard/privacy" element={<Suspense fallback={<LoadingSpinner />}><PrivacyPolicyPage /></Suspense>} />
      <Route path="/dashboard/terms" element={<Suspense fallback={<LoadingSpinner />}><TermsPage /></Suspense>} />
      <Route path="/dashboard/gdpr" element={<Suspense fallback={<LoadingSpinner />}><GDPRPage /></Suspense>} />
      
      {/* Tools Routes - Public (like kali.org/tools) */}
      <Route path="/tools" element={<ToolsCatalogPage />} />
      <Route path="/tools/:slug" element={<ToolDetailPagePublic />} />
      
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
      <Route path="/auth/callback" element={<OAuthCallback />} />
      
      {/* Protected Dashboard Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<OverviewPage />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="tools/:toolId" element={<ToolDetailPage />} />
        <Route path="tools/:toolId/run" element={<ScanExecutionPage />} />
        <Route path="scans" element={<ScansPage />} />
        <Route path="scans/new" element={<NewScanPage />} />
        <Route path="scans/:scanId" element={<ScanExecutionPage />} />
        <Route path="targets" element={<TargetsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="terminal" element={<TerminalPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectsPage />} />
        <Route path="upgrade" element={<UpgradePage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
      </Route>
      
      {/* Legacy dashboard route for backwards compatibility */}
      <Route path="/dashboard-old" element={
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
      <QueryClientProvider client={queryClient}>
        <ColorModeProvider>
          <ToastProvider>
            <Router>
              <AuthProvider>
                <div className="min-h-screen cyberpunk-theme">
                  <AppRoutes />
                  <CookieConsentBanner />
                </div>
              </AuthProvider>
            </Router>
          </ToastProvider>
        </ColorModeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;