import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Suspense, lazy, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient, setGlobalToastError } from './lib/queryClient';
import { OverviewSkeleton } from './components/ui/Skeleton';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Breadcrumb } from './components/ui/Breadcrumb';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { ScrollToTop } from './components/ui/ScrollToTop';

// i18n - must be imported before any component that uses translations
import './i18n';

// Auth
import { AuthProvider, useAuth } from './hooks/useAuth';

// Layout (legacy Sidebar still available for incremental rollback if needed)
// import { Sidebar } from './components/layout/Sidebar';

// 🪟 Vision OS Shell + nav icons
import { VosAppShell, type VosNavItem } from './components/vos';
import {
  LayoutGrid, Wrench, Activity, Crosshair, FileText, Calendar,
  FolderKanban, Server, BarChart3, Sparkles, Swords, Terminal as TerminalIcn,
  ShieldCheck, Bug, Newspaper, GraduationCap, FileCheck2, Users,
  BrainCircuit, FileStack, MessageCircle, BookOpen,
  Crown, ShieldAlert, Wand2, Zap,
} from 'lucide-react';

// Global Context
import { TargetProvider } from './contexts/TargetContext';

// UX: Toast, Color Mode, Keyboard Shortcuts, Command Palette
import { ToastProvider, useToast } from './components/ui/Toast';
import { ColorModeProvider } from './contexts/ColorModeContext';
import { CommandPalette } from './components/ui/CommandPalette';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ShortcutsHelp } from './components/ui/ShortcutsHelp';

// Real-time: WebSocket manager + browser notifications
import { wsManager } from './lib/socketManager';
import { useBrowserNotifications } from './hooks/useBrowserNotifications';

// Pages — lazy loaded for optimal code splitting
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ToolsCatalogPage = lazy(() => import('./pages/ToolsCatalogPage'));
const ToolDetailPagePublic = lazy(() => import('./pages/ToolDetailPage'));

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
const AnalyticsPage = lazy(() => import('./pages/dashboard/AnalyticsPage'));
const AIAssistantPage = lazy(() => import('./pages/dashboard/AIAssistantPage'));
const PurpleTeamPage = lazy(() => import('./pages/dashboard/PurpleTeamPage'));
const AdminPage = lazy(() => import('./pages/dashboard/AdminPage'));
const ServiceManagerPage = lazy(() => import('./pages/dashboard/ServiceManagerPage'));
const GodModePage = lazy(() => import('./pages/dashboard/GodModePage'));
const ThreatIntelPage = lazy(() => import('./pages/dashboard/ThreatIntelPage'));
const VulnerabilityDBPage = lazy(() => import('./pages/dashboard/VulnerabilityDBPage'));
const SecurityNewsPage = lazy(() => import('./pages/dashboard/SecurityNewsPage'));
const LearningCenterPage = lazy(() => import('./pages/dashboard/LearningCenterPage'));
const ComplianceDashboardPage = lazy(() => import('./pages/dashboard/ComplianceDashboardPage'));
const CommunityPage = lazy(() => import('./pages/dashboard/CommunityPage'));
const CyberSecAIPage = lazy(() => import('./pages/dashboard/CyberSecAIPage'));
const ScanTemplatesPage = lazy(() => import('./pages/dashboard/ScanTemplatesPage'));

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
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-10 h-10 border-4 border-cyan-500/30 rounded-full" />
          <div className="absolute inset-0 w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <span className="text-gray-500 text-sm">Loading...</span>
      </div>
    </div>
  );
}

/** Route-level error boundary fallback for individual page crashes */
function RouteErrorFallback({ error }: { error?: Error | null }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9.303 3.376c-.866 1.5.217 3.374 1.948 3.374H4.752c1.73 0 2.814-1.874 1.948-3.374L12.949 3.378c-.866-1.5-3.032-1.5-3.898 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Page failed to load</h2>
        <p className="text-sm text-gray-400 mb-5">Something went wrong loading this page.</p>
        {error && (
          <p className="text-xs text-red-400/70 mb-4 font-mono break-all">{error.message}</p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => window.location.reload()} className="px-4 py-2 text-sm rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition">
            Reload
          </button>
          <a href="/dashboard" className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition border border-gray-700">
            Go to Dashboard
          </a>
        </div>
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
    return <Navigate to="/dashboard/login" replace />;
  }
  
  return <>{children}</>;
}

