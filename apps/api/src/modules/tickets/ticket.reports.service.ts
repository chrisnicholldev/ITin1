import { Ticket } from './ticket.model.js';
import { TicketStatus } from '@itdesk/shared';

export async function getTicketReports() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const startOfThisMonth = new Date();
  startOfThisMonth.setDate(1);
  startOfThisMonth.setHours(0, 0, 0, 0);

  const [byStatus, mttrResult, byCategory, byTechnician, dailyVolume, resolvedThisMonth] =
    await Promise.all([
      // Count by status
      Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),

      // MTTR in hours (resolved + closed tickets only)
      Ticket.aggregate([
        { $match: { resolvedAt: { $exists: true } } },
        {
          $group: {
            _id: null,
            avgMs: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } },
          },
        },
      ]),

      // Volume by category
      Ticket.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'cat',
          },
        },
        { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
        { $project: { name: { $ifNull: ['$cat.name', 'Unknown'] }, count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      // Volume by technician (assignedTo)
      Ticket.aggregate([
        { $match: { assignedTo: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$assignedTo',
            total: { $sum: 1 },
            resolved: {
              $sum: {
                $cond: [{ $in: ['$status', [TicketStatus.RESOLVED, TicketStatus.CLOSED]] }, 1, 0],
              },
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            name: { $ifNull: ['$user.displayName', 'Unknown'] },
            total: 1,
            resolved: 1,
          },
        },
        { $sort: { total: -1 } },
        { $limit: 20 },
      ]),

      // Daily volume — last 30 days
      Ticket.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Resolved this month
      Ticket.countDocuments({
        status: { $in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        resolvedAt: { $gte: startOfThisMonth },
      }),
    ]);

  const statusMap = Object.fromEntries(byStatus.map((s: { _id: string; count: number }) => [s._id, s.count]));
  const mttrHours = mttrResult[0]?.avgMs ? Math.round(mttrResult[0].avgMs / 3600000 * 10) / 10 : null;

  return {
    byStatus: statusMap,
    mttrHours,
    byCategory: byCategory.map((c: { name: string; count: number }) => ({ name: c.name, count: c.count })),
    byTechnician: byTechnician.map((t: { name: string; total: number; resolved: number }) => ({
      name: t.name,
      total: t.total,
      resolved: t.resolved,
    })),
    dailyVolume: dailyVolume.map((d: { _id: string; count: number }) => ({ date: d._id, count: d.count })),
    resolvedThisMonth,
  };
}
