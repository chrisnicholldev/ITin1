import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

let _transport: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!env.SMTP_ENABLED || !env.SMTP_HOST) return null;

  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: (env.SMTP_PORT ?? 587) === 465,
      auth: env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    });
  }

  return _transport;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const transport = getTransport();
  if (!transport) return; // SMTP not configured — silently skip

  await transport.sendMail({
    from: env.SMTP_FROM ?? env.SMTP_USER ?? 'noreply@itdesk',
    to,
    subject,
    html,
  });
}
