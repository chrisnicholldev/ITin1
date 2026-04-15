import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, XCircle, Lock, KeyRound, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSslCerts, type SslCert } from '@/api/ssl-certs';
import { getLicenses, type License } from '@/api/licenses';
import { getContracts, type Contract } from '@/api/contracts';

// ── Unified renewal item ──────────────────────────────────────────────────────

interface RenewalItem {
  id: string;
  kind: 'ssl' | 'license' | 'contract';
  name: string;
  subtitle?: string;
  endDate: string;
  daysLeft: number;
  href: string;
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function urgencyVariant(days: number): 'destructive' | 'warning' | 'secondary' {
  if (days <= 14) return 'destructive';
  if (days <= 30) return 'warning';
  return 'secondary';
}

function urgencyColour(days: number) {
  if (days <= 14) return 'text-red-600';
  if (days <= 30) return 'text-amber-600';
  return 'text-blue-600';
}

const KIND_CONFIG = {
  ssl:      { label: 'SSL Cert',  icon: Lock,     href: '/ssl-certs' },
  license:  { label: 'License',   icon: KeyRound, href: '/licenses'  },
  contract: { label: 'Contract',  icon: FileText,  href: '/contracts' },
};

function RenewalRow({ item }: { item: RenewalItem }) {
  const cfg = KIND_CONFIG[item.kind];
  const Icon = cfg.icon;

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
      <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />

      <div className="flex-1 min-w-0">
        <Link to={cfg.href} className="text-sm font-medium hover:underline truncate block">{item.name}</Link>
        {item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
      </div>

      <div className="shrink-0">
        <Badge variant="outline" className="text-xs">{cfg.label}</Badge>
      </div>

      <div className="w-28 text-right shrink-0 text-xs text-muted-foreground">
        {new Date(item.endDate).toLocaleDateString()}
      </div>

      <div className="w-16 text-right shrink-0">
        {item.daysLeft <= 0
          ? <span className="text-xs font-semibold text-red-600">Expired</span>
          : <span className={`text-xs font-semibold ${urgencyColour(item.daysLeft)}`}>{item.daysLeft}d</span>
        }
      </div>

      <div className="w-24 text-right shrink-0">
        <Badge variant={urgencyVariant(item.daysLeft) as any}>
          {item.daysLeft <= 0 ? 'Expired' : item.daysLeft <= 14 ? 'Critical' : item.daysLeft <= 30 ? 'Warning' : 'Upcoming'}
        </Badge>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function RenewalsPage() {
  const { data: sslCerts = []  } = useQuery<SslCert[]>({ queryKey: ['ssl-certs'],  queryFn: getSslCerts });
  const { data: licenses = []  } = useQuery<License[]>({ queryKey: ['licenses'],   queryFn: () => getLicenses() });
  const { data: contracts = [] } = useQuery<Contract[]>({ queryKey: ['contracts'],  queryFn: () => getContracts() });

  // Build unified list of everything expiring within 90 days
  const items: RenewalItem[] = [];

  for (const cert of sslCerts) {
    if (!cert.expiresAt) continue;
    const days = daysUntil(cert.expiresAt);
    if (days > 90) continue;
    items.push({
      id:       cert.id,
      kind:     'ssl',
      name:     cert.domain,
      subtitle: cert.commonName !== cert.domain ? cert.commonName : cert.issuer,
      endDate:  cert.expiresAt,
      daysLeft: days,
      href:     '/ssl-certs',
    });
  }

  for (const lic of licenses) {
    if (!lic.renewalDate) continue;
    const days = daysUntil(lic.renewalDate);
    if (days > 90) continue;
    items.push({
      id:       lic.id,
      kind:     'license',
      name:     lic.name,
      subtitle: lic.vendor,
      endDate:  lic.renewalDate,
      daysLeft: days,
      href:     '/licenses',
    });
  }

  for (const contract of contracts) {
    if (!contract.endDate) continue;
    const days = daysUntil(contract.endDate);
    if (days > 90) continue;
    items.push({
      id:       contract.id,
      kind:     'contract',
      name:     contract.name,
      subtitle: contract.vendor?.name ?? contract.vendorName,
      endDate:  contract.endDate,
      daysLeft: days,
      href:     '/contracts',
    });
  }

  items.sort((a, b) => a.daysLeft - b.daysLeft);

  const critical = items.filter((i) => i.daysLeft <= 14);
  const warning  = items.filter((i) => i.daysLeft > 14 && i.daysLeft <= 30);
  const upcoming = items.filter((i) => i.daysLeft > 30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upcoming Renewals</h1>
        <p className="text-sm text-muted-foreground">
          SSL certificates, software licenses, and contracts expiring within 90 days
        </p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-red-600">{critical.length}</p>
              <p className="text-xs text-muted-foreground">Critical ≤14d</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-amber-600">{warning.length}</p>
              <p className="text-xs text-muted-foreground">Warning ≤30d</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-blue-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-blue-600">{upcoming.length}</p>
              <p className="text-xs text-muted-foreground">Upcoming ≤90d</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="mx-auto h-8 w-8 text-green-600/40 mb-3" />
            <p className="text-sm text-muted-foreground">Nothing expiring within the next 90 days.</p>
          </CardContent>
        </Card>
      )}

      {critical.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-red-600 uppercase tracking-wide flex items-center gap-2">
              <XCircle className="h-4 w-4" /> Critical — expiring within 14 days
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden lg:flex items-center gap-4 px-4 py-2 border-b text-xs text-muted-foreground">
              <span className="w-4 shrink-0"></span>
              <span className="flex-1">Name</span>
              <span className="w-24 shrink-0">Kind</span>
              <span className="w-28 text-right shrink-0">Expires</span>
              <span className="w-16 text-right shrink-0">Days</span>
              <span className="w-24 text-right shrink-0">Urgency</span>
            </div>
            <div className="divide-y">{critical.map((i) => <RenewalRow key={`${i.kind}-${i.id}`} item={i} />)}</div>
          </CardContent>
        </Card>
      )}

      {warning.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Warning — expiring within 30 days
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">{warning.map((i) => <RenewalRow key={`${i.kind}-${i.id}`} item={i} />)}</div>
          </CardContent>
        </Card>
      )}

      {upcoming.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-blue-600 uppercase tracking-wide flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Upcoming — expiring within 90 days
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">{upcoming.map((i) => <RenewalRow key={`${i.kind}-${i.id}`} item={i} />)}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
