import Link from 'next/link';
import { CheckCircle2, CircleAlert, Eye, MousePointerClick, UserPlus } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/primitives';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    getActivationFunnelStats,
    getGrowthSourceStats,
    getReferralLoopStats,
    hasReferralLoopObservations,
} from '@/lib/admin/activation-funnel';

export const dynamic = 'force-dynamic';

/**
 * Analysis surface for acquisition and activation. `/admin` deliberately carries only the
 * operational figures; everything here is a question you ask occasionally rather than daily,
 * which is why it lives on its own route instead of below the operations overview.
 */

function FunnelStep(props: { label: string; value: number; total: number; rate: number; href?: string; note?: string }) {
    const width = props.total > 0 ? Math.min(100, (props.value / props.total) * 100) : 0;

    const body = (
        <>
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{props.label}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    <span className="font-semibold text-foreground">{props.value.toLocaleString()}</span> · {props.rate}%
                </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${width}%` }} />
            </div>
            {props.note ? <p className="mt-1 text-xs text-muted-foreground">{props.note}</p> : null}
        </>
    );

    if (!props.href) {
        return <li className="rounded-lg p-2">{body}</li>;
    }

    return (
        <li>
            <Link
                href={props.href}
                className="block rounded-lg p-2 transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {body}
            </Link>
        </li>
    );
}

export default async function AdminGrowthPage() {
    const [activation, growthSources, referralLoop] = await Promise.all([
        getActivationFunnelStats(),
        getGrowthSourceStats(),
        getReferralLoopStats(),
    ]);

    if (!activation) {
        return <div className="p-8">Database not configured</div>;
    }

    const referralObserved = hasReferralLoopObservations(referralLoop);
    const total = activation.totalAccounts;

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Growth and activation"
                description="Where customer accounts stall, where they came from, and how the packet referral loop is performing."
            />

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]" aria-labelledby="funnel-heading">
                <Card className="border-border/70 bg-card shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle id="funnel-heading" className="text-base">Activation funnel</CardTitle>
                        <CardDescription>
                            {total.toLocaleString()} customer accounts. Each percentage is a share of all customer accounts
                            unless noted.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-1">
                            <FunnelStep
                                label="Customer accounts"
                                value={total}
                                total={total}
                                rate={100}
                                href="/admin/users?role=user"
                            />
                            <FunnelStep
                                label="Workspace and brand profile ready"
                                value={activation.dashboardReady}
                                total={total}
                                rate={activation.dashboardReadyRate}
                            />
                            <FunnelStep
                                label="Completed onboarding"
                                value={activation.onboardingCompleted}
                                total={total}
                                rate={activation.onboardingCompletionRate}
                            />
                            <FunnelStep
                                label="Seller link created"
                                value={activation.sellerLinkReady}
                                total={total}
                                rate={total > 0 ? Math.round((activation.sellerLinkReady / total) * 100) : 0}
                            />
                            <FunnelStep
                                label="Created a request"
                                value={activation.hasRequest}
                                total={total}
                                rate={activation.firstRequestRate}
                            />
                            <FunnelStep
                                label="Received a live seller submission"
                                value={activation.firstLiveSubmission}
                                total={total}
                                rate={activation.signupToActivationRate}
                                note="This is the activation rate."
                            />
                            <FunnelStep
                                label="Habitual"
                                value={activation.habitualAccounts}
                                total={total}
                                rate={activation.activationToHabitRate}
                                href="/admin/users?activation=habitual&role=user"
                                note="3 or more submitted requests in the last 30 days, as a share of activated accounts."
                            />
                        </ul>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <Card className="border-border/70 bg-card shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Stalled accounts</CardTitle>
                            <CardDescription>Cumulative totals, matching the operations overview.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Link
                                href="/admin/users?activation=no-setup&role=user"
                                className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3 text-sm transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <span className="text-muted-foreground">No setup and no request</span>
                                <span className="font-semibold tabular-nums text-foreground">
                                    {activation.noOnboardingNoRequest.toLocaleString()} · {activation.inactiveRate}%
                                </span>
                            </Link>
                            <Link
                                href="/admin/users?activation=missing-defaults&role=user"
                                className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3 text-sm transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <span className="text-muted-foreground">Missing core setup</span>
                                <span className="font-semibold tabular-nums text-foreground">
                                    {activation.missingDefaults.toLocaleString()}
                                </span>
                            </Link>
                            <Link
                                href="/admin/users?activation=activated-7d&role=user"
                                className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3 text-sm transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <span className="text-muted-foreground">Activated in the last 7 days</span>
                                <span className="font-semibold tabular-nums text-foreground">
                                    {activation.firstLiveSubmissionLast7d.toLocaleString()}
                                </span>
                            </Link>
                            <Link
                                href="/admin/users?plan=paying&role=user"
                                className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3 text-sm transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <span className="text-muted-foreground">Paying accounts</span>
                                <span className="font-semibold tabular-nums text-foreground">
                                    {activation.paidAccounts.toLocaleString()}
                                </span>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2" aria-labelledby="acquisition-heading">
                <Card className="border-border/70 bg-card shadow-sm">
                    <CardHeader>
                        <CardTitle id="acquisition-heading" className="text-base">Acquisition sources</CardTitle>
                        <CardDescription>Signups and first live submissions attributed in the last 90 days.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {growthSources.length > 0 ? (
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
                                        {growthSources.map((row) => (
                                            <tr key={row.source} className="border-t border-border/70">
                                                <td className="px-3 py-2">{row.source}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{row.signups}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{row.activated}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{row.activationRate}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed border-border p-6 text-center">
                                <p className="text-sm font-medium text-foreground">Not enough attributed data</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    No attributed signups were recorded in the last 90 days.
                                </p>
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
                        {referralObserved && referralLoop ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {[
                                    { label: 'Impressions', value: referralLoop.impressions, icon: Eye },
                                    { label: 'Clicks', value: referralLoop.clicks, icon: MousePointerClick },
                                    { label: 'Signups', value: referralLoop.signups, icon: UserPlus },
                                    { label: 'Activated', value: referralLoop.activated, icon: CheckCircle2 },
                                ].map((item) => (
                                    <div key={item.label} className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                            <span>{item.label}</span>
                                            <item.icon className="h-4 w-4" />
                                        </div>
                                        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                                            {item.value.toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed border-border p-6">
                                <div className="flex items-start gap-3">
                                    <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-medium text-foreground">
                                            {referralLoop ? 'Not enough data yet' : 'Instrumentation unavailable'}
                                        </p>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                            {referralLoop
                                                ? 'No packet referral observations were recorded in this window, so conversion rates are hidden.'
                                                : 'The referral event source could not be read. Other operational reporting remains available.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
