import Link from 'next/link';
import { TrendingDown, Clock, Inbox, AlertCircle } from 'lucide-react';
import { sql } from '@/lib/neon/db';
import { Badge } from '@/components/ui/badge';
import {
    AdminDataTableShell,
    AdminPageHeader,
    AdminStatStrip,
    AdminEmptyState,
} from '@/components/admin/primitives';
import { formatAdminDate } from '@/lib/admin/date-format';

export const dynamic = 'force-dynamic';

type LastEventRow = {
    request_id: string;
    property_address: string;
    seller_name: string | null;
    seller_email: string | null;
    account_id: string | null;
    user_name: string | null;
    user_email: string | null;
    request_created_at: string;
    last_event_type: string | null;
    last_event_data: Record<string, unknown> | null;
    last_event_at: string | null;
    hours_since_last_event: number | null;
};

type AbandonmentData = {
    totalRequests: number;
    inProgressCount: number;
    abandoned24h: number;
    abandoned7d: number;
    abandonedOver7d: number;
    byLastEvent: Array<{ event_type: string; count: number }>;
    byLastCategory: Array<{ category: string; count: number }>;
    rows: LastEventRow[];
};

async function getAbandonmentData(): Promise<AbandonmentData | null> {
    if (!sql) return null;

    const [totalsRes, agedRes, byEventRes, byCategoryRes, rowsRes] = await Promise.all([
        sql`
            SELECT
                COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_count,
                COUNT(*)::int AS total_requests
            FROM requests
        `,
        sql`
            SELECT
                COUNT(*) FILTER (
                    WHERE COALESCE(last_activity_at, created_at) >= NOW() - INTERVAL '24 hours'
                )::int AS last_24h,
                COUNT(*) FILTER (
                    WHERE COALESCE(last_activity_at, created_at) >= NOW() - INTERVAL '7 days'
                )::int AS last_7d,
                COUNT(*) FILTER (
                    WHERE COALESCE(last_activity_at, created_at) < NOW() - INTERVAL '7 days'
                )::int AS over_7d
            FROM requests
            WHERE status = 'in_progress'
        `,
        sql`
            WITH last_events AS (
                SELECT DISTINCT ON (el.request_id)
                    el.request_id,
                    el.event_type
                FROM event_logs el
                JOIN requests r ON r.id = el.request_id
                WHERE r.status = 'in_progress'
                ORDER BY el.request_id, el.created_at DESC
            )
            SELECT event_type, COUNT(*)::int AS count
            FROM last_events
            GROUP BY event_type
            ORDER BY count DESC
        `,
        sql`
            WITH last_suggestions AS (
                SELECT DISTINCT ON (el.request_id)
                    el.request_id,
                    el.event_data
                FROM event_logs el
                JOIN requests r ON r.id = el.request_id
                WHERE r.status = 'in_progress'
                  AND el.event_type = 'suggestions_fetched'
                ORDER BY el.request_id, el.created_at DESC
            )
            SELECT category, COUNT(*)::int AS count
            FROM last_suggestions,
                 LATERAL jsonb_array_elements_text(COALESCE(event_data->'categories', '[]'::jsonb)) AS category
            GROUP BY category
            ORDER BY count DESC
        `,
        sql`
            WITH last_events AS (
                SELECT DISTINCT ON (el.request_id)
                    el.request_id,
                    el.event_type,
                    el.event_data,
                    el.created_at AS last_event_at
                FROM event_logs el
                JOIN requests r ON r.id = el.request_id
                WHERE r.status = 'in_progress'
                ORDER BY el.request_id, el.created_at DESC
            )
            SELECT
                r.id AS request_id,
                r.property_address,
                r.seller_name,
                r.seller_email,
                r.account_id,
                r.created_at AS request_created_at,
                a.full_name AS user_name,
                a.email AS user_email,
                le.event_type AS last_event_type,
                le.event_data AS last_event_data,
                le.last_event_at,
                EXTRACT(EPOCH FROM (NOW() - COALESCE(le.last_event_at, r.created_at))) / 3600.0 AS hours_since_last_event
            FROM requests r
            LEFT JOIN accounts a ON r.account_id = a.id
            LEFT JOIN last_events le ON le.request_id = r.id
            WHERE r.status = 'in_progress'
            ORDER BY COALESCE(le.last_event_at, r.created_at) DESC
            LIMIT 200
        `,
    ]);

    return {
        totalRequests: Number(totalsRes[0]?.total_requests || 0),
        inProgressCount: Number(totalsRes[0]?.in_progress_count || 0),
        abandoned24h: Number(agedRes[0]?.last_24h || 0),
        abandoned7d: Number(agedRes[0]?.last_7d || 0),
        abandonedOver7d: Number(agedRes[0]?.over_7d || 0),
        byLastEvent: byEventRes.map((r) => ({
            event_type: String(r.event_type ?? 'unknown'),
            count: Number(r.count || 0),
        })),
        byLastCategory: byCategoryRes.map((r) => ({
            category: String(r.category ?? 'unknown'),
            count: Number(r.count || 0),
        })),
        rows: rowsRes as unknown as LastEventRow[],
    };
}

