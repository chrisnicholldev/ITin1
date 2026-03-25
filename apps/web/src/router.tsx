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
import { RacksPage } from '@/pages/network/RacksPage';
import { RackDetailPage } from '@/pages/network/RackDetailPage';
import { NetworksPage } from '@/pages/network/NetworksPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { IntegrationsPage } from '@/pages/admin/IntegrationsPage';
import { LocationsPage } from '@/pages/admin/LocationsPage';
import { DocsPage } from '@/pages/docs/DocsPage';
import { ArticlePage } from '@/pages/docs/ArticlePage';
import { ArticleEditorPage } from '@/pages/docs/ArticleEditorPage';

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
        { path: 'network/racks', element: <RacksPage /> },
        { path: 'network/racks/:id', element: <RackDetailPage /> },
        { path: 'network/networks', element: <NetworksPage /> },
        { path: 'docs', element: <DocsPage /> },
        { path: 'docs/articles/new', element: <ArticleEditorPage /> },
        { path: 'docs/articles/:slug', element: <ArticlePage /> },
        { path: 'docs/articles/:slug/edit', element: <ArticleEditorPage /> },
        { path: 'admin/users', element: <UsersPage /> },
        { path: 'admin/integrations', element: <IntegrationsPage /> },
        { path: 'admin/locations', element: <LocationsPage /> },
        { path: 'admin/settings', element: <div className="p-4 text-muted-foreground">Settings — coming soon</div> },
      ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  { future: { v7_startTransition: true } as any },
);
