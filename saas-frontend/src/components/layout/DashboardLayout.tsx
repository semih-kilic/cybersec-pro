import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import CyberPulseBg from '../ui/CyberPulseBg';

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-gray-950 flex">
      <CyberPulseBg />
      <Sidebar />
      <main className="ml-64 flex-1 flex flex-col min-h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;