// Superadmin-only Route
function SuperadminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="text-cyan-400">Loading...</div></div>;
  }
  
  if (!isAuthenticated || user?.role !== 'superadmin') {
    return <Navigate to="/dashboard" replace />;
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

// Dashboard Layout — V20: Apple-grade Vision OS shell
const DASHBOARD_NAV: VosNavItem[] = [
  // ── Workspace ─────────────────────────────────────────────────────
  { label: 'Dashboard',       to: '/dashboard',                  icon: LayoutGrid,    section: 'Workspace' },
  { label: 'Tools',           to: '/dashboard/tools',            icon: Wrench },
  { label: 'Scans',           to: '/dashboard/scans',            icon: Activity },
  { label: 'Targets',         to: '/dashboard/targets',          icon: Crosshair },
  { label: 'Reports',         to: '/dashboard/reports',          icon: FileText },
  { label: 'Schedule',        to: '/dashboard/schedule',         icon: Calendar },
  // ── Operations ────────────────────────────────────────────────────
  { label: 'Projects',        to: '/dashboard/projects',         icon: FolderKanban,  section: 'Operations' },
  { label: 'Agents',          to: '/dashboard/agents',           icon: Server },
  { label: 'Analytics',       to: '/dashboard/analytics',        icon: BarChart3 },
  // ── Intelligence ──────────────────────────────────────────────────
  { label: 'AI Assistant',    to: '/dashboard/ai',               icon: Sparkles,      section: 'Intelligence' },
  { label: 'CyberSec AI',     to: '/dashboard/cybersec-ai',      icon: BrainCircuit },
  { label: 'Purple Team',     to: '/dashboard/purple-team',      icon: Swords },
  { label: 'Terminal',        to: '/dashboard/terminal',         icon: TerminalIcn },
  // ── Knowledge ─────────────────────────────────────────────────────
  { label: 'Threat Intel',    to: '/dashboard/threat-intel',     icon: ShieldCheck,   section: 'Knowledge' },
  { label: 'Vulnerabilities', to: '/dashboard/vulnerabilities',  icon: Bug },
  { label: 'Security News',   to: '/dashboard/news',             icon: Newspaper },
  { label: 'Learning',        to: '/dashboard/learning',         icon: GraduationCap },
  { label: 'Compliance',      to: '/dashboard/compliance',       icon: FileCheck2 },
  { label: 'Community',       to: '/dashboard/community',        icon: Users },
  { label: 'Scan Templates',  to: '/dashboard/scan-templates',   icon: FileStack },
  // ── Account ───────────────────────────────────────────────────────
  { label: 'Upgrade Plan',    to: '/dashboard/upgrade',          icon: Zap,           section: 'Account', cta: true },
  // ── System (admin / superadmin only) ──────────────────────────────
  { label: 'Admin',           to: '/dashboard/admin',            icon: Crown,         section: 'System',
    roles: ['admin', 'superadmin'] },
  { label: 'Service Manager', to: '/dashboard/service-manager',  icon: ShieldAlert,
    roles: ['superadmin'] },
  { label: 'God Mode',        to: '/dashboard/god-mode',         icon: Wand2,
    roles: ['superadmin'] },
];

const DASHBOARD_BOTTOM_NAV: VosNavItem[] = [
  { label: 'Feedback',      to: '/dashboard/feedback', icon: MessageCircle },
  { label: 'Documentation', to: '/docs.html',          icon: BookOpen, external: true },
];

function DashboardLayout() {
  const { user, logout } = useAuth();
  const { isPaletteOpen, openPalette, closePalette, showShortcutsHelp, setShowShortcutsHelp } = useKeyboardShortcuts();
  const { requestPermission } = useBrowserNotifications();
  const location = useLocation();

  // Connect WebSocket once when dashboard mounts
  useEffect(() => {
    wsManager.connect();
    requestPermission();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Google Analytics — track SPA route changes
  useEffect(() => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: location.pathname + location.search,
        page_title: document.title,
      });
    }
  }, [location.pathname, location.search]);

  const displayName = user
    ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email
    : undefined;

  return (
    <TargetProvider>
      <ScrollToTop />
      <a href="#main-content" className="skip-to-content">Skip to main content</a>

      <VosAppShell
        nav={DASHBOARD_NAV}
        bottomNav={DASHBOARD_BOTTOM_NAV}
        brand="CyberSec Pro"
        user={{
          name: displayName,
          email: user?.email,
          avatarUrl: user?.avatar_url,
          role: user?.role,
          plan: (user as any)?.plan_type ?? (user as any)?.plan,
        }}
        onSearch={openPalette}
        onLogout={logout}
        onShortcuts={() => setShowShortcutsHelp(true)}
      >
        <OfflineBanner />
        <div id="main-content" role="main" aria-label="Dashboard content">
          <Suspense fallback={<OverviewSkeleton />}>
            <ErrorBoundary key={location.pathname} fallback={<RouteErrorFallback />}>
              <Breadcrumb />
              <Outlet />
            </ErrorBoundary>
          </Suspense>
        </div>
      </VosAppShell>

      <CommandPalette isOpen={isPaletteOpen} onClose={closePalette} />
      <ShortcutsHelp isOpen={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />
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
      <Route path="/" element={<Navigate to="/dashboard/login" replace />} />
      
      {/* Legal & GDPR Routes (under /dashboard/ for nginx SPA routing) */}
      <Route path="/dashboard/privacy" element={<Suspense fallback={<LoadingSpinner />}><PrivacyPolicyPage /></Suspense>} />
      <Route path="/dashboard/terms" element={<Suspense fallback={<LoadingSpinner />}><TermsPage /></Suspense>} />
      <Route path="/dashboard/gdpr" element={<Suspense fallback={<LoadingSpinner />}><GDPRPage /></Suspense>} />
      
      {/* Tools Routes - Public (like kali.org/tools) */}
      <Route path="/tools" element={<Suspense fallback={<LoadingSpinner />}><ToolsCatalogPage /></Suspense>} />
      <Route path="/tools/:slug" element={<Suspense fallback={<LoadingSpinner />}><ToolDetailPagePublic /></Suspense>} />
      
      {/* Auth Routes */}
      <Route path="/login" element={
        <PublicRoute>
          <Suspense fallback={<LoadingSpinner />}><LoginPage /></Suspense>
        </PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute>
          <Suspense fallback={<LoadingSpinner />}><RegisterPage /></Suspense>
        </PublicRoute>
      } />
      <Route path="/auth/callback" element={<Suspense fallback={<LoadingSpinner />}><OAuthCallback /></Suspense>} />
      <Route path="/verify-email" element={<Suspense fallback={<LoadingSpinner />}><VerifyEmailPage /></Suspense>} />
      <Route path="/forgot-password" element={
        <PublicRoute>
          <Suspense fallback={<LoadingSpinner />}><ForgotPasswordPage /></Suspense>
        </PublicRoute>
      } />
      <Route path="/reset-password" element={
        <PublicRoute>
          <Suspense fallback={<LoadingSpinner />}><ResetPasswordPage /></Suspense>
        </PublicRoute>
      } />

      {/* Auth Routes - /dashboard/ prefixed (nginx serves SPA at /dashboard/) */}
      <Route path="/dashboard/login" element={
        <PublicRoute>
          <Suspense fallback={<LoadingSpinner />}><LoginPage /></Suspense>
        </PublicRoute>
      } />
      <Route path="/dashboard/register" element={
        <PublicRoute>
          <Suspense fallback={<LoadingSpinner />}><RegisterPage /></Suspense>
        </PublicRoute>
      } />
      <Route path="/dashboard/forgot-password" element={
        <PublicRoute>
          <Suspense fallback={<LoadingSpinner />}><ForgotPasswordPage /></Suspense>
        </PublicRoute>
      } />
      <Route path="/dashboard/reset-password" element={
        <PublicRoute>
          <Suspense fallback={<LoadingSpinner />}><ResetPasswordPage /></Suspense>
        </PublicRoute>
      } />
      <Route path="/dashboard/verify-email" element={<Suspense fallback={<LoadingSpinner />}><VerifyEmailPage /></Suspense>} />
      <Route path="/dashboard/auth/callback" element={<Suspense fallback={<LoadingSpinner />}><OAuthCallback /></Suspense>} />
      
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
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="ai" element={<AIAssistantPage />} />
        <Route path="purple-team" element={<PurpleTeamPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="service-manager" element={<SuperadminRoute><ServiceManagerPage /></SuperadminRoute>} />
        <Route path="god-mode" element={<SuperadminRoute><GodModePage /></SuperadminRoute>} />
        <Route path="threat-intel" element={<ThreatIntelPage />} />
        <Route path="vulnerabilities" element={<VulnerabilityDBPage />} />
        <Route path="news" element={<SecurityNewsPage />} />
        <Route path="learning" element={<LearningCenterPage />} />
        <Route path="compliance" element={<ComplianceDashboardPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="cybersec-ai" element={<CyberSecAIPage />} />
        <Route path="strix" element={<CyberSecAIPage />} />
        <Route path="scan-templates" element={<ScanTemplatesPage />} />
      </Route>
      
      {/* Legacy dashboard route for backwards compatibility */}
      <Route path="/dashboard-old" element={
        <ProtectedRoute>
          <Suspense fallback={<LoadingSpinner />}><DashboardPage /></Suspense>
        </ProtectedRoute>
      } />
      
      {/* 404 - Redirect to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Bridges React Query global errors → Toast notifications */
function QueryErrorBridge() {
  const toast = useToast();
  useEffect(() => {
    setGlobalToastError(toast.error);
    return () => setGlobalToastError(null);
  }, [toast.error]);
  return null;
}

// Handle stale chunk errors globally (Vite dynamic imports after redeployment)
window.addEventListener('vite:preloadError', () => {
  const reloadKey = 'cybersec_chunk_reload';
  const lastReload = sessionStorage.getItem(reloadKey);
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 30000) {
    sessionStorage.setItem(reloadKey, String(now));
    window.location.reload();
  }
});

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ColorModeProvider>
          <ToastProvider>
            <QueryErrorBridge />
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