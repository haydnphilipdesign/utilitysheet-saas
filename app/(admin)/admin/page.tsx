import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
    Activity,
    ArrowRight,
    Building2,
    CheckCircle2,
    CircleAlert,
    ClipboardCheck,
    Clock3,
    Eye,
    FileCheck2,
    FileText,
    MousePointerClick,
    ShieldCheck,
    UserPlus,
    UsersRound,
} from 'lucide-react';
import { sql } from '@/lib/neon/db';
import { Overview } from '@/components/admin/Overview';
import { RecentActivity } from '@/components/admin/RecentActivity';
import { AdminPageHeader } from '@/components/admin/primitives';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    getActivationFunnelStats,
    getGrowthSourceStats,
    getReferralLoopStats,
    hasReferralLoopObservations,
} from '@/lib/admin/activation-funnel';
import { formatAdminDate } from '@/lib/admin/date-format';
import { getLatestRequestsForUsers } from '@/lib/admin';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function formatStatus(status: string | null | undefined) {
    if (!status) return 'Unknown';
    return status
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

async function getStats() {
    if (!sql) return null;

    const [
        requestsCount,
        requestsByStatus,
        recentRequests,
        attentionCounts,
        workspaceCounts,
        activationFunnel,
        growthSources,
        referralLoop,
    ] = await Promise.all([
        sql`SELECT count(*) as count FROM requests`,
        sql`SELECT status, count(*) as count FROM requests GROUP BY status ORDER BY status ASC`,
        sql`
            SELECT r.id, r.account_id, r.created_at, r.status, r.property_address, a.full_name, a.email
            FROM requests r
            LEFT JOIN accounts a ON r.account_id = a.id
            ORDER BY r.created_at DESC
            LIMIT 5
        `,
        sql`
            SELECT
                -- Demo requests are excluded so this agrees with the "inactive 7+ days"
                -- figure on /admin/abandonment, which excludes them throughout.
                COUNT(*) FILTER (
                    WHERE status = 'in_progress'
                      AND COALESCE(is_demo, FALSE) = FALSE
                      AND COALESCE(last_activity_at, created_at) < NOW() - INTERVAL '7 days'
                )::int AS stale_in_progress,
                COUNT(*) FILTER (
                    WHERE status = 'submitted'
                      AND COALESCE(metered_at, last_activity_at, created_at) >= NOW() - INTERVAL '7 days'
                )::int AS submitted_last_7d
            FROM requests
        `,
        sql`
            SELECT
                COUNT(*) FILTER (WHERE subscription_status = 'team')::int AS team_workspaces,
                COUNT(*) FILTER (WHERE COALESCE(subscription_status, 'free') != 'team')::int AS personal_workspaces
            FROM organizations
        `,
        getActivationFunnelStats(),
        getGrowthSourceStats(),
        getReferralLoopStats(),
    ]);

    const latestRequestsByUser = await getLatestRequestsForUsers(
        recentRequests.map((request) => request.account_id).filter((id): id is string => Boolean(id))
    );

    return {
        totalRequests: Number(requestsCount[0]?.count || 0),
        staleInProgress: Number(attentionCounts[0]?.stale_in_progress || 0),
        submittedLast7d: Number(attentionCounts[0]?.submitted_last_7d || 0),
        teamWorkspaces: Number(workspaceCounts[0]?.team_workspaces || 0),
        personalWorkspaces: Number(workspaceCounts[0]?.personal_workspaces || 0),
        requestsByStatus: requestsByStatus.map((row) => ({
            name: formatStatus(row.status),
            total: Number(row.count || 0),
        })),
        recentActivity: recentRequests.map((request) => ({
            id: request.id,
            user: {
                id: request.account_id,
                name: request.full_name || request.email || 'Unknown user',
                email: request.email || 'No email',
            },
            action: 'Created a request for',
            details: request.property_address || formatStatus(request.status),
            timestamp: formatAdminDate(request.created_at),
            latestRequests: request.account_id ? latestRequestsByUser[request.account_id] || [] : [],
        })),
        activationFunnel,
        growthSources,
        referralLoop,
    };
}

function SectionHeading({ id, title, description }: { id: string; title: string; description: string }) {
    return (
        <div>
            <h2 id={id} className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
    );
}

function AttentionItem(props: {
    href: string;
    label: string;
    description: string;
    value: number;
    icon: LucideIcon;
    urgent?: boolean;
}) {
    return (
        <Link
            href={props.href}
            className="group flex items-center gap-3 rounded-lg border border-border/70 bg-background p-3 transition-colors hover:border-foreground/20 hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                props.urgent && props.value > 0
                    ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                    : 'bg-secondary text-muted-foreground'
            )}>
                <props.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{props.label}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground">
                        {props.value.toLocaleString()}
                    </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{props.description}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </Link>
    );
}

