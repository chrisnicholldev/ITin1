import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { importAssets } from '@/api/assets';

const TEMPLATE_HEADERS = [
  'name', 'type', 'status', 'location', 'manufacturer', 'model', 'serialNumber',
  'purchaseDate', 'warrantyExpiry', 'purchaseCost', 'notes',
  'cpu', 'ram', 'storage', 'os', 'ipAddress', 'macAddress',
  'licenseKey', 'licenseSeats', 'licenseVendor', 'licenseExpiry',
];

const TEMPLATE_EXAMPLE = [
  'Office Laptop', 'laptop', 'active', 'Head Office', 'Dell', 'Latitude 5540', 'SN123456',
  '2023-06-01', '2026-06-01', '1299.00', '',
  'Intel i7', '16GB', '512GB SSD', 'Windows 11', '192.168.1.10', 'AA:BB:CC:DD:EE:FF',
  '', '', '', '',
];

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS.join(','), TEMPLATE_EXAMPLE.join(',')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'asset_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
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
  const headers = splitLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, ''));
  return lines.slice(1).map((line) => {
    const vals = splitLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim() ?? '']));
  });
}

interface ParsedRow {
  raw: Record<string, string>;
  name: string;
  type: string;
  status: string;
  selected: boolean;
}

function mapRows(rows: Record<string, string>[]): ParsedRow[] {
  return rows
    .filter((r) => r['name']?.trim())
    .map((r) => ({
      raw: r,
      name: r['name'] ?? '',
      type: r['type'] || 'other',
      status: r['status'] || 'active',
      selected: true,
    }));
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportAssetsModal({ open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: { row: number; name: string; reason: string }[] } | null>(null);
  const queryClient = useQueryClient();

  const { mutate: doImport, isPending } = useMutation({
    mutationFn: () => importAssets(rows.filter((r) => r.selected).map((r) => r.raw)),
    onSuccess: (res) => {
      setResult(res);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
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
      const mapped = mapRows(parsed);
      if (mapped.length === 0) {
        setError('No valid rows found. Ensure the CSV has a "name" column and at least one data row.');
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
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Assets</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <p className="text-sm text-muted-foreground">
            Upload a CSV file to bulk-import assets. Download the template below to see the expected format.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Choose CSV file
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            <Button variant="ghost" size="sm" onClick={downloadTemplate} className="gap-2 text-muted-foreground">
              <Download className="h-4 w-4" /> Download template
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {result && (
            <div className="space-y-2">
              <p className="text-sm text-green-700 font-medium">
                Import complete — {result.imported} imported, {result.skipped} skipped.
              </p>
              {result.errors.length > 0 && (
                <div className="rounded border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-16">Row</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-2 text-muted-foreground">{e.row}</td>
                          <td className="px-3 py-2 font-medium">{e.name}</td>
                          <td className="px-3 py-2 text-destructive text-xs">{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Manufacturer / Model</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b last:border-0 cursor-pointer ${row.selected ? '' : 'opacity-40'}`}
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
                      <td className="px-3 py-2 font-medium max-w-[180px] truncate">{row.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.type.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.status.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs max-w-[180px] truncate">
                        {[row.raw['manufacturer'], row.raw['model']].filter(Boolean).join(' ') || '—'}
                      </td>
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
              {isPending ? 'Importing...' : `Import ${selectedCount} asset${selectedCount !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
