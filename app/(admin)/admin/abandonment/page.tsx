import Link from 'next/link';
import { Activity, AlertCircle, Clock, ExternalLink, Inbox } from 'lucide-react';
import { sql } from '@/lib/neon/db';
import { Badge } from '@/components/ui/badge';
import {
    AdminDataTableShell,
    AdminEmptyState,
    AdminPageHeader,
    AdminStatStrip,
} from '@/components/admin/primitives';
import { formatAdminDate } from '@/lib/admin/date-format';
import { describeSellerProgressEvent } from '@/lib/admin/seller-progress';

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

type SellerProgressData = {
    totalRequests: number;
    inProgressCount: number;
    active24h: number;
    inactive1To7d: number;
    inactiveOver7d: number;
    byLastEvent: Array<{ event_type: string; count: number }>;
    byLastCategory: Array<{ category: string; count: number }>;
    rows: LastEventRow[];
};

async function getSellerProgressData(): Promise<SellerProgressData | null> {
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
                )::int AS active_24h,
                COUNT(*) FILTER (
                    WHERE COALESCE(last_activity_at, created_at) < NOW() - INTERVAL '24 hours'
                      AND COALESCE(last_activity_at, created_at) >= NOW() - INTERVAL '7 days'
                )::int AS inactive_1_to_7d,
                COUNT(*) FILTER (
                    WHERE COALESCE(last_activity_at, created_at) < NOW() - INTERVAL '7 days'
                )::int AS inactive_over_7d
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
        active24h: Number(agedRes[0]?.active_24h || 0),
        inactive1To7d: Number(agedRes[0]?.inactive_1_to_7d || 0),
        inactiveOver7d: Number(agedRes[0]?.inactive_over_7d || 0),
        byLastEvent: byEventRes.map((row) => ({
            event_type: String(row.event_type ?? 'unknown'),
            count: Number(row.count || 0),
        })),
        byLastCategory: byCategoryRes.map((row) => ({
            category: String(row.category ?? 'unknown'),
            count: Number(row.count || 0),
        })),
        rows: rowsRes as unknown as LastEventRow[],
    };
}

function formatElapsed(hours: number | null): string {
    if (hours == null) return 'No tracked activity';
    if (hours < 1) return `${Math.round(hours * 60)}m ago`;
    if (hours < 24) return `${Math.round(hours)}h ago`;
    return `${Math.round(hours / 24)}d ago`;
}

