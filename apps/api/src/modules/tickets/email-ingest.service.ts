import { ImapFlow } from 'imapflow';
import { getImapRuntimeConfig } from '../admin/integration-config.service.js';
import { Ticket } from './ticket.model.js';
import { User } from '../users/user.model.js';
import { createTicket, addComment } from './ticket.service.js';
import { TicketSource } from '@itdesk/shared';

const TICKET_REF_RE = /\[TKT-(\d{1,8})\]/i;
const SUBJECT_MAX = 200;
const BODY_MAX = 10000;

function extractTextBody(source: Buffer): string {
  const raw = source.toString('utf-8');
  const bodyStart = raw.indexOf('\r\n\r\n');
  const body = bodyStart >= 0 ? raw.slice(bodyStart + 4) : raw;
  // Strip MIME boundaries / headers from multipart messages (best-effort)
  return body.replace(/--[^\r\n]+[\s\S]*?Content-[^\r\n]+\r\n(?:[^\r\n]+\r\n)*\r\n/gi, '').trim();
}

async function findSystemUser(): Promise<string | null> {
  const admin = await User.findOne({ role: { $in: ['super_admin', 'it_admin'] } })
    .select('_id')
    .sort({ createdAt: 1 })
    .lean();
  return admin ? String(admin._id) : null;
}

export async function pollMailbox(): Promise<void> {
  const cfg = await getImapRuntimeConfig();

  if (!cfg.enabled || !cfg.host || !cfg.user || !cfg.pass) {
    return;
  }

  if (!cfg.defaultCategoryId) {
    console.warn('[email-ingest] No defaultCategoryId configured — skipping poll');
    return;
  }

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 993,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });

  await client.connect();

  const lock = await client.getMailboxLock(cfg.folder);
  try {
    const messages: Array<{ uid: number; envelope: any; source: Buffer }> = [];

    for await (const msg of client.fetch({ seen: false }, { envelope: true, source: true })) {
      if (msg.source) {
        messages.push({ uid: msg.uid, envelope: msg.envelope, source: msg.source });
      }
    }

    for (const msg of messages) {
      try {
        await processEmail(msg.envelope, msg.source, cfg.defaultCategoryId!);
        await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
      } catch (err) {
        console.error('[email-ingest] Failed to process message uid=%d:', msg.uid, (err as Error).message);
      }
    }
  } finally {
    lock.release();
  }

  await client.logout();
}

async function processEmail(
  envelope: { subject?: string; from?: Array<{ address?: string }>; messageId?: string },
  source: Buffer,
  defaultCategoryId: string,
): Promise<void> {
  const subject = (envelope.subject ?? '(no subject)').trim();
  const senderEmail = envelope.from?.[0]?.address?.toLowerCase() ?? '';
  const bodyText = extractTextBody(source).slice(0, BODY_MAX);

  // Check if this is a reply to an existing ticket
  const refMatch = TICKET_REF_RE.exec(subject);
  if (refMatch) {
    const ticketNumber = Number(refMatch[1]);
    const ticket = await Ticket.findOne({ ticketNumber }).select('_id').lean();
    if (ticket) {
      const sender = senderEmail ? await User.findOne({ email: senderEmail }).select('_id role').lean() : null;
      const systemUserId = sender ? String(sender._id) : await findSystemUser();
      if (!systemUserId) return;

      const commentBody = bodyText || '(email with no text body)';
      await addComment(
        String(ticket._id),
        { body: commentBody, isInternal: false },
        systemUserId,
        sender?.role ?? 'it_admin',
      );
      console.log(`[email-ingest] Added comment to TKT-${ticketNumber} from ${senderEmail}`);
      return;
    }
  }

  // New ticket from email
  const sender = senderEmail ? await User.findOne({ email: senderEmail }).select('_id').lean() : null;
  let submittedBy: string | null = sender ? String(sender._id) : null;
  let description = bodyText || '(email with no text body)';

  if (!submittedBy) {
    submittedBy = await findSystemUser();
    if (!submittedBy) {
      console.warn(`[email-ingest] No system user found — cannot create ticket for: ${senderEmail}`);
      return;
    }
    description = `**From:** ${senderEmail}\n\n${description}`;
  }

  const title = subject.slice(0, SUBJECT_MAX) || '(no subject)';

  await createTicket(
    {
      title,
      description,
      priority: 'medium',
      category: defaultCategoryId,
      relatedAssets: [],
      tags: [],
      source: TicketSource.EMAIL,
    } as any,
    submittedBy,
  );

  console.log(`[email-ingest] Created ticket from email: ${senderEmail} — "${title}"`);
}
