import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatAdminDate, formatAdminDateTime } from '@/lib/admin/date-format';
import type {
    EvidenceState,
    HandoffEvidenceSummary,
    NotificationPurposeSummary,
    PdfSurfaceSummary,
    RequestNotificationEvidence,
    RequestPdfEvidence,
} from '@/lib/neon/queries/handoff-evidence';
import { PDF_FAILURE_STAGES, type PdfFailureStage } from '@/lib/telemetry/handoff-evidence';

const STAGE_LABELS: Record<PdfFailureStage, string> = {
    data: 'loading the sheet data',
    build_html: 'building the page',
    browser_launch: 'starting the browser',
    page_load: 'loading the page',
    render: 'producing the PDF',
};

const SEND_LABELS: Record<RequestNotificationEvidence['sendOutcome'], string> = {
    accepted: 'Accepted by provider',
    failed: 'Rejected, not sent',
    unknown: 'Outcome unknown (may or may not have been sent)',
    no_recipients: 'Not attempted: nobody was eligible',
};

const DELIVERY_LABELS: Record<string, string> = {
    delivered: 'delivered',
    delayed: 'delayed',
    bounced: 'bounced',
    complained: 'marked as spam',
    failed: 'delivery failed',
};

const ATTACHMENT_LABELS: Record<string, string> = {
    attached: 'PDF attached',
    failed: 'PDF failed, sent without it',
    skipped: 'PDF skipped',
    disabled: 'PDF not requested',
};

