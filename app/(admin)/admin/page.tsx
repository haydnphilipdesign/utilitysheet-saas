import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Building2, CircleAlert, Clock3, FileCheck2, Inbox, UsersRound } from 'lucide-react';
import { RecentRequestsList } from '@/components/admin/RecentRequestsList';
import { RecentSignupsList } from '@/components/admin/RecentSignupsList';
import { RequestLifecycleBar } from '@/components/admin/RequestLifecycleBar';
import { AdminPageHeader } from '@/components/admin/primitives';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getActivationFunnelStats } from '@/lib/admin/activation-funnel';
import {
    formatDelta,
    getOperationsSummary,
    getRecentRequests,
    getRecentSignups,
    getRequestStatusBreakdown,
    getRequestVolume,
} from '@/lib/admin/operations-overview';
import { getLatestRequestsForUsers } from '@/lib/admin';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function getOverviewData() {
    const [summary, volume, statusBreakdown, recentRequests, recentSignups, activation] = await Promise.all([
        getOperationsSummary(),
        getRequestVolume(),
        getRequestStatusBreakdown(),
        getRecentRequests(12),
        getRecentSignups(8),
        getActivationFunnelStats(),
    ]);

    if (!summary || !volume) return null;

    const latestRequestsByUser = await getLatestRequestsForUsers(
        recentRequests.map((request) => request.accountId).filter((id): id is string => Boolean(id))
    );

    return { summary, volume, statusBreakdown, recentRequests, recentSignups, activation, latestRequestsByUser };
}

/**
 * The headline figures. Deliberately terse: a label, a number, and one line of context.
 * Anything that needs a sentence to justify it belongs on `/admin/growth`, not here.
 */
function HeadlineMetric(props: { label: string; value: string; context: string; href: string; icon: LucideIcon }) {
    return (
        <Link
            href={props.href}
            // Separators come from the parent grid's `gap-px` over a border-colored background, so
            // the 1/2/4-column layouts each get correct dividers without per-child border rules.
            className="group flex items-start gap-3 bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
            <props.icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{props.label}</p>
                <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums text-foreground">{props.value}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{props.context}</p>
            </div>
        </Link>
    );
}

function AttentionChip(props: { href: string; label: string; value: number; icon: LucideIcon; urgent?: boolean }) {
    return (
        <Link
            href={props.href}
            className="group inline-flex items-center gap-2 rounded-full border border-border/70 bg-card py-1.5 pl-3 pr-2.5 text-sm transition-colors hover:border-foreground/25 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <props.icon
                className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    props.urgent && props.value > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                )}
            />
            <span className="font-semibold tabular-nums text-foreground">{props.value.toLocaleString()}</span>
            <span className="text-muted-foreground group-hover:text-foreground">{props.label}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </Link>
    );
}

function PanelCard(props: { title: string; description: string; href: string; linkLabel: string; children: React.ReactNode }) {
    return (
        <Card className="flex flex-col border-border/70 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div>
                    <CardTitle className="text-base">{props.title}</CardTitle>
                    <CardDescription>{props.description}</CardDescription>
                </div>
                <Link
                    href={props.href}
                    className="shrink-0 rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {props.linkLabel}
                </Link>
            </CardHeader>
            <CardContent className="flex-1 px-0 pb-2">{props.children}</CardContent>
        </Card>
    );
}

export default async function AdminDashboardPage() {
    const data = await getOverviewData();

    if (!data) {
        return <div className="p-8">Database not configured</div>;
    }

    const { summary, volume, statusBreakdown, recentRequests, recentSignups, activation, latestRequestsByUser } = data;

    const signupDelta = formatDelta(summary.signupsLast7d, summary.signupsPrev7d);
    const requestDelta = formatDelta(volume.createdLast7d, volume.createdPrev7d);

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Operations overview"
                description="Business size, what happened this week, and anything waiting on a human."
            />

            <section aria-labelledby="headline-heading">
                <h2 id="headline-heading" className="sr-only">Business at a glance</h2>
                <div className="grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
                    <HeadlineMetric
                        label="Users"
                        value={summary.totalAccounts.toLocaleString()}
                        context={
                            summary.signupsLast7d > 0
                                ? `+${summary.signupsLast7d} this week${signupDelta ? ` · ${signupDelta}` : ''}`
                                : 'No signups in the last 7 days'
                        }
                        href="/admin/users?role=user"
                        icon={UsersRound}
                    />
                    <HeadlineMetric
                        label="Paid"
                        value={summary.paidAccounts.toLocaleString()}
                        context={`${summary.paidRate}% of users · ${summary.proAccounts} Pro · ${summary.teamAccounts} Team`}
                        href="/admin/users?plan=paying&role=user"
                        icon={Building2}
                    />
                    <HeadlineMetric
                        label="Requests"
                        value={volume.totalRequests.toLocaleString()}
                        context={
                            volume.createdLast7d > 0
                                ? `+${volume.createdLast7d} this week${requestDelta ? ` · ${requestDelta}` : ''}`
                                : 'None created in the last 7 days'
                        }
                        href="/admin/requests"
                        icon={Inbox}
                    />
                    <HeadlineMetric
                        label="Seller submissions"
                        value={volume.submittedLast7d.toLocaleString()}
                        context={`Last 7 days · ${activation?.firstLiveSubmissionLast7d || 0} newly activated`}
                        href="/admin/requests?activity=7d&status=submitted"
                        icon={FileCheck2}
                    />
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]" aria-labelledby="recent-heading">
                <h2 id="recent-heading" className="sr-only">Recent activity</h2>
                <PanelCard
                    title="Recent requests"
                    description="Newest request activity across every account."
                    href="/admin/requests"
                    linkLabel="View all"
                >
                    <RecentRequestsList requests={recentRequests} latestRequests={latestRequestsByUser} />
                </PanelCard>

                <PanelCard
                    title="New signups"
                    description="Newest customer accounts and whether they have started."
                    href="/admin/users?role=user"
                    linkLabel="View all"
                >
                    <RecentSignupsList signups={recentSignups} />
                </PanelCard>
            </section>

            <section className="space-y-3" aria-labelledby="attention-heading">
                <div>
                    <h2 id="attention-heading" className="text-sm font-semibold tracking-tight text-foreground">Needs attention</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Standing backlogs. These are cumulative totals, not new activity.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <AttentionChip
                        href="/admin/abandonment"
                        label="seller flows inactive 7+ days"
                        value={volume.staleInProgress}
                        icon={Clock3}
                        urgent
                    />
                    <AttentionChip
                        href="/admin/users?activation=no-setup&role=user"
                        label="accounts with no setup and no request"
                        value={activation?.noOnboardingNoRequest || 0}
                        icon={UsersRound}
                        urgent
                    />
                    <AttentionChip
                        href="/admin/users?activation=missing-defaults&role=user"
                        label="accounts missing core setup"
                        value={activation?.missingDefaults || 0}
                        icon={CircleAlert}
                    />
                </div>
            </section>

            <section className="space-y-3" aria-labelledby="lifecycle-heading">
                <Card className="border-border/70 bg-card shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle id="lifecycle-heading" className="text-base">Request lifecycle</CardTitle>
                        <CardDescription>
                            Where all {volume.totalRequests.toLocaleString()} requests currently sit.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RequestLifecycleBar rows={statusBreakdown} total={volume.totalRequests} />
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
