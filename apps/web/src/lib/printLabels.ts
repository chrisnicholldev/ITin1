import QRCode from 'qrcode';

export interface LabelAsset {
  id: string;
  name: string;
  assetTag: string;
  type: string;
}

export async function printLabels(assets: LabelAsset[], orgName = 'IT Helpdesk') {
  const base = window.location.origin;

  const labels = await Promise.all(
    assets.map(async (a) => {
      const url = `${base}/assets/${a.id}`;
      const qr = await QRCode.toDataURL(url, {
        width: 180,
        margin: 1,
        color: { dark: '#18181b', light: '#ffffff' },
      });
      return { ...a, qr };
    }),
  );

  const html = `<!DOCTYPE html><html>
<head>
  <meta charset="utf-8">
  <title>Asset Labels</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #fff; }
    .grid { display: flex; flex-wrap: wrap; gap: 10px; padding: 16px; }
    .label {
      width: 190px;
      border: 1px solid #d4d4d8;
      border-radius: 8px;
      padding: 14px 10px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      page-break-inside: avoid;
    }
    .org  { font-size: 8px; color: #a1a1aa; text-transform: uppercase; letter-spacing: .08em; }
    .qr   { width: 140px; height: 140px; margin: 4px 0; }
    .tag  { font-family: ui-monospace, monospace; font-size: 15px; font-weight: 700; color: #18181b; letter-spacing: .02em; }
    .name { font-size: 11px; color: #3f3f46; text-align: center; max-width: 160px; word-break: break-word; }
    .type { font-size: 8px; color: #a1a1aa; text-transform: uppercase; letter-spacing: .06em; margin-top: 2px; }
    @media print {
      @page { margin: 10mm; }
      .grid { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="grid">
    ${labels.map(l => `
      <div class="label">
        <div class="org">${orgName}</div>
        <img src="${l.qr}" class="qr" alt="QR" />
        <div class="tag">${l.assetTag}</div>
        <div class="name">${l.name}</div>
        <div class="type">${l.type.replace(/_/g, ' ')}</div>
      </div>`).join('')}
  </div>
  <script>window.onload = () => window.print();</script>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Allow pop-ups to print labels.'); return; }
  win.document.write(html);
  win.document.close();
}
