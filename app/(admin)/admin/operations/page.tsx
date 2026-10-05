import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminPageHeader } from '@/components/admin/primitives';
import { TriageControls, type TriageView } from '@/components/admin/TriageControls';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/admin';
import { formatAdminDate } from '@/lib/admin/date-format';
import { getAlertConfig } from '@/lib/ops/alerts';
import { getOpsRetentionDays } from '@/lib/ops/events';
import {
    FOLLOW_UP_INACTIVE_DAYS,
    FOLLOW_UP_PAGE_SIZE,
    INCIDENT_LOOKBACK_DAYS,
    JOB_LABELS,
    JOB_OVERDUE_HOURS,
    describeCollection,
    getOperationsSnapshot,
    type FollowUpCandidate,
    type Incident,
    type JobHealth,
    type SectionState,
} from '@/lib/ops/overview';
import { effectiveTriageState, getTriageRecords, type TriageRecord } from '@/lib/ops/triage';
import { isMissingRelationError } from '@/lib/neon/statements';

export const dynamic = 'force-dynamic';

const INCIDENT_LABELS: Record<string, { title: string; investigate: string }> = {
    'pdf:generation_failed': {
        title: 'Packet PDF generation failed unexpectedly',
        investigate: 'Open the linked request and download its packet PDF. If it fails again, check server logs for "[pdf][packet_attachment] failed".',
    },
    'billing_webhook:processing_failed': {
        title: 'A verified Stripe event could not be processed',
        investigate: 'Stripe retries failed events. Check the event in the Stripe dashboard (Developers, Events) and compare the customer’s access with their subscription.',
    },
    'email:completion_send_failed': {
        title: 'Completion email to the customer was not sent',
        investigate: 'The seller submission itself succeeded. Open the request; the customer can still view it in their dashboard.',
    },
    'email:reminder_bounced': {
        title: 'A seller reminder bounced',
        investigate: 'The seller address is probably wrong. Open the request and confirm the seller email with the customer.',
    },
    'email:reminder_complained': {
        title: 'A seller marked a reminder as spam',
        investigate: 'Do not send further reminders to this seller. Tell the customer to contact them another way.',
    },
    'email:reminder_failed': {
        title: 'The email provider could not deliver a seller reminder',
        investigate: 'Open the request to see the reminder history, then check the message in the email provider dashboard.',
    },
};

const JOB_HEALTH: Record<JobHealth, { label: string; tone: 'ok' | 'warn' | 'bad' | 'muted' }> = {
    ok: { label: 'Succeeded', tone: 'ok' },
    partial: { label: 'Finished with some failures', tone: 'warn' },
    failed: { label: 'Failed', tone: 'bad' },
    overdue: { label: `No success in over ${JOB_OVERDUE_HOURS} hours`, tone: 'bad' },
    within_grace: { label: 'Observed, no success yet (within grace window)', tone: 'muted' },
    not_observed: { label: 'No runs observed yet', tone: 'muted' },
};

const TONE_CLASS = {
    ok: 'text-emerald-700 dark:text-emerald-300',
    warn: 'text-amber-700 dark:text-amber-300',
    bad: 'text-red-700 dark:text-red-300',
    muted: 'text-muted-foreground',
};

function Unavailable({ state, what }: { state: SectionState<unknown>; what: string }) {
    if (state.status === 'ok') return null;
    return (
        <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
            {state.status === 'not_installed'
                ? `${what} is not installed yet: its database migration has not been applied. This is not the same as having no problems.`
                : `${what} could not be loaded just now. This is not the same as having no problems. Refresh to try again.`}
        </p>
    );
}

function toTriageView(sourceKey: string, record: TriageRecord | null, lastOccurredAt: string | null, now: Date): TriageView {
    const effective = effectiveTriageState(record, { lastOccurredAt }, now);
    return {
        sourceKey,
        state: effective.state,
        returned: effective.returned,
        version: record?.version ?? 0,
        note: record?.note ?? null,
        snoozedUntil: record?.snoozedUntil ?? null,
        updatedByEmail: record?.updatedByEmail ?? null,
        stateChangedAt: record?.stateChangedAt ?? null,
    };
}

function Item({ title, children, quiet }: { title: ReactNode; children: ReactNode; quiet?: boolean }) {
    return (
        <li className={`space-y-2 p-4 ${quiet ? 'opacity-70' : ''}`}>
            <div className="break-words text-sm font-medium text-foreground">{title}</div>
            {children}
        </li>
    );
}

type OperationsSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OperationsPage({ searchParams }: { searchParams: OperationsSearchParams }) {
    await requireAdmin();
    const params = await searchParams;
    const pageParam = Number.parseInt(typeof params.page === 'string' ? params.page : '1', 10);
    const followUpPage = Number.isFinite(pageParam) && pageParam > 0 && pageParam <= 1000 ? pageParam : 1;
    const showHandled = params.show === 'all';

    const now = new Date();
    const snapshot = await getOperationsSnapshot({ now, followUpPage });

    const incidents = snapshot.incidents.status === 'ok' ? snapshot.incidents.data.incidents : [];
    const unresolvedReminders = snapshot.reminders.status === 'ok' ? snapshot.reminders.data.unresolved : [];
    const jobs = snapshot.jobs.status === 'ok' ? snapshot.jobs.data : [];
    const jobProblems = jobs.filter((job) => job.health === 'failed' || job.health === 'partial' || job.health === 'overdue');
    const followUps: FollowUpCandidate[] = snapshot.followUp.status === 'ok'
        ? [...snapshot.followUp.data.inactiveRequests.items, ...snapshot.followUp.data.accountsNotStarted.items]
        : [];

    const sourceKeys = [
        ...incidents.map((incident) => incident.sourceKey),
        ...unresolvedReminders.map((reminder) => reminder.sourceKey),
        ...jobProblems.map((job) => `job:${job.jobName}`),
        ...followUps.map((candidate) => candidate.sourceKey),
    ];

    let triage = new Map<string, TriageRecord>();
    let triageUnavailable: string | null = null;
    try {
        triage = await getTriageRecords({ sourceKeys });
    } catch (error) {
        triageUnavailable = isMissingRelationError(error)
            ? 'Triage is not installed yet (database migration pending).'
            : 'Triage state could not be loaded. Refresh to try again.';
    }
    if (!triageUnavailable && process.env.ADMIN_WRITES_DISABLED === 'true') {
        triageUnavailable = 'Admin writes are disabled (ADMIN_WRITES_DISABLED=true), so triage is read-only.';
    }

    const view = (sourceKey: string, lastOccurredAt: string | null) =>
        toTriageView(sourceKey, triage.get(sourceKey) ?? null, lastOccurredAt, now);
    const isHandled = (item: TriageView) => item.state === 'resolved' || item.state === 'snoozed';

    const incidentViews = incidents.map((incident) => ({ incident, triage: view(incident.sourceKey, incident.lastOccurredAt) }));
    const reminderViews = unresolvedReminders.map((reminder) => ({ reminder, triage: view(reminder.sourceKey, reminder.createdAt) }));
    const jobViews = jobProblems.map((job) => ({ job, triage: view(`job:${job.jobName}`, job.lastStartedAt) }));
    const followUpViews = followUps.map((candidate) => ({ candidate, triage: view(candidate.sourceKey, candidate.lastOccurredAt) }));

    const openService = [...incidentViews, ...reminderViews, ...jobViews].filter((entry) => !isHandled(entry.triage)).length;
    const handledService = incidentViews.length + reminderViews.length + jobViews.length - openService;
    const collection = snapshot.incidents.status === 'ok' ? describeCollection(snapshot.incidents.data, now) : null;
    const alertConfig = getAlertConfig();
    const visible = <T extends { triage: TriageView }>(entries: T[]) => entries.filter((entry) => showHandled || !isHandled(entry.triage));

    const renderIncident = (incident: Incident, item: TriageView) => {
        const copy = INCIDENT_LABELS[incident.fingerprint] ?? { title: incident.fingerprint, investigate: 'Check server logs for this category.' };
        return (
            <Item
                key={incident.sourceKey}
                quiet={isHandled(item)}
                title={(
                    <span className="flex flex-wrap items-center gap-2">
                        {copy.title}
                        <Badge variant={incident.severity === 'critical' ? 'destructive' : 'secondary'}>{incident.severity}</Badge>
                    </span>
                )}
            >
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <dt>Occurrences</dt>
                    <dd className="text-foreground">
                        {incident.occurrences} in the last {INCIDENT_LOOKBACK_DAYS} days
                        {incident.unrecovered === 0 ? ' · later success observed for all of them' : ` · ${incident.unrecovered} with no later success observed`}
                    </dd>
                    <dt>First</dt><dd className="text-foreground">{formatAdminDate(incident.firstOccurredAt)}</dd>
                    <dt>Last</dt><dd className="text-foreground">{formatAdminDate(incident.lastOccurredAt)}</dd>
                    <dt>Last success</dt>
                    <dd className="text-foreground">
                        {incident.lastSuccessAt ? `${formatAdminDate(incident.lastSuccessAt)} (sampled)` : 'None observed'}
                    </dd>
                </dl>
                <p className="text-xs leading-relaxed text-muted-foreground">
                    {copy.investigate}{' '}
                    {incident.latestRequestId ? (
                        <Link href={`/admin/requests/${incident.latestRequestId}`} className="font-medium text-foreground underline underline-offset-2">
                            Open the most recent affected request
                        </Link>
                    ) : null}
                </p>
                <TriageControls
                    item={item}
                    disabledReason={triageUnavailable}
                    resolveHint="Resolving records that you have dealt with it. It does not mean the failure has recovered; that is shown separately above."
                />
            </Item>
        );
    };

    return (
        <div className="space-y-8">
            <AdminPageHeader
                title="Operations"
                description="Service problems that need action, kept apart from ordinary customer follow-up. Triage here never changes customer records, request status or analytics."
            />

            <section aria-labelledby="service-issues-heading" className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <h2 id="service-issues-heading" className="text-lg font-semibold text-foreground">Service issues</h2>
                        <p className="text-sm text-muted-foreground">
                            {openService} open{handledService > 0 ? ` · ${handledService} snoozed or resolved` : ''}
                        </p>
                    </div>
                    <Link
                        href={showHandled ? '/admin/operations' : '/admin/operations?show=all'}
                        className="text-sm font-medium text-foreground underline underline-offset-2"
                    >
                        {showHandled ? 'Hide snoozed and resolved' : 'Show snoozed and resolved'}
                    </Link>
                </div>

                <Unavailable state={snapshot.incidents} what="Failure monitoring" />
                <Unavailable state={snapshot.reminders} what="Reminder tracking" />
                <Unavailable state={snapshot.jobs} what="Scheduled job monitoring" />

                {collection === 'no_observations' ? (
                    <p role="status" className="rounded-md border border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
                        Monitoring is installed but has not recorded any observation yet. An empty list here does not yet mean the service is healthy.
                    </p>
                ) : null}
                {collection === 'stale' && snapshot.incidents.status === 'ok' ? (
                    <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                        The newest observation is from {formatAdminDate(snapshot.incidents.data.lastObservationAt!)}. Either nothing has happened since, or collection has stopped. Check that PDFs and billing events are flowing.
                    </p>
                ) : null}

                <Card className="border-border/70 bg-card shadow-sm">
                    <CardContent className="p-0">
                        {visible(incidentViews).length + visible(reminderViews).length + visible(jobViews).length === 0 ? (
                            <p className="p-4 text-sm text-muted-foreground">
                                {snapshot.incidents.status === 'ok' && collection === 'current'
                                    ? `No open service issues. No unexpected failures were recorded in the last ${INCIDENT_LOOKBACK_DAYS} days that still need attention.`
                                    : 'Nothing to show. See the notices above for what is and is not being observed.'}
                            </p>
                        ) : (
                            <ul className="divide-y divide-border/70">
                                {visible(incidentViews).map(({ incident, triage: item }) => renderIncident(incident, item))}
                                {visible(reminderViews).map(({ reminder, triage: item }) => (
                                    <Item key={reminder.sourceKey} quiet={isHandled(item)} title="A seller reminder has an unknown outcome">
                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                            Attempted {formatAdminDate(reminder.createdAt)}. It may or may not have been sent, and it blocks new
                                            reminders for that request for 24 hours.{' '}
                                            <Link href={`/admin/requests/${reminder.requestId}`} className="font-medium text-foreground underline underline-offset-2">
                                                Open the request to retry or settle it
                                            </Link>
                                        </p>
                                        <TriageControls item={item} disabledReason={triageUnavailable} resolveHint="Resolving here only clears this queue entry. Settle the reminder itself on the request page." />
                                    </Item>
                                ))}
                                {visible(jobViews).map(({ job, triage: item }) => (
                                    <Item key={job.jobName} quiet={isHandled(item)} title={`${JOB_LABELS[job.jobName]}: ${JOB_HEALTH[job.health].label.toLowerCase()}`}>
                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                            Last run {job.lastStartedAt ? formatAdminDate(job.lastStartedAt) : 'never observed'}; last success{' '}
                                            {job.lastSuccessAt ? formatAdminDate(job.lastSuccessAt) : 'none observed'}. Check the cron run in the hosting dashboard.
                                        </p>
                                        <TriageControls item={item} disabledReason={triageUnavailable} resolveHint="Resolving does not mean the job has succeeded; its status is shown under Scheduled jobs." />
                                    </Item>
                                ))}
                            </ul>
                        )}
                        {snapshot.incidents.status === 'ok' && snapshot.incidents.data.truncated ? (
                            <p className="border-t border-border/70 p-3 text-xs text-muted-foreground">Showing the 50 most recent incident groups.</p>
                        ) : null}
                    </CardContent>
                </Card>
            </section>

            <section aria-labelledby="evidence-heading" className="grid gap-4 xl:grid-cols-2">
                <h2 id="evidence-heading" className="sr-only">Evidence</h2>
                <Card className="border-border/70 bg-card shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">Seller reminder email</CardTitle>
                        <CardDescription>
                            Last 30 days. Only reminders sent through tracked operations are counted. Delivery by the provider is not proof a person read it.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {snapshot.reminders.status === 'ok' ? (
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                {([
                                    ['Accepted by provider', snapshot.reminders.data.accepted],
                                    ['Delivered', snapshot.reminders.data.delivered],
                                    ['Delivery not confirmed', snapshot.reminders.data.deliveryUnknown],
                                    ['Delayed', snapshot.reminders.data.delayed],
                                    ['Bounced', snapshot.reminders.data.bounced],
                                    ['Marked as spam', snapshot.reminders.data.complained],
                                    ['Delivery failed', snapshot.reminders.data.deliveryFailed],
                                    ['Rejected, not sent', snapshot.reminders.data.notSent],
                                    ['Outcome unknown', snapshot.reminders.data.unresolved.length],
                                ] as const).map(([label, value]) => (
                                    <div key={label} className="contents">
                                        <dt className="text-muted-foreground">{label}</dt>
                                        <dd className="text-right font-medium tabular-nums text-foreground">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        ) : <Unavailable state={snapshot.reminders} what="Reminder tracking" />}
                        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                            &quot;Delivery not confirmed&quot; stays that way unless the delivery webhook is registered{process.env.RESEND_WEBHOOK_SECRET ? '' : ' (it is not configured in this environment)'}.
                            Reminders sent before tracking existed, and all other email, have no delivery evidence here.
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/70 bg-card shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">Scheduled jobs</CardTitle>
                        <CardDescription>
                            The three jobs with a configured schedule. A job is overdue only after monitoring has watched it for more than {JOB_OVERDUE_HOURS} hours without a success.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {snapshot.jobs.status === 'ok' ? (
                            <ul className="space-y-3">
                                {jobs.map((job) => (
                                    <li key={job.jobName} className="text-sm">
                                        <div className="font-medium text-foreground">{JOB_LABELS[job.jobName]}</div>
                                        <div className={`text-xs ${TONE_CLASS[JOB_HEALTH[job.health].tone]}`}>{JOB_HEALTH[job.health].label}</div>
                                        <div className="text-xs text-muted-foreground">
                                            Last start {job.lastStartedAt ? formatAdminDate(job.lastStartedAt) : 'not observed'}
                                            {job.lastDurationMs !== null ? ` · ${(job.lastDurationMs / 1000).toFixed(1)}s` : ''}
                                            {' · '}last success {job.lastSuccessAt ? formatAdminDate(job.lastSuccessAt) : 'none observed'}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : <Unavailable state={snapshot.jobs} what="Scheduled job monitoring" />}
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            The weekly summary email has no configured schedule, so it is not monitored and is never reported overdue.
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/70 bg-card shadow-sm xl:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base">What this page can and cannot tell you</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
                        {([
                            ['Database', 'Reachable: this page just queried it. This page cannot report a database or site outage, because it would not load. Use an external uptime probe for that.'],
                            ['Email sending', process.env.RESEND_API_KEY ? 'Provider key is configured. Configuration is not proof that sending works.' : 'Provider key is NOT configured in this environment.'],
                            ['Delivery webhook', process.env.RESEND_WEBHOOK_SECRET ? 'Signing secret is configured. Registration with the provider is verified outside this app.' : 'Not configured. Delivery, bounce and complaint evidence is not being received.'],
                            ['Alerts', alertConfig.enabled ? 'Enabled with a destination configured. They only run when the monitor job is scheduled.' : 'Disabled. Nothing is sent; this page is the only place problems appear.'],
                            ['AI suggestions', 'Aggregate outcomes are on the Telemetry page.'],
                            ['Retention', `Observations are kept for ${getOpsRetentionDays()} days${process.env.OPS_RETENTION_PRUNE_ENABLED === 'true' ? '' : ' once pruning is enabled (it is currently off)'}. Audit logs are never pruned with them.`],
                        ] as const).map(([label, text]) => (
                            <div key={label}>
                                <div className="font-medium text-foreground">{label}</div>
                                <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
                            </div>
                        ))}
                        <p className="text-xs text-muted-foreground md:col-span-2">
                            <Link href="/admin/telemetry" className="font-medium text-foreground underline underline-offset-2">Telemetry</Link>
                            {' · '}
                            <Link href="/admin/audit-logs" className="font-medium text-foreground underline underline-offset-2">Audit logs</Link>
                            {' · '}Procedures are in docs/admin-operations-runbook.md.
                        </p>
                    </CardContent>
                </Card>
            </section>

            <section aria-labelledby="follow-up-heading" className="space-y-3">
                <div>
                    <h2 id="follow-up-heading" className="text-lg font-semibold text-foreground">Customer follow-up</h2>
                    <p className="text-sm text-muted-foreground">
                        Not failures. Inactivity alone is not an incident or a reason to contact a seller. Dismissing an item here does not change the counts or any customer record.
                    </p>
                </div>
                <Unavailable state={snapshot.followUp} what="Customer follow-up" />
                {snapshot.followUp.status === 'ok' ? (
                    <>
                        <p className="text-sm text-muted-foreground">
                            <Link href="/admin/requests?activity=stale7d" className="font-medium text-foreground underline underline-offset-2">
                                {snapshot.followUp.data.inactiveRequests.total} open requests
                            </Link>{' '}
                            with no seller activity for {FOLLOW_UP_INACTIVE_DAYS}+ days ·{' '}
                            <Link href="/admin/users?activation=no-setup&role=user" className="font-medium text-foreground underline underline-offset-2">
                                {snapshot.followUp.data.accountsNotStarted.total} accounts
                            </Link>{' '}
                            that signed up {FOLLOW_UP_INACTIVE_DAYS}+ days ago and have not started. These totals ignore triage.
                        </p>
                        <Card className="border-border/70 bg-card shadow-sm">
                            <CardContent className="p-0">
                                {visible(followUpViews).length === 0 ? (
                                    <p className="p-4 text-sm text-muted-foreground">
                                        {followUpViews.length === 0 ? 'No follow-up candidates on this page.' : 'Every candidate on this page is snoozed or dismissed.'}
                                    </p>
                                ) : (
                                    <ul className="divide-y divide-border/70">
                                        {visible(followUpViews).map(({ candidate, triage: item }) => (
                                            <Item
                                                key={candidate.sourceKey}
                                                quiet={isHandled(item)}
                                                title={<Link href={candidate.href} className="underline underline-offset-2">{candidate.label}</Link>}
                                            >
                                                <p className="text-xs text-muted-foreground">
                                                    {candidate.detail} {formatAdminDate(candidate.lastOccurredAt)}.
                                                </p>
                                                <TriageControls item={item} disabledReason={triageUnavailable} resolveHint="Dismisses this candidate. It returns only if the record becomes active and then goes quiet again." />
                                            </Item>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                        <nav aria-label="Follow-up pages" className="flex items-center justify-between text-sm">
                            {followUpPage > 1 ? (
                                <Link href={`/admin/operations?page=${followUpPage - 1}${showHandled ? '&show=all' : ''}`} className="font-medium underline underline-offset-2">Previous</Link>
                            ) : <span />}
                            <span className="text-muted-foreground">Page {followUpPage}</span>
                            {followUps.length >= FOLLOW_UP_PAGE_SIZE ? (
                                <Link href={`/admin/operations?page=${followUpPage + 1}${showHandled ? '&show=all' : ''}`} className="font-medium underline underline-offset-2">Next</Link>
                            ) : <span />}
                        </nav>
                    </>
                ) : null}
            </section>
        </div>
    );
}
