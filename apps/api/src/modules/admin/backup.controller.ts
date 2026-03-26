import type { Request, Response } from 'express';
import { exportBackup, importBackup, type BackupManifest } from './backup.service.js';

export async function downloadBackup(req: Request, res: Response) {
  const backup = await exportBackup();
  const json = JSON.stringify(backup, null, 2);
  const filename = `itdesk-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(json);
}

export async function uploadRestore(req: Request, res: Response) {
  const manifest = req.body as BackupManifest;
  const counts = await importBackup(manifest);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  res.json({ success: true, total, collections: counts });
}
