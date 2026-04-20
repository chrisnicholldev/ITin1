import { TicketHistory, type TicketHistoryAction, type ITicketHistoryChange } from './ticket-history.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import { Ticket } from './ticket.model.js';

export function recordHistory(
  ticketId: string,
  actorId: string,
  action: TicketHistoryAction,
  changes: ITicketHistoryChange[] = [],
): void {
  TicketHistory.create({
    ticket: ticketId,
    actor: actorId,
    action,
    changes,
  }).catch(() => {});
}

export async function getTicketHistory(id: string, viewerRole: string, viewerId: string) {
  const ticket = await Ticket.findById(id).select('submittedBy').lean();
  if (!ticket) throw new AppError(404, 'Ticket not found');

  if (viewerRole === 'end_user' && ticket.submittedBy.toString() !== viewerId) {
    throw new AppError(403, 'Access denied');
  }

  return TicketHistory.find({ ticket: id })
    .populate('actor', 'displayName')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
}
