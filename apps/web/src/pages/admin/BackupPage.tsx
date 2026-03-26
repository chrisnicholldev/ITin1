import { useState, useRef } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { downloadBackup, uploadRestore } from '@/api/backup';

export function BackupPage() {
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ total: number; collections: Record<string, number> } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    setExportDone(false);
    try {
      await downloadBackup();
      setExportDone(true);
      setTimeout(() => setExportDone(false), 4000);
    } finally {
      setExporting(false);
    }
  }

  async function handleRestore() {
    if (!restoreFile || !confirmed) return;
    setRestoring(true);
    setRestoreResult(null);
    setRestoreError(null);
    try {
      const result = await uploadRestore(restoreFile);
      setRestoreResult(result);
      setRestoreFile(null);
      setConfirmed(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      setRestoreError(err?.response?.data?.message ?? err?.message ?? 'Restore failed');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Backup & Restore</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Export all application data to a JSON file, or restore from a previous backup.
        </p>
      </div>

      {/* Export */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" /> Export Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Downloads a JSON file containing all assets, tickets, users, credentials, vendors, networks, racks,
            locations, docs, and contacts. File uploads (attachments) are not included.
          </p>
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              The backup includes <strong>encrypted vault credentials</strong>. To restore them on another instance,
              that instance must use the same <code className="font-mono text-xs">VAULT_ENCRYPTION_KEY</code>.
            </span>
          </div>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Exporting…</>
              : exportDone
                ? <><CheckCircle2 className="h-4 w-4 text-green-500" /> Downloaded</>
                : <><Download className="h-4 w-4" /> Download Backup</>}
          </Button>
        </CardContent>
      </Card>

      {/* Restore */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Restore from Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a backup file exported from this application. All existing data will be <strong>replaced</strong> — this
            cannot be undone.
          </p>

          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Restoring will <strong>permanently delete all current data</strong> and replace it with the backup contents.
              Ensure you are on the correct instance before proceeding.
            </span>
          </div>

          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              onChange={(e) => {
                setRestoreFile(e.target.files?.[0] ?? null);
                setRestoreResult(null);
                setRestoreError(null);
                setConfirmed(false);
              }}
            />

            {restoreFile && (
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I understand this will replace all existing data with <strong className="ml-1">{restoreFile.name}</strong>
              </label>
            )}

            <Button
              variant="destructive"
              disabled={!restoreFile || !confirmed || restoring}
              onClick={handleRestore}
              className="gap-2"
            >
              {restoring
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Restoring…</>
                : <><Upload className="h-4 w-4" /> Restore Backup</>}
            </Button>
          </div>

          {restoreResult && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Restore complete — {restoreResult.total} records imported
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                {Object.entries(restoreResult.collections)
                  .filter(([, n]) => n > 0)
                  .map(([col, n]) => (
                    <p key={col} className="text-xs text-green-700">
                      {col}: <span className="font-medium">{n}</span>
                    </p>
                  ))}
              </div>
            </div>
          )}

          {restoreError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {restoreError}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
