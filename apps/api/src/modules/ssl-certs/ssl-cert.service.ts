import tls from 'tls';
import { SslCert, type ISslCertDocument } from './ssl-cert.model.js';
import { AppError } from '../../middleware/error.middleware.js';

// ── TLS fetch ─────────────────────────────────────────────────────────────────

interface CertInfo {
  commonName: string;
  issuer: string;
  issuedAt: Date;
  expiresAt: Date;
  sans: string[];
}

function fetchCertInfo(domain: string, port: number): Promise<CertInfo> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: domain, port, servername: domain, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate(true);
        socket.destroy();
        if (!cert || !cert.subject) {
          reject(new Error('No certificate returned'));
          return;
        }
        const sans = cert.subjectaltname
          ? cert.subjectaltname
              .split(', ')
              .filter((s) => s.startsWith('DNS:'))
              .map((s) => s.replace('DNS:', '').trim())
          : [];
        resolve({
          commonName: (Array.isArray(cert.subject.CN) ? cert.subject.CN[0] : cert.subject.CN) ?? domain,
          issuer: (cert.issuer as any).O ?? (cert.issuer as any).CN ?? '',
          issuedAt:  new Date(cert.valid_from),
          expiresAt: new Date(cert.valid_to),
          sans,
        });
      },
    );
    socket.on('error', reject);
    socket.setTimeout(10_000, () => {
      socket.destroy();
      reject(new Error('Connection timed out'));
    });
  });
}

// ── Status derivation ─────────────────────────────────────────────────────────

function deriveStatus(expiresAt: Date | undefined): ISslCertDocument['status'] {
  if (!expiresAt) return 'unknown';
  const days = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 0)  return 'expired';
  if (days <= 30) return 'expiring_soon';
  return 'valid';
}

// ── Response shape ─────────────────────────────────────────────────────────────

function toResponse(cert: ISslCertDocument) {
  return {
    id:            cert.id as string,
    domain:        cert.domain,
    port:          cert.port,
    commonName:    cert.commonName,
    issuer:        cert.issuer,
    issuedAt:      cert.issuedAt,
    expiresAt:     cert.expiresAt,
    sans:          cert.sans,
    notes:         cert.notes,
    status:        cert.status,
    checkError:    cert.checkError,
    lastCheckedAt: cert.lastCheckedAt,
    createdAt:     cert.createdAt,
    updatedAt:     cert.updatedAt,
  };
}

// ── Service methods ───────────────────────────────────────────────────────────

export async function listCerts() {
  const certs = await SslCert.find().sort({ expiresAt: 1 });
  return certs.map(toResponse);
}

export async function getCert(id: string) {
  const cert = await SslCert.findById(id);
  if (!cert) throw new AppError(404, 'SSL certificate not found');
  return toResponse(cert);
}

export async function createCert(input: { domain: string; port?: number; notes?: string }) {
  const cert = await SslCert.create({
    domain: input.domain.trim().toLowerCase(),
    port:   input.port ?? 443,
    notes:  input.notes,
    status: 'unknown',
  });

  // Auto-fetch cert info after creation — fire and forget (don't fail creation)
  checkAndUpdate(cert._id.toString()).catch(() => {});

  return toResponse(cert);
}

export async function updateCert(id: string, input: { domain?: string; port?: number; notes?: string }) {
  const cert = await SslCert.findByIdAndUpdate(
    id,
    { $set: { ...(input.domain && { domain: input.domain.trim().toLowerCase() }), ...(input.port && { port: input.port }), notes: input.notes ?? '' } },
    { new: true, runValidators: true },
  );
  if (!cert) throw new AppError(404, 'SSL certificate not found');
  return toResponse(cert);
}

export async function deleteCert(id: string) {
  const cert = await SslCert.findByIdAndDelete(id);
  if (!cert) throw new AppError(404, 'SSL certificate not found');
}

export async function checkAndUpdate(id: string) {
  const cert = await SslCert.findById(id);
  if (!cert) throw new AppError(404, 'SSL certificate not found');

  try {
    const info = await fetchCertInfo(cert.domain, cert.port);
    cert.commonName    = info.commonName;
    cert.issuer        = info.issuer;
    cert.issuedAt      = info.issuedAt;
    cert.expiresAt     = info.expiresAt;
    cert.sans          = info.sans;
    cert.status        = deriveStatus(info.expiresAt);
    cert.checkError    = undefined;
    cert.lastCheckedAt = new Date();
  } catch (err: any) {
    cert.status        = 'error';
    cert.checkError    = err?.message ?? 'Unknown error';
    cert.lastCheckedAt = new Date();
  }

  await cert.save();
  return toResponse(cert);
}

// Called by the daily cron — refreshes all certs
export async function refreshAllCerts() {
  const certs = await SslCert.find();
  let checked = 0;
  let errors  = 0;
  for (const cert of certs) {
    try {
      await checkAndUpdate(cert._id.toString());
      checked++;
    } catch {
      errors++;
    }
  }
  return { checked, errors };
}