function formatHours(hours: number | null): string {
    if (hours == null) return '—';
    if (hours < 1) return `${Math.round(hours * 60)}m ago`;
    if (hours < 24) return `${Math.round(hours)}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
}

function describeLastStep(eventType: string | null, eventData: Record<string, unknown> | null): string {
    if (!eventType) return 'Never opened';
    if (eventType === 'seller_opened') return 'Opened, never engaged';
    if (eventType === 'suggestions_fetched') {
        const cats = Array.isArray(eventData?.categories) ? (eventData.categories as string[]) : [];
        if (cats.length > 0) return `Reached ${cats.join(', ')}`;
        return 'Reached a utility step';
    }
    if (eventType === 'suggestions_search') {
        const cat = typeof eventData?.category === 'string' ? eventData.category : null;
        return cat ? `Searched provider on ${cat}` : 'Searched for provider';
    }
    if (eventType === 'request_created') return 'Created, never opened';
    if (eventType === 'reminder_sent') return 'Reminded, no response';
    return eventType;
}

export default async function AbandonmentPage() {
    const data = await getAbandonmentData();

    if (!data) {
        return <div className="p-8">Database not configured</div>;
    }

    const abandonmentRate = data.totalRequests > 0
        ? ((data.inProgressCount / data.totalRequests) * 100).toFixed(1)
        : '0.0';

    const topCliff = data.byLastCategory[0];

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Abandonment Analysis"
                description="Where sellers stop in the utility form before submitting."
            />

            <AdminStatStrip
                stats={[
                    {
                        label: 'In Progress',
                        value: data.inProgressCount.toLocaleString(),
                        hint: `${abandonmentRate}% of all ${data.totalRequests.toLocaleString()} requests`,
                        icon: Inbox,
                    },
                    {
                        label: 'Last 24 hours',
                        value: data.abandoned24h.toLocaleString(),
                        hint: 'Recently active, may still convert',
                        icon: Clock,
                    },
                    {
                        label: 'Last 7 days',
                        value: data.abandoned7d.toLocaleString(),
                        hint: 'Still warm, worth a reminder',
                        icon: TrendingDown,
                    },
                    {
                        label: 'Older than 7 days',
                        value: data.abandonedOver7d.toLocaleString(),
                        hint: 'Likely lost',
                        icon: AlertCircle,
                    },
                ]}
            />

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur">
                    <div className="mb-4">
                        <h3 className="text-lg font-medium">Last event before abandonment</h3>
                        <p className="text-sm text-muted-foreground">
                            What every in-progress seller did last. <code>seller_opened</code> means they loaded the form and bailed; <code>suggestions_fetched</code> means they advanced to a utility step.
                        </p>
                    </div>
                    {data.byLastEvent.length === 0 ? (
                        <AdminEmptyState title="No data yet" description="No in-progress requests with event history." />
                    ) : (
                        <ul className="space-y-2">
                            {data.byLastEvent.map((row) => {
                                const pct = data.inProgressCount > 0 ? (row.count / data.inProgressCount) * 100 : 0;
                                return (
                                    <li key={row.event_type} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-mono text-xs text-foreground">{row.event_type}</span>
                                            <span className="text-muted-foreground">
                                                {row.count} ({pct.toFixed(0)}%)
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full bg-red-500/70"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="rounded-xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur">
                    <div className="mb-4">
                        <h3 className="text-lg font-medium">Drop-off by utility category</h3>
                        <p className="text-sm text-muted-foreground">
                            For sellers who got into the form, which utility category was the last one they saw before quitting.
                            {topCliff ? (
                                <> Top cliff: <strong className="text-foreground">{topCliff.category}</strong> ({topCliff.count} requests).</>
                            ) : null}
                        </p>
                    </div>
                    {data.byLastCategory.length === 0 ? (
                        <AdminEmptyState
                            title="No category data"
                            description="No in-progress requests have advanced past the opening screen yet."
                        />
                    ) : (
                        <ul className="space-y-2">
                            {data.byLastCategory.map((row) => {
                                const total = data.byLastCategory.reduce((acc, r) => acc + r.count, 0);
                                const pct = total > 0 ? (row.count / total) * 100 : 0;
                                return (
                                    <li key={row.category} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium capitalize">{row.category}</span>
                                            <span className="text-muted-foreground">
                                                {row.count} ({pct.toFixed(0)}%)
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full bg-amber-500/70"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>

            <AdminDataTableShell>
                <div className="border-b border-border/70 p-4">
                    <h3 className="text-lg font-medium">In-progress requests (most recent activity first)</h3>
                    <p className="text-sm text-muted-foreground">
                        Showing up to 200. Click a row to inspect the full event log.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                        <thead>
                            <tr className="border-b bg-muted/40 text-left">
                                <th className="p-3 font-medium">Address</th>
                                <th className="p-3 font-medium">User</th>
                                <th className="p-3 font-medium">Last step reached</th>
                                <th className="p-3 font-medium">Last activity</th>
                                <th className="p-3 font-medium">Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                        No in-progress requests.
                                    </td>
                                </tr>
                            ) : (
                                data.rows.map((row) => {
                                    const hours = row.hours_since_last_event != null ? Number(row.hours_since_last_event) : null;
                                    const isStale = hours != null && hours > 24 * 7;
                                    return (
                                        <tr key={row.request_id} className="border-b last:border-0 hover:bg-muted/40">
                                            <td className="p-3">
                                                <Link
                                                    href={`/admin/requests/${row.request_id}`}
                                                    className="font-medium text-foreground hover:underline"
                                                >
                                                    {row.property_address}
                                                </Link>
                                            </td>
                                            <td className="p-3">
                                                <div className="text-foreground">{row.user_name || '—'}</div>
                                                <div className="text-xs text-muted-foreground">{row.user_email || ''}</div>
                                            </td>
                                            <td className="p-3">
                                                <Badge variant={row.last_event_type === 'seller_opened' ? 'outline' : 'secondary'}>
                                                    {describeLastStep(row.last_event_type, row.last_event_data)}
                                                </Badge>
                                            </td>
                                            <td className="p-3">
                                                <span className={isStale ? 'text-muted-foreground' : 'text-foreground'}>
                                                    {formatHours(hours)}
                                                </span>
                                            </td>
                                            <td className="p-3 text-xs text-muted-foreground">
                                                {formatAdminDate(row.request_created_at)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </AdminDataTableShell>
        </div>
    );
}
