import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { importCredentials } from '@/api/vault';
import { CredentialCategory, VaultAccessLevel } from '@itdesk/shared';

const ACCESS_LEVEL_LABELS: Record<string, string> = {
  staff: 'All Staff',
  admin: 'Admins Only',
  restricted: 'Specific Users',
};

const CATEGORY_LABELS: Record<string, string> = {
  service_account: 'Service Account',
  device: 'Device',
  shared_account: 'Shared Account',
  api_key: 'API Key',
  other: 'Other',
};

interface ParsedRow {
  title: string;
  username: string;
  password: string;
  url: string;
  selected: boolean;
}

// Minimal RFC 4180-compliant CSV parser
function parseCsv(text: string): Record<string, string>[] {
  const lines: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (cur.trim()) lines.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) lines.push(cur);

  function splitLine(line: string): string[] {
    const fields: string[] = [];
    let field = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { field += '"'; i++; }
        else q = !q;
      } else if (ch === ',' && !q) {
        fields.push(field);
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field);
    return fields;
  }

  if (lines.length < 2) return [];
  const headers = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = splitLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim() ?? '']));
  });
}

function hostFromUrl(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function detectAndMap(rows: Record<string, string>[]): ParsedRow[] {
  return rows
    .map((row) => {
      // Bitwarden: type must be 'login'
      if ('type' in row && row['type'] !== 'login') return null;

      // Chrome/Edge: name, url, username, password
      // Bitwarden:   name, login_uri, login_username, login_password
      // Firefox:     url, username, password (no name field)
      const url = row['url'] ?? row['login_uri'] ?? '';
      const username = row['username'] ?? row['login_username'] ?? '';
      const password = row['password'] ?? row['login_password'] ?? '';
      const title = row['name'] || (url ? hostFromUrl(url) : '');

      if (!title || !password) return null;
      return { title, username, password, url, selected: true };
    })
    .filter((r): r is ParsedRow => r !== null);
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportCredentialsModal({ open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [category, setCategory] = useState<string>(CredentialCategory.OTHER);
  const [accessLevel, setAccessLevel] = useState<string>(VaultAccessLevel.STAFF);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const queryClient = useQueryClient();

  const { mutate: doImport, isPending } = useMutation({
    mutationFn: () =>
      importCredentials(
        rows
          .filter((r) => r.selected)
          .map(({ title, username, password, url }) => ({
            title,
            username: username || undefined,
            password,
            url: url || undefined,
            category,
            accessLevel,
          })),
      ),
    onSuccess: (res) => {
      setResult(res);
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('');
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      const mapped = detectAndMap(parsed);
      if (mapped.length === 0) {
        setError('No valid credentials found. Ensure the file is a Chrome, Edge, Firefox, or Bitwarden CSV export.');
        setRows([]);
      } else {
        setRows(mapped);
      }
    };
    reader.readAsText(file);
  }

  function toggleRow(i: number) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));
  }

  function toggleAll() {
    const allSelected = rows.every((r) => r.selected);
    setRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
  }

  function handleClose() {
    setRows([]);
    setError('');
    setResult(null);
    setCategory(CredentialCategory.OTHER);
    setAccessLevel(VaultAccessLevel.STAFF);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Credentials</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <p className="text-sm text-muted-foreground">
            Supports CSV exports from <strong>Chrome</strong>, <strong>Edge</strong>, <strong>Firefox</strong>, and <strong>Bitwarden</strong>.
            Passwords are encrypted on import.
          </p>

          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Choose CSV file
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />

            {rows.length > 0 && (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-44 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(CredentialCategory).map((c) => (
                        <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Access Level</Label>
                  <Select value={accessLevel} onValueChange={setAccessLevel}>
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(VaultAccessLevel).map((l) => (
                        <SelectItem key={l} value={l}>{ACCESS_LEVEL_LABELS[l]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {result && (
            <p className="text-sm text-green-700 font-medium">
              Import complete — {result.imported} imported, {result.skipped} skipped.
            </p>
          )}

          {rows.length > 0 && !result && (
            <div className="rounded border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={rows.every((r) => r.selected)}
                        onChange={toggleAll}
                        className="cursor-pointer"
                      />
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Username</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">URL</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b last:border-0 ${row.selected ? '' : 'opacity-40'}`}
                      onClick={() => toggleRow(i)}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleRow(i)}
                          onClick={(e) => e.stopPropagation()}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium max-w-[160px] truncate">{row.title}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground max-w-[160px] truncate">{row.username || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate text-xs">{row.url || '—'}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{'•'.repeat(Math.min(row.password.length, 10))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {rows.length > 0 && !result && (
            <Button onClick={() => doImport()} disabled={isPending || selectedCount === 0}>
              {isPending ? 'Importing...' : `Import ${selectedCount} credential${selectedCount !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
