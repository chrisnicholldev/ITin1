import nodemailer, { type Transporter } from 'nodemailer';
import { getSmtpRuntimeConfig } from '../modules/admin/integration-config.service.js';

let _transport: Transporter | null = null;
let _transportKey = ''; // invalidate cache when config changes

async function getTransport(): Promise<{ transport: Transporter; from: string } | null> {
  const cfg = await getSmtpRuntimeConfig();
  if (!cfg.enabled || !cfg.host) return null;

  const key = `${cfg.host}:${cfg.port}:${cfg.user}`;
  if (!_transport || key !== _transportKey) {
    _transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
    _transportKey = key;
  }

  return { transport: _transport, from: cfg.from || cfg.user || 'noreply@itdesk' };
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const result = await getTransport();
  if (!result) {
    console.warn(`[mailer] SMTP not configured — skipped sending "${subject}" to ${to}`);
    return;
  }

  await result.transport.sendMail({ from: result.from, to, subject, html });
}