function formatCategory(category: string) {
    return category.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function SellerProgressPage() {
    const data = await getSellerProgressData();

    if (!data) return <div className="p-8">Database not configured</div>;

    const inProgressRate = data.totalRequests > 0
        ? ((data.inProgressCount / data.totalRequests) * 100).toFixed(1)
        : '0.0';
    const topCategory = data.byLastCategory[0];
    const categoryObservationCount = data.byLastCategory.reduce((total, row) => total + row.count, 0);

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Seller progress monitoring"
                description="Inspect where in-progress seller forms last recorded activity and open a request when support follow-up is appropriate."
            />

            <AdminStatStrip
                stats={[
                    {
                        label: 'In progress',
                        value: data.inProgressCount.toLocaleString(),
                        hint: `${inProgressRate}% of ${data.totalRequests.toLocaleString()} requests`,
                        icon: Inbox,
                    },
                    {
                        label: 'Active in 24 hours',
                        value: data.active24h.toLocaleString(),
                        hint: 'Recent tracked seller activity',
                        icon: Activity,
                    },
                    {
                        label: 'Inactive 1–7 days',
                        value: data.inactive1To7d.toLocaleString(),
                        hint: 'No tracked activity in the last 24 hours',
                        icon: Clock,
                    },
                    {
                        label: 'Inactive 7+ days',
                        value: data.inactiveOver7d.toLocaleString(),
                        hint: 'Review request context before follow-up',
                        icon: AlertCircle,
                    },
                ]}
            />

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
                    <div className="mb-4">
                        <h2 className="text-lg font-medium">Last tracked seller stage</h2>
                        <p className="text-sm text-muted-foreground">
                            Human-readable summary of the most recent event on each in-progress request.
                        </p>
                    </div>
                    {data.byLastEvent.length === 0 ? (
                        <AdminEmptyState title="No stage data" description="No in-progress requests have event history yet." />
                    ) : (
                        <ul className="space-y-3">
                            {data.byLastEvent.map((row) => {
                                const pct = data.inProgressCount > 0 ? (row.count / data.inProgressCount) * 100 : 0;
                                const stage = describeSellerProgressEvent(row.event_type, null);
                                return (
                                    <li key={row.event_type} className="space-y-1.5">
                                        <div className="flex items-start justify-between gap-3 text-sm">
                                            <div>
                                                <p className="font-medium text-foreground">{stage.label}</p>
                                                <p className="text-xs text-muted-foreground">{stage.description}</p>
                                                <details className="mt-1 text-xs text-muted-foreground">
                                                    <summary className="cursor-pointer hover:text-foreground">Technical event</summary>
                                                    <code className="mt-1 block">{row.event_type}</code>
                                                </details>
                                            </div>
                                            <span className="shrink-0 text-muted-foreground">{row.count} ({pct.toFixed(0)}%)</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                            <div className="h-full bg-red-500/65" style={{ width: `${pct}%` }} />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
                    <div className="mb-4">
                        <h2 className="text-lg font-medium">Last observed utility category</h2>
                        <p className="text-sm text-muted-foreground">
                            Utility categories recorded when provider suggestions were last loaded.
                            {topCategory ? <> Most observed: <strong className="text-foreground">{formatCategory(topCategory.category)}</strong> ({topCategory.count}).</> : null}
                        </p>
                    </div>
                    {data.byLastCategory.length === 0 ? (
                        <AdminEmptyState
                            title="No category observations"
                            description="No in-progress requests have a recorded utility suggestion step."
                        />
                    ) : (
                        <ul className="space-y-3" aria-label={`Utility category summary from ${categoryObservationCount} observations`}>
                            {data.byLastCategory.map((row) => {
                                const pct = categoryObservationCount > 0 ? (row.count / categoryObservationCount) * 100 : 0;
                                return (
                                    <li key={row.category} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">{formatCategory(row.category)}</span>
                                            <span className="text-muted-foreground">{row.count} ({pct.toFixed(0)}%)</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                            <div className="h-full bg-amber-500/70" style={{ width: `${pct}%` }} />
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
                    <h2 className="text-lg font-medium">In-progress requests</h2>
                    <p className="text-sm text-muted-foreground">
                        Most recent activity first, up to 200 requests. Open request inspection to review the event history or use existing audited recovery actions.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                        <thead>
                            <tr className="border-b bg-muted/40 text-left">
                                <th className="p-3 font-medium">Address</th>
                                <th className="p-3 font-medium">Account</th>
                                <th className="p-3 font-medium">Last tracked stage</th>
                                <th className="p-3 font-medium">Last activity</th>
                                <th className="p-3 font-medium">Created</th>
                                <th className="p-3 text-right font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No in-progress requests.</td></tr>
                            ) : data.rows.map((row) => {
                                const hours = row.hours_since_last_event != null ? Number(row.hours_since_last_event) : null;
                                const stage = describeSellerProgressEvent(row.last_event_type, row.last_event_data);
                                return (
                                    <tr key={row.request_id} className="border-b last:border-0 hover:bg-muted/40">
                                        <td className="p-3 font-medium text-foreground">{row.property_address}</td>
                                        <td className="p-3">
                                            <div className="text-foreground">{row.user_name || 'Unknown account'}</div>
                                            <div className="text-xs text-muted-foreground">{row.user_email || ''}</div>
                                        </td>
                                        <td className="p-3">
                                            <Badge variant={row.last_event_type === 'seller_opened' ? 'outline' : 'secondary'}>{stage.label}</Badge>
                                            <p className="mt-1 max-w-[320px] text-xs text-muted-foreground">{stage.description}</p>
                                            {row.last_event_type ? (
                                                <details className="mt-1 text-xs text-muted-foreground">
                                                    <summary className="cursor-pointer hover:text-foreground">Technical event</summary>
                                                    <code className="mt-1 block">{row.last_event_type}</code>
                                                </details>
                                            ) : null}
                                        </td>
                                        <td className="p-3 text-foreground">{formatElapsed(hours)}</td>
                                        <td className="p-3 text-xs text-muted-foreground">{formatAdminDate(row.request_created_at)}</td>
                                        <td className="p-3 text-right">
                                            <Link
                                                href={`/admin/requests/${row.request_id}`}
                                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                Inspect request
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </AdminDataTableShell>
        </div>
    );
}
