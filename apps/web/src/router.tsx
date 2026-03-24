import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { TicketsPage } from '@/pages/tickets/TicketsPage';
import { TicketDetailPage } from '@/pages/tickets/TicketDetailPage';
import { CreateTicketPage } from '@/pages/tickets/CreateTicketPage';
import { AssetsPage } from '@/pages/assets/AssetsPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'tickets', element: <TicketsPage /> },
      { path: 'tickets/new', element: <CreateTicketPage /> },
      { path: 'tickets/:id', element: <TicketDetailPage /> },
      { path: 'assets', element: <AssetsPage /> },
      { path: 'assets/new', element: <div className="p-4 text-muted-foreground">Asset create form — coming soon</div> },
      { path: 'assets/:id', element: <div className="p-4 text-muted-foreground">Asset detail — coming soon</div> },
      { path: 'admin/users', element: <div className="p-4 text-muted-foreground">User management — coming soon</div> },
      { path: 'admin/settings', element: <div className="p-4 text-muted-foreground">Settings — coming soon</div> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
