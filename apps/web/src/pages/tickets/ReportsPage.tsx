import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTicketReports } from '@/api/tickets';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function BarChart({ rows, valueKey = 'count', labelKey = 'name' }: {
  rows: Record<string, unknown>[];
  valueKey?: string;
  labelKey?: string;
}) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <span className="w-36 truncate text-muted-foreground flex-shrink-0 text-xs">{String(row[labelKey])}</span>
          <div className="flex-1 bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full"
              style={{ width: `${(Number(row[valueKey]) / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs text-muted-foreground">{String(row[valueKey])}</span>
        </div>
      ))}
    </div>
  );
}

export function ReportsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['ticket-reports'], queryFn: getTicketReports });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusMap: Record<string, number> = data?.byStatus ?? {};

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/tickets" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold">Ticket Reports</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Open" value={statusMap['open'] ?? 0} />
        <StatCard label="In Progress" value={statusMap['in_progress'] ?? 0} />
        <StatCard label="Resolved this month" value={data?.resolvedThisMonth ?? 0} />
        <StatCard
          label="Avg. resolution time"
          value={data?.mttrHours != null ? `${data.mttrHours}h` : '—'}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Volume by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.byCategory?.length ? (
              <BarChart rows={data.byCategory} />
            ) : (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
          </CardContent>
        </Card>

        {/* By Technician */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Volume by Technician</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.byTechnician?.length ? (
              <div className="space-y-2">
                {data.byTechnician.map((t: { name: string; total: number; resolved: number }, i: number) => {
                  const max = Math.max(...data.byTechnician.map((x: { total: number }) => x.total), 1);
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground truncate">{t.name}</span>
                        <span>{t.total} total · {t.resolved} resolved</span>
                      </div>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${(t.total / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Volume */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Volume (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.dailyVolume?.length ? (
            <BarChart rows={data.dailyVolume} labelKey="date" />
          ) : (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Status breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            rows={Object.entries(statusMap).map(([status, count]) => ({ name: status.replace('_', ' '), count }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
