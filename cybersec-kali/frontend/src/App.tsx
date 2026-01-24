import { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  Home, Shield, Scan, Download, FileText,
  Menu, ChevronLeft, Server, FolderKanban, Activity, Terminal, Key, ShieldCheck
} from 'lucide-react';

// Lazy load pages
const Dashboard = lazy(() => import('./pages/DashboardPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));
const ScansPage = lazy(() => import('./components/ScansPage'));
const UpdatesPage = lazy(() => import('./pages/UpdatesPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ServersPage = lazy(() => import('./pages/ServersPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'));
const TerminalPage = lazy(() => import('./pages/TerminalPage'));
const LicensePage = lazy(() => import('./pages/LicensePage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));

// Loading component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-dark-bg">
    <div className="text-center">
      <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
      <div className="text-xl gradient-text">Loading...</div>
    </div>
  </div>
);

// Navigation items
const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/tools', label: 'Tools', icon: Shield },
  { path: '/scans', label: 'Scans', icon: Scan },
  { path: '/servers', label: 'Servers', icon: Server },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/monitoring', label: 'Monitoring', icon: Activity },
  { path: '/audit', label: 'Audit Logs', icon: ShieldCheck },
  { path: '/terminal', label: 'Terminal', icon: Terminal },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/updates', label: 'Updates', icon: Download },
  { path: '/license', label: 'License', icon: Key },
];

function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav 
      className="h-screen glass border-r border-dark-border flex flex-col transition-all duration-300"
      style={{ width: collapsed ? 72 : 240 }}
    >
      {/* Logo */}
      <div className="p-4 border-b border-dark-border flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold gradient-text">CyberSec</span>
          </div>
        )}
        
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-dark-bg/50 text-gray-400 hover:text-white transition-all cursor-pointer"
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer ${
                isActive 
                  ? 'bg-gradient-to-r from-primary to-secondary text-dark-bg font-bold' 
                  : 'text-gray-400 hover:bg-dark-bg/50 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-dark-border">
        {!collapsed && (
          <div className="text-xs text-gray-500 text-center">
            <div className="font-semibold text-gray-400">CyberSec Pro v2.0</div>
            <div>© 2026 All Rights Reserved</div>
          </div>
        )}
      </div>
    </nav>
  );
}

function AppContent() {
  return (
    <div className="flex h-screen bg-dark-bg overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/scans" element={<ScansPage />} />
            <Route path="/servers" element={<ServersPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/monitoring" element={<MonitoringPage />} />
            <Route path="/audit" element={<AuditLogsPage />} />
            <Route path="/terminal" element={<TerminalPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/updates" element={<UpdatesPage />} />
            <Route path="/license" element={<LicensePage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