const seconds = (ms: number | null) => (ms === null ? 'n/a' : `${(ms / 1000).toFixed(1)}s`);
const kilobytes = (bytes: number | null) => (bytes === null ? 'n/a' : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function Unavailable({ state, what }: { state: EvidenceState<unknown>; what: string }) {
    if (state.status === 'ok') return null;
    return (
        <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
            {state.status === 'not_installed'
                ? `${what} is not installed yet: its database migration has not been applied. This is not the same as having no problems.`
                : `${what} could not be loaded just now. This is not the same as having no problems. Refresh to try again.`}
        </p>
    );
}

function Counts({ rows }: { rows: ReadonlyArray<readonly [string, ReactNode]> }) {
    return (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            {rows.map(([label, value]) => (
                <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium tabular-nums text-foreground">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

function notificationRows(summary: NotificationPurposeSummary, withAttachment: boolean): Array<readonly [string, ReactNode]> {
    return [
        ['Sends attempted', summary.operations - summary.noRecipients],
        ...(withAttachment ? [
            ['Nobody eligible, nothing sent', summary.noRecipients] as const,
            ['Some recipients accepted, others not', summary.partialOperations] as const,
        ] : []),
        ['Recipients accepted by provider', `${summary.accepted} of ${summary.attempted}`],
        ['Rejected, not sent', summary.failed],
        ['Outcome unknown', summary.unknown],
        ['Delivered', summary.delivered],
        ['Delivery not confirmed', summary.deliveryUnknown],
        ['Delayed', summary.delayed],
        ['Bounced', summary.bounced],
        ['Marked as spam', summary.complained],
        ['Delivery failed', summary.deliveryFailed],
        ...(withAttachment ? [
            ['PDF attached', summary.attachmentAttached] as const,
            ['PDF failed, email sent without it', summary.attachmentFailed] as const,
            ['PDF skipped (locked or not ready)', summary.attachmentSkipped] as const,
        ] : []),
    ];
}

function pdfRows(summary: PdfSurfaceSummary): Array<readonly [string, ReactNode]> {
    return [
        ['Produced', summary.rendered],
        ['Typical time (median)', seconds(summary.medianMs)],
        ['Slow end (95th percentile)', seconds(summary.p95Ms)],
        ['Typical size (median)', kilobytes(summary.medianBytes)],
        ['Not produced: locked or not submitted', summary.skipped],
        ['Failed', summary.failed],
        ...PDF_FAILURE_STAGES
            .filter((stage) => summary.failedByStage[stage] > 0)
            .map((stage) => [`Failed while ${STAGE_LABELS[stage]}`, summary.failedByStage[stage]] as const),
    ];
}

/** Operations page: 30-day completion/invitation email and PDF execution evidence. */
export function HandoffEvidenceCard({ state, webhookConfigured }: {
    state: EvidenceState<HandoffEvidenceSummary>;
    webhookConfigured: boolean;
}) {
    const data = state.status === 'ok' ? state.data : null;
    return (
        <Card className="border-border/70 bg-card shadow-sm xl:col-span-2">
            <CardHeader>
                <CardTitle className="text-base">Completion and invitation email, and sheet PDFs</CardTitle>
                <CardDescription>
                    Last {data?.windowDays ?? 30} days, live requests only. Accepted means the provider took the message, not that it arrived.
                    Delivered is the provider&apos;s report, not proof a person read it.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Unavailable state={state} what="Email handoff and PDF evidence" />
                {data ? (
                    <>
                        {data.firstObservationAt ? (
                            <p className="text-xs text-muted-foreground">
                                Recorded since {formatAdminDate(data.firstObservationAt)}; newest record {formatAdminDate(data.lastObservationAt)}.
                                Anything earlier has no evidence here.
                            </p>
                        ) : (
                            <p role="status" className="rounded-md border border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
                                Nothing has been recorded yet. Zeros below do not yet mean every email and PDF worked.
                            </p>
                        )}
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                            <section aria-label="Completion email to the customer" className="space-y-2">
                                <h3 className="text-sm font-medium text-foreground">Completion email to the customer</h3>
                                <Counts rows={notificationRows(data.notifications.completion_notification, true)} />
                            </section>
                            <section aria-label="Invitation email to the seller" className="space-y-2">
                                <h3 className="text-sm font-medium text-foreground">Invitation email to the seller</h3>
                                <Counts rows={notificationRows(data.notifications.request_invitation, false)} />
                            </section>
                            <section aria-label="PDFs attached to completion email" className="space-y-2">
                                <h3 className="text-sm font-medium text-foreground">PDFs attached to completion email</h3>
                                <Counts rows={pdfRows(data.pdf.completion_attachment)} />
                            </section>
                            <section aria-label="PDF downloads" className="space-y-2">
                                <h3 className="text-sm font-medium text-foreground">PDF downloads</h3>
                                <Counts rows={pdfRows(data.pdf.download)} />
                            </section>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            Recording is best effort, so a missing record is unknown, not a failure.
                            &quot;Delivery not confirmed&quot; stays that way unless the delivery webhook is registered{webhookConfigured ? '' : ' (it is not configured in this environment)'}.
                            One PDF is produced per recipient who asked for the attachment.
                            {data.testOperations > 0 ? ` ${data.testOperations} seller test sends are left out of these counts.` : ''}
                            {' '}Open a request to see its own email and PDF history.
                        </p>
                    </>
                ) : null}
            </CardContent>
        </Card>
    );
}

const PURPOSE_LABELS: Record<RequestNotificationEvidence['purpose'], string> = {
    completion_notification: 'Completion email to the customer',
    request_invitation: 'Invitation email to the seller',
};

const PDF_SURFACE_LABELS: Record<RequestPdfEvidence['surface'], string> = {
    download: 'PDF download',
    completion_attachment: 'PDF for completion email',
};

function notificationLine(row: RequestNotificationEvidence): string {
    const parts = [SEND_LABELS[row.sendOutcome]];
    if (row.sendOutcome === 'accepted') {
        parts.push(row.deliveryStatus
            ? `${DELIVERY_LABELS[row.deliveryStatus] ?? row.deliveryStatus} (${formatAdminDateTime(row.deliveryUpdatedAt)})`
            : 'delivery not confirmed');
    }
    if (row.failureCode && row.sendOutcome !== 'accepted') parts.push(`code ${row.failureCode}`);
    if (ATTACHMENT_LABELS[row.attachmentStatus]) parts.push(ATTACHMENT_LABELS[row.attachmentStatus]);
    return parts.join(' · ');
}

function pdfLine(row: RequestPdfEvidence): string {
    if (row.outcome === 'rendered') return `Produced in ${seconds(row.totalMs)}, ${kilobytes(row.bytes)}`;
    if (row.outcome === 'skipped') return row.skipReason === 'locked' ? 'Not produced: sheet is locked' : 'Not produced: not submitted yet';
    const stage = row.failureStage && row.failureStage in STAGE_LABELS ? STAGE_LABELS[row.failureStage as PdfFailureStage] : null;
    return `Failed${stage ? ` while ${stage}` : ''} after ${seconds(row.totalMs)}`;
}

/** Admin request page: this request's own email and PDF evidence. Recipients appear as numbers, never addresses. */
export function RequestHandoffEvidence({ state }: {
    state: EvidenceState<{ notifications: RequestNotificationEvidence[]; pdfRenders: RequestPdfEvidence[] }>;
}) {
    const data = state.status === 'ok' ? state.data : null;
    return (
        <div>
            <h3 className="text-lg font-medium mb-1">Email and PDF evidence</h3>
            <p className="mb-4 text-sm text-muted-foreground">
                What was recorded about this request&apos;s invitation email, completion email and PDFs. Recording is best effort:
                nothing listed means unknown, not that nothing was sent. Seller reminders are under the reminder action above.
            </p>
            <Unavailable state={state} what="Email handoff and PDF evidence" />
            {data ? (
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader><CardTitle className="text-sm font-medium">Email</CardTitle></CardHeader>
                        <CardContent>
                            {data.notifications.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No email evidence recorded for this request.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {data.notifications.map((row) => (
                                        <li key={`${row.operationId}:${row.recipientSlot}`} className="text-sm">
                                            <div className="font-medium text-foreground">
                                                {PURPOSE_LABELS[row.purpose]}
                                                {row.intendedRecipients > 1 ? `, recipient ${row.recipientSlot + 1} of ${row.intendedRecipients}` : ''}
                                                {row.mode === 'test' ? ' (seller test)' : ''}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{formatAdminDateTime(row.createdAt)}</div>
                                            <div className="text-xs text-foreground">{notificationLine(row)}</div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-sm font-medium">PDF</CardTitle></CardHeader>
                        <CardContent>
                            {data.pdfRenders.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No PDF evidence recorded for this request.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {data.pdfRenders.map((row, index) => (
                                        <li key={`${row.createdAt}:${index}`} className="text-sm">
                                            <div className="font-medium text-foreground">
                                                {PDF_SURFACE_LABELS[row.surface]}{row.packetMode ? ` (${row.packetMode})` : ''}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{formatAdminDateTime(row.createdAt)}</div>
                                            <div className="text-xs text-foreground">{pdfLine(row)}</div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>
            ) : null}
        </div>
    );
}
