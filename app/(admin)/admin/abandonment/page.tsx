import Link from 'next/link';
import { Activity, AlertCircle, Clock, ExternalLink, Inbox } from 'lucide-react';
import { getSellerProgressData } from '@/lib/neon/queries/admin-seller-progress';
import { AdminAuthorizationError } from '@/lib/admin';
import { Badge } from '@/components/ui/badge';
import {
    AdminDataTableShell,
    AdminEmptyState,
    AdminPageHeader,
    AdminStatStrip,
} from '@/components/admin/primitives';
import { formatAdminDate } from '@/lib/admin/date-format';
import { describeSellerFailure, describeSellerProgressEvent, describeSellerStep } from '@/lib/admin/seller-progress';

export const dynamic = 'force-dynamic';

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
    let data;
    try { data = await getSellerProgressData(); }
    catch (error) {
        if (error instanceof AdminAuthorizationError) throw error;
        return <div role="alert" className="p-8">Seller progress is temporarily unavailable. Reload to try again.</div>;
    }

    if (!data) return <div className="p-8">Database not configured. Seller progress is unavailable.</div>;

    const inProgressRate = data.totalRequests > 0
        ? ((data.inProgressCount / data.totalRequests) * 100).toFixed(1)
        : '0.0';
    const topCategory = data.byLastCategory[0];
    const categoryObservationCount = data.byLastCategory.reduce((total, row) => total + row.count, 0);
    const byLastStep = data.byLastStep ?? [];
    const browserObserved = data.browserObserved ?? 0;

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

            <p className="text-sm text-muted-foreground">Retained, non-demo customer requests only. {data.unknownActivity} in-progress requests have no recorded seller activity in this cycle and are excluded from age buckets. Fetch/search evidence does not prove a step was rendered or completed; browser step reports are advisory and can be missing.</p>
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
                    <div className="mb-4">
                        <h2 className="text-lg font-medium">Last tracked seller stage</h2>
                        <p className="text-sm text-muted-foreground">
                            Most recent recorded seller endpoint or browser activity in the current submission/reopen cycle. Missing evidence remains unknown; it does not prove inactivity.
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

            <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
                <div className="mb-4">
                    <h2 className="text-lg font-medium">Last step viewed in the browser</h2>
                    <p className="text-sm text-muted-foreground">
                        Reported by the seller&apos;s browser for {browserObserved.toLocaleString()} of {data.inProgressCount.toLocaleString()} in-progress requests in their current editing session. Each request counts once, at the last step it reported; going back or reloading does not add to it. Requests without a report are unknown, not stuck: reports can be blocked or lost, and collection started with this version.
                    </p>
                </div>
                {byLastStep.length === 0 ? (
                    <AdminEmptyState title="No browser step reports" description="No in-progress request has a browser-reported step in its current editing session." />
                ) : (
                    <ul className="space-y-3">
                        {byLastStep.map((row) => {
                            const pct = browserObserved > 0 ? (row.count / browserObserved) * 100 : 0;
                            return (
                                <li key={`${row.step}:${row.category ?? ''}`} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium first-letter:uppercase">{describeSellerStep(row.step, row.category) ?? 'Unrecognized step'}</span>
                                        <span className="text-muted-foreground">{row.count} ({pct.toFixed(0)}%)</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                        <div className="h-full bg-primary/60" style={{ width: `${pct}%` }} />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <AdminDataTableShell>
                <div className="border-b border-border/70 p-4">
                    <h2 className="text-lg font-medium">In-progress requests</h2>
                    <p className="text-sm text-muted-foreground">
                        Most recent recorded seller activity first, up to 200 requests. Rows marked Reopened were submitted before and reopened by the coordinator; they are included in the counts above. Open request inspection to review the event history or use existing audited recovery actions.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                        <thead>
                            <tr className="border-b bg-muted/40 text-left">
                                <th className="p-3 font-medium">Address</th>
                                <th className="p-3 font-medium">Account</th>
                                <th className="p-3 font-medium">Last tracked stage</th>
                                <th className="p-3 font-medium">Last seller observation / other event</th>
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
                                        <td className="p-3 font-medium text-foreground">
                                            {row.property_address}
                                            {row.is_reopened ? (
                                                <Badge variant="outline" className="ml-2 align-middle" title="Submitted before, then reopened by the coordinator so the seller can correct it.">Reopened</Badge>
                                            ) : null}
                                        </td>
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
                                            {row.last_step ? (
                                                <p className="mt-1 max-w-[320px] text-xs text-muted-foreground">
                                                    Browser last viewed: {describeSellerStep(row.last_step, row.last_step_category) ?? 'unrecognized step'}
                                                    {row.last_step_at ? <> · {formatAdminDate(row.last_step_at)}</> : null}
                                                </p>
                                            ) : null}
                                            {row.last_failure_code ? (
                                                <p className="mt-1 max-w-[320px] text-xs text-muted-foreground">
                                                    Last reported submit problem: {describeSellerFailure(row.last_failure_code) ?? 'unclassified'}
                                                    {row.last_failure_at ? <> · {formatAdminDate(row.last_failure_at)}</> : null}
                                                </p>
                                            ) : null}
                                        </td>
                                        <td className="p-3 text-foreground">{formatElapsed(hours)}{row.last_other_event_at ? <p className="mt-1 text-xs text-muted-foreground">Operator / technical: {row.last_other_event_type} · {formatAdminDate(row.last_other_event_at)}</p> : null}</td>
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
