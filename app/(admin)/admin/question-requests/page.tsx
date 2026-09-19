import { HelpCircle, Inbox, MessageSquareQuote, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    AdminDataTableShell,
    AdminEmptyState,
    AdminPageHeader,
    AdminStatStrip,
} from '@/components/admin/primitives';
import { formatAdminDate } from '@/lib/admin/date-format';
import {
    QUESTION_REQUEST_CONTEXT_LABELS,
    QUESTION_REQUEST_PACKET_MODE_LABELS,
    QUESTION_REQUEST_ROW_LIMIT,
    getQuestionRequestSummary,
    labelForQuestionRequestKey,
    type QuestionRequestBreakdown,
} from '@/lib/admin/question-requests';

export const dynamic = 'force-dynamic';

function BreakdownList({ rows, labels, total, barClass }: {
    rows: QuestionRequestBreakdown[];
    labels: Record<string, string>;
    total: number;
    barClass: string;
}) {
    if (rows.length === 0) {
        return <AdminEmptyState title="Nothing recorded yet" description="No submissions to break down." />;
    }

    return (
        <ul className="space-y-3">
            {rows.map((row) => {
                const pct = total > 0 ? (row.count / total) * 100 : 0;
                return (
                    <li key={row.key} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{labelForQuestionRequestKey(labels, row.key)}</span>
                            <span className="text-muted-foreground">{row.count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                            <div className={`h-full ${barClass}`} style={{ width: `${pct}%` }} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

export default async function QuestionRequestsPage() {
    const data = await getQuestionRequestSummary();

    if (!data) return <div className="p-8">Database not configured</div>;

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Requested questions"
                description="Seller-form questions customers looked for and could not find, captured from Settings and request creation."
            />

            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
                <h2 className="text-base font-medium sm:text-lg">What this decides</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    The rule was fixed before the data existed: if requests concentrate on a short list,
                    build those fields as built-ins. If they form a varied long tail, a custom-question
                    builder becomes the right answer. Read the list below against that rule rather than
                    against the most recent request.
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                    Submitted text is customer free text. It can contain codes, account numbers, or
                    personal details, so treat it as sensitive and do not paste it into tickets,
                    analytics, or AI tools.
                </p>
            </div>

            <AdminStatStrip
                stats={[
                    {
                        label: 'Total requests',
                        value: data.total.toLocaleString(),
                        hint: data.total > QUESTION_REQUEST_ROW_LIMIT
                            ? `Showing the newest ${QUESTION_REQUEST_ROW_LIMIT}`
                            : 'All shown below',
                        icon: MessageSquareQuote,
                    },
                    {
                        label: 'Accounts asking',
                        value: data.accounts.toLocaleString(),
                        hint: 'Distinct accounts, not submissions',
                        icon: Users,
                    },
                    {
                        label: 'Last 30 days',
                        value: data.last30d.toLocaleString(),
                        hint: 'Recent demand',
                        icon: Inbox,
                    },
                    {
                        label: 'Free accounts asking',
                        value: data.freeAccounts.toLocaleString(),
                        hint: `${data.paidAccounts.toLocaleString()} paid`,
                        icon: HelpCircle,
                    },
                ]}
            />

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
                    <div className="mb-4">
                        <h2 className="text-base font-medium sm:text-lg">Where they asked</h2>
                        <p className="text-sm text-muted-foreground">
                            The surface the customer was on when they could not find the question.
                        </p>
                    </div>
                    <BreakdownList
                        rows={data.byContext}
                        labels={QUESTION_REQUEST_CONTEXT_LABELS}
                        total={data.total}
                        barClass="bg-sky-500/70"
                    />
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
                    <div className="mb-4">
                        <h2 className="text-base font-medium sm:text-lg">Packet mode at the time</h2>
                        <p className="text-sm text-muted-foreground">
                            Requests from Utility Sheet mode come from customers who cannot reach the
                            handoff modules at all.
                        </p>
                    </div>
                    <BreakdownList
                        rows={data.byPacketMode}
                        labels={QUESTION_REQUEST_PACKET_MODE_LABELS}
                        total={data.total}
                        barClass="bg-violet-500/70"
                    />
                </div>
            </div>

            <AdminDataTableShell>
                <div className="border-b border-border/70 p-4">
                    <h2 className="text-base font-medium sm:text-lg">Submissions</h2>
                    <p className="text-sm text-muted-foreground">
                        Newest first, up to {QUESTION_REQUEST_ROW_LIMIT}.
                    </p>
                </div>

                {data.rows.length === 0 ? (
                    <div className="p-4">
                        <AdminEmptyState
                            title="No requested questions yet"
                            description="Nothing has been submitted from Settings or request creation."
                            icon={MessageSquareQuote}
                        />
                    </div>
                ) : (
                    <ul className="divide-y divide-border/70">
                        {data.rows.map((row) => (
                            <li key={row.id} className="space-y-2 p-4">
                                <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                                    {row.requested_text}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                                    <span className="break-all font-medium text-foreground">
                                        {row.user_email || row.user_name || row.account_id || 'Unknown account'}
                                    </span>
                                    <Badge variant={row.is_paid ? 'default' : 'secondary'}>
                                        {row.is_paid ? 'Paid' : 'Free'}
                                    </Badge>
                                    <span>{labelForQuestionRequestKey(QUESTION_REQUEST_CONTEXT_LABELS, row.context)}</span>
                                    {row.packet_mode
                                        ? <span>{labelForQuestionRequestKey(QUESTION_REQUEST_PACKET_MODE_LABELS, row.packet_mode)}</span>
                                        : null}
                                    <span>{formatAdminDate(row.created_at)}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </AdminDataTableShell>
        </div>
    );
}
