import { Ticket } from '../tickets/ticket.model.js';
import { Asset } from '../assets/asset.model.js';
import { Credential } from '../vault/vault.model.js';
import { Network } from '../network/network.model.js';
import { Rack } from '../network/rack.model.js';
import { Article } from '../docs/article.model.js';
import { User } from '../users/user.model.js';
import { SyncLog } from '../integrations/intune/intune.service.js';
import { env } from '../../config/env.js';
import { UserRole } from '@itdesk/shared';

export async function getDashboardStats(role: string) {
  const isAdmin = role === UserRole.IT_ADMIN || role === UserRole.SUPER_ADMIN;
  const isTech = role !== UserRole.END_USER;

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    openTickets,
    inProgressTickets,
    resolvedThisWeek,
    openByPriority,
    activeAssets,
    inRepairAssets,
    warrantyExpiringSoon,
    assetsByType,
    vaultTotal,
    networksTotal,
    racksTotal,
    articlesTotal,
    usersTotal,
    lastIntuneSync,
    lastMerakiSync,
  ] = await Promise.all([
    Ticket.countDocuments({ status: 'open' }),
    Ticket.countDocuments({ status: 'in_progress' }),
    Ticket.countDocuments({ status: { $in: ['resolved', 'closed'] }, resolvedAt: { $gte: sevenDaysAgo } }),
    Ticket.aggregate([
      { $match: { status: 'open' } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    isTech ? Asset.countDocuments({ status: 'active' }) : Promise.resolve(0),
    isTech ? Asset.countDocuments({ status: 'in_repair' }) : Promise.resolve(0),
    isTech
      ? Asset.countDocuments({ warrantyExpiry: { $gte: now, $lte: thirtyDaysFromNow } })
      : Promise.resolve(0),
    isTech
      ? Asset.aggregate([
          { $match: { status: { $nin: ['decommissioned'] } } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
    isTech ? Credential.countDocuments() : Promise.resolve(0),
    isTech ? Network.countDocuments() : Promise.resolve(0),
    isTech ? Rack.countDocuments() : Promise.resolve(0),
    isTech ? Article.countDocuments() : Promise.resolve(0),
    isAdmin ? User.countDocuments({ isActive: true }) : Promise.resolve(0),
    isAdmin ? SyncLog.findOne({ source: 'intune' }).sort({ startedAt: -1 }).lean() : Promise.resolve(null),
    isAdmin ? SyncLog.findOne({ source: 'meraki' }).sort({ startedAt: -1 }).lean() : Promise.resolve(null),
  ]);

  return {
    tickets: {
      open: openTickets,
      inProgress: inProgressTickets,
      resolvedThisWeek,
      byPriority: openByPriority as Array<{ _id: string; count: number }>,
    },
    ...(isTech && {
      assets: {
        active: activeAssets as number,
        inRepair: inRepairAssets as number,
        warrantyExpiringSoon: warrantyExpiringSoon as number,
        byType: assetsByType as Array<{ _id: string; count: number }>,
      },
      vault: { total: vaultTotal as number },
      networks: { total: networksTotal as number },
      racks: { total: racksTotal as number },
      articles: { total: articlesTotal as number },
    }),
    ...(isAdmin && {
      users: { total: usersTotal as number },
      integrations: {
        intune: {
          enabled: env.INTUNE_ENABLED,
          lastSyncAt: (lastIntuneSync as any)?.completedAt ?? null,
          lastSyncStatus: (lastIntuneSync as any)?.status ?? null,
        },
        meraki: {
          enabled: env.MERAKI_ENABLED,
          lastSyncAt: (lastMerakiSync as any)?.completedAt ?? null,
          lastSyncStatus: (lastMerakiSync as any)?.status ?? null,
        },
      },
    }),
  };
}
