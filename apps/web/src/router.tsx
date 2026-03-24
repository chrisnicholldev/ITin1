import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { TicketsPage } from '@/pages/tickets/TicketsPage';
import { TicketDetailPage } from '@/pages/tickets/TicketDetailPage';
import { CreateTicketPage } from '@/pages/tickets/CreateTicketPage';
import { AssetsPage } from '@/pages/assets/AssetsPage';
import { CreateAssetPage } from '@/pages/assets/CreateAssetPage';
import { AssetDetailPage } from '@/pages/assets/AssetDetailPage';
import { VaultPage } from '@/pages/vault/VaultPage';

export const router = createBrowserRouter(
  [
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
        { path: 'assets/new', element: <CreateAssetPage /> },
        { path: 'assets/:id', element: <AssetDetailPage /> },
        { path: 'vault', element: <VaultPage /> },
        { path: 'admin/users', element: <div className="p-4 text-muted-foreground">User management — coming soon</div> },
        { path: 'admin/settings', element: <div className="p-4 text-muted-foreground">Settings — coming soon</div> },
      ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  { future: { v7_startTransition: true } as any },
);
