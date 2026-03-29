import { sendMail } from '../../lib/mailer.js';
import { env } from '../../config/env.js';

// ── Template helper ───────────────────────────────────────────────────────────

function ticketUrl(ticketId: string) {
  return `${env.CLIENT_URL}/tickets/${ticketId}`;
}

function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#18181b;padding:20px 28px">
      <span style="color:#fff;font-size:18px;font-weight:600">IT Helpdesk</span>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 16px;font-size:18px;color:#18181b">${title}</h2>
      ${body}
    </div>
    <div style="padding:16px 28px;background:#f4f4f5;font-size:12px;color:#71717a">
      This is an automated message — please do not reply directly to this email.
    </div>
  </div>
</body>
</html>`;
}

function ticketMeta(ticket: TicketInfo) {
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px">
      <tr><td style="padding:8px 0;color:#71717a;width:120px">Ticket</td><td style="padding:8px 0;font-weight:500">${ticket.ticketNumber}</td></tr>
      <tr><td style="padding:8px 0;color:#71717a">Title</td><td style="padding:8px 0">${ticket.title}</td></tr>
      <tr><td style="padding:8px 0;color:#71717a">Priority</td><td style="padding:8px 0;text-transform:capitalize">${ticket.priority}</td></tr>
      <tr><td style="padding:8px 0;color:#71717a">Status</td><td style="padding:8px 0;text-transform:capitalize">${ticket.status.replace('_', ' ')}</td></tr>
    </table>`;
}

function ctaButton(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;padding:10px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">${label}</a>`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TicketInfo {
  id: string;
  ticketNumber: string;
  title: string;
  priority: string;
  status: string;
}

interface UserInfo {
  displayName: string;
  email?: string;
}

// ── Notification functions ────────────────────────────────────────────────────

export async function notifyTicketCreated(ticket: TicketInfo, submitter: UserInfo) {
  if (!submitter.email) return;

  const html = layout(
    'Your ticket has been received',
    `<p style="color:#3f3f46;font-size:14px;margin:0 0 16px">Hi ${submitter.displayName},</p>
     <p style="color:#3f3f46;font-size:14px;margin:0 0 20px">We've received your support request and it's now in our queue. You'll be notified when it's assigned or updated.</p>
     ${ticketMeta(ticket)}
     ${ctaButton(ticketUrl(ticket.id), 'View Ticket')}`,
  );

  await sendMail(submitter.email, `[${ticket.ticketNumber}] Ticket received: ${ticket.title}`, html);
}

export async function notifyTicketAssigned(ticket: TicketInfo, assignee: UserInfo) {
  if (!assignee.email) return;

  const html = layout(
    'A ticket has been assigned to you',
    `<p style="color:#3f3f46;font-size:14px;margin:0 0 16px">Hi ${assignee.displayName},</p>
     <p style="color:#3f3f46;font-size:14px;margin:0 0 20px">The following ticket has been assigned to you.</p>
     ${ticketMeta(ticket)}
     ${ctaButton(ticketUrl(ticket.id), 'View Ticket')}`,
  );

  await sendMail(assignee.email, `[${ticket.ticketNumber}] Assigned to you: ${ticket.title}`, html);
}

export async function notifyStatusChanged(ticket: TicketInfo, submitter: UserInfo, newStatus: string) {
  if (!submitter.email) return;

  const label = newStatus.replace('_', ' ');
  const messages: Record<string, string> = {
    in_progress: 'Your ticket is now being worked on.',
    pending: 'Your ticket is pending — we may need more information from you.',
    resolved: 'Your ticket has been resolved. Please let us know if you need anything else.',
    closed: 'Your ticket has been closed.',
  };
  const message = messages[newStatus] ?? `Your ticket status has changed to <strong>${label}</strong>.`;

  const html = layout(
    `Ticket status updated: ${label}`,
    `<p style="color:#3f3f46;font-size:14px;margin:0 0 16px">Hi ${submitter.displayName},</p>
     <p style="color:#3f3f46;font-size:14px;margin:0 0 20px">${message}</p>
     ${ticketMeta({ ...ticket, status: newStatus })}
     ${ctaButton(ticketUrl(ticket.id), 'View Ticket')}`,
  );

  await sendMail(submitter.email, `[${ticket.ticketNumber}] Status updated: ${label}`, html);
}

export async function notifyCommentAdded(
  ticket: TicketInfo,
  commenter: UserInfo,
  commentBody: string,
  isInternal: boolean,
  submitter: UserInfo,
  assignee: UserInfo | null,
) {
  const preview = commentBody.length > 200 ? commentBody.slice(0, 200) + '…' : commentBody;
  const commentBlock = `
    <div style="background:#f4f4f5;border-left:3px solid #18181b;padding:12px 16px;margin-bottom:20px;border-radius:0 4px 4px 0;font-size:14px;color:#3f3f46">
      ${preview}
    </div>`;

  // Notify submitter if comment is public and they didn't write it
  if (!isInternal && submitter.email && submitter.displayName !== commenter.displayName) {
    const html = layout(
      'New reply on your ticket',
      `<p style="color:#3f3f46;font-size:14px;margin:0 0 16px">Hi ${submitter.displayName},</p>
       <p style="color:#3f3f46;font-size:14px;margin:0 0 12px"><strong>${commenter.displayName}</strong> replied on ticket ${ticket.ticketNumber}:</p>
       ${commentBlock}
       ${ctaButton(ticketUrl(ticket.id), 'View Ticket')}`,
    );
    await sendMail(submitter.email, `[${ticket.ticketNumber}] New reply: ${ticket.title}`, html);
  }

  // Notify assignee for all comments (public or internal), unless they wrote it
  if (assignee?.email && assignee.displayName !== commenter.displayName) {
    const noteLabel = isInternal ? 'internal note' : 'reply';
    const html = layout(
      `New ${noteLabel} on assigned ticket`,
      `<p style="color:#3f3f46;font-size:14px;margin:0 0 16px">Hi ${assignee.displayName},</p>
       <p style="color:#3f3f46;font-size:14px;margin:0 0 12px"><strong>${commenter.displayName}</strong> added a ${noteLabel} on ${ticket.ticketNumber}:</p>
       ${commentBlock}
       ${ctaButton(ticketUrl(ticket.id), 'View Ticket')}`,
    );
    await sendMail(assignee.email, `[${ticket.ticketNumber}] New ${noteLabel}: ${ticket.title}`, html);
  }
}
