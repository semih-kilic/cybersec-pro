// Dashboard component - redirects to DashboardPage
import { Navigate } from 'react-router-dom';

export default function Dashboard() {
  return <Navigate to="/" replace />;
}