function OperationalMetric(props: {
    label: string;
    value: string;
    description: string;
    icon: LucideIcon;
    href?: string;
}) {
    const content = (
        <Card className="h-full border-border/70 bg-card shadow-none transition-colors group-hover:border-foreground/20 group-hover:bg-secondary/20">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                    <CardDescription className="text-xs font-medium uppercase tracking-wide">{props.label}</CardDescription>
                    <props.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle className="text-2xl font-semibold tracking-tight">{props.value}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-xs leading-relaxed text-muted-foreground">{props.description}</p>
            </CardContent>
        </Card>
    );

    if (!props.href) return content;

    return (
        <Link href={props.href} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {content}
        </Link>
    );
}

export default async function AdminDashboardPage() {
    const stats = await getStats();

    if (!stats) {
        return <div className="p-8">Database not configured</div>;
    }

    const activation = stats.activationFunnel;
    const referralObserved = hasReferralLoopObservations(stats.referralLoop);

    return (
        <div className="space-y-8">
            <AdminPageHeader
                title="Operations overview"
                description="Support priorities, recent product usage, and customer health in one workspace."
            />

            <section className="space-y-3" aria-labelledby="attention-heading">
                <SectionHeading
                    id="attention-heading"
                    title="Needs attention"
                    description="Start with customer states that may require inspection or follow-up."
                />
                <Card className="border-border/70 bg-card shadow-sm">
                    <CardContent className="grid gap-3 p-4 lg:grid-cols-3">
                        <AttentionItem
                            href="/admin/abandonment"
                            label="Seller flows inactive for 7+ days"
                            description="In-progress requests with no recent activity."
                            value={stats.staleInProgress}
                            icon={Clock3}
                            urgent
                        />
                        <AttentionItem
                            href="/admin/users?activation=no-setup&role=user"
                            label="No setup and no request"
                            description="Accounts that have not completed setup or created a request."
                            value={activation?.noOnboardingNoRequest || 0}
                            icon={UsersRound}
                            urgent
                        />
                        <AttentionItem
                            href="/admin/users?activation=missing-defaults&role=user"
                            label="Core setup incomplete"
                            description="Accounts missing a workspace, brand profile, or seller link."
                            value={activation?.missingDefaults || 0}
                            icon={CircleAlert}
                        />
                    </CardContent>
                </Card>
            </section>

            <section className="space-y-3" aria-labelledby="usage-heading">
                <SectionHeading
                    id="usage-heading"
                    title="Activation and recent usage"
                    description="Signals that customers are reaching a live seller handoff and returning to the product."
                />
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <OperationalMetric
                        label="Activated this week"
                        value={(activation?.firstLiveSubmissionLast7d || 0).toLocaleString()}
                        description="Accounts receiving their first live seller submission in the last 7 days."
                        icon={Activity}
                        href="/admin/users?activation=activated-7d&role=user"
                    />
                    <OperationalMetric
                        label="Seller submissions"
                        value={stats.submittedLast7d.toLocaleString()}
                        description="Requests submitted by sellers in the last 7 days."
                        icon={FileCheck2}
                        href="/admin/requests?activity=7d&status=submitted"
                    />
                    <OperationalMetric
                        label="Activation rate"
                        value={`${activation?.signupToActivationRate || 0}%`}
                        description={`${activation?.firstLiveSubmission || 0} accounts have received a live seller submission.`}
                        icon={ClipboardCheck}
                    />
                    <OperationalMetric
                        label="Habitual accounts"
                        value={(activation?.habitualAccounts || 0).toLocaleString()}
                        description="Accounts with at least 3 submitted requests in the last 30 days."
                        icon={FileText}
                        href="/admin/users?activation=habitual&role=user"
                    />
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                    <Card className="border-border/70 bg-card shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base">Request status</CardTitle>
                            <CardDescription>{stats.totalRequests.toLocaleString()} requests across the current lifecycle.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div aria-hidden="true">
                                <Overview data={stats.requestsByStatus} height={260} />
                            </div>
                            <ul aria-label="Request status summary" className="mt-3 grid gap-2 border-t border-border/70 pt-3 sm:grid-cols-2">
                                {stats.requestsByStatus.map((row) => (
                                    <li key={row.name} className="flex items-center justify-between gap-3 text-sm">
                                        <span className="text-muted-foreground">{row.name}</span>
                                        <span className="font-semibold text-foreground">{row.total.toLocaleString()}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="border-border/70 bg-card shadow-sm">
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                            <div>
                                <CardTitle className="text-base">Recent requests</CardTitle>
                                <CardDescription>Newest request activity for quick account inspection.</CardDescription>
                            </div>
                            <Link href="/admin/requests" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                                View all
                            </Link>
                        </CardHeader>
                        <CardContent>
                            <RecentActivity items={stats.recentActivity} />
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section className="space-y-3" aria-labelledby="health-heading">
                <SectionHeading
                    id="health-heading"
                    title="Paid and customer health"
                    description="Commercial context without treating automatically created personal workspaces as team adoption."
                />
                <div className="grid gap-3 md:grid-cols-3">
                    <OperationalMetric
                        label="Paying accounts"
                        value={(activation?.paidAccounts || 0).toLocaleString()}
                        description="Pro accounts plus users whose active workspace has Team billing."
                        icon={ShieldCheck}
                        href="/admin/users?plan=paying&role=user"
                    />
                    <OperationalMetric
                        label="Team workspaces"
                        value={stats.teamWorkspaces.toLocaleString()}
                        description="Workspaces with an active Team entitlement; this is the team-adoption signal."
                        icon={Building2}
                        href="/admin/organizations?billing=team"
                    />
                    <OperationalMetric
                        label="Personal/default workspaces"
                        value={stats.personalWorkspaces.toLocaleString()}
                        description="Automatically created or non-Team workspaces, shown as account context rather than team adoption."
                        icon={UsersRound}
                        href="/admin/organizations?billing=non-team"
                    />
                </div>
            </section>

            <section className="space-y-3" aria-labelledby="growth-context-heading">
                <SectionHeading
                    id="growth-context-heading"
                    title="Growth signal context"
                    description="Secondary acquisition and product-referral signals for investigation, not the primary operations queue."
                />
                <div className="grid gap-4 xl:grid-cols-2">
                    <Card className="border-border/70 bg-card shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base">Acquisition sources</CardTitle>
                            <CardDescription>Signups and first live submissions attributed in the last 90 days.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {stats.growthSources.length > 0 ? (
                                <div className="overflow-x-auto rounded-lg border border-border/70">
                                    <table className="w-full min-w-[420px] text-sm">
                                        <thead className="bg-secondary/35 text-left">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">Source</th>
                                                <th className="px-3 py-2 text-right font-medium">Signups</th>
                                                <th className="px-3 py-2 text-right font-medium">Activated</th>
                                                <th className="px-3 py-2 text-right font-medium">Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stats.growthSources.map((row) => (
                                                <tr key={row.source} className="border-t border-border/70">
                                                    <td className="px-3 py-2">{row.source}</td>
                                                    <td className="px-3 py-2 text-right">{row.signups}</td>
                                                    <td className="px-3 py-2 text-right">{row.activated}</td>
                                                    <td className="px-3 py-2 text-right">{row.activationRate}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                                    <p className="text-sm font-medium text-foreground">Not enough attributed data</p>
                                    <p className="mt-1 text-xs text-muted-foreground">No attributed signups were recorded in the last 90 days.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-border/70 bg-card shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base">Packet referral instrumentation</CardTitle>
                            <CardDescription>Last 90 days of referral CTA observations and downstream activation.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {referralObserved && stats.referralLoop ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {[
                                        { label: 'Impressions', value: stats.referralLoop.impressions, icon: Eye },
                                        { label: 'Clicks', value: stats.referralLoop.clicks, icon: MousePointerClick },
                                        { label: 'Signups', value: stats.referralLoop.signups, icon: UserPlus },
                                        { label: 'Activated', value: stats.referralLoop.activated, icon: CheckCircle2 },
                                    ].map((item) => (
                                        <div key={item.label} className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                                            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                                <span>{item.label}</span>
                                                <item.icon className="h-4 w-4" />
                                            </div>
                                            <p className="mt-2 text-2xl font-semibold text-foreground">{item.value.toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-border p-6">
                                    <div className="flex items-start gap-3">
                                        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                {stats.referralLoop ? 'Not enough data yet' : 'Instrumentation unavailable'}
                                            </p>
                                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                                {stats.referralLoop
                                                    ? 'No packet referral observations were recorded in this window, so conversion rates are hidden.'
                                                    : 'The referral event source could not be read. Other operational reporting remains available.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </section>
        </div>
    );
}
