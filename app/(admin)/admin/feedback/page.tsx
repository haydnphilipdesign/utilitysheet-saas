import Link from 'next/link';
import { Inbox, MailWarning, MessageSquare, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { FeedbackStatusControls } from '@/components/admin/FeedbackStatusControls';
import {
    AdminDataTableShell,
    AdminEmptyState,
    AdminPageHeader,
    AdminStatStrip,
} from '@/components/admin/primitives';
import { formatAdminDateTime } from '@/lib/admin/date-format';
import { FEEDBACK_ROW_LIMIT, getFeedbackInbox } from '@/lib/admin/feedback';
import { getParam, resolveSearchParams } from '@/lib/admin/list-query';
import {
    FEEDBACK_CATEGORIES,
    FEEDBACK_CATEGORY_LABELS,
    FEEDBACK_STATUSES,
    FEEDBACK_STATUS_LABELS,
    type FeedbackCategory,
    type FeedbackStatus,
} from '@/lib/feedback/constants';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type FeedbackSearchParams = Parameters<typeof resolveSearchParams>[0];

function parseOption<T extends string>(options: readonly T[], value: string | undefined): T | null {
    return options.includes(value as T) ? (value as T) : null;
}

function filterHref(status: FeedbackStatus | null, category: FeedbackCategory | null) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    const query = params.toString();
    return query ? `/admin/feedback?${query}` : '/admin/feedback';
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
    return (
        <Link
            href={href}
            aria-current={active ? 'true' : undefined}
            className={cn(buttonVariants({ variant: active ? 'default' : 'outline', size: 'sm' }))}
        >
            {children}
        </Link>
    );
}

export default async function FeedbackPage({ searchParams }: { searchParams: FeedbackSearchParams }) {
    const sp = await resolveSearchParams(searchParams);
    const status = parseOption(FEEDBACK_STATUSES, getParam(sp, 'status'));
    const category = parseOption(FEEDBACK_CATEGORIES, getParam(sp, 'category'));

    const data = await getFeedbackInbox({ status, category });

    if (!data) return <div className="p-8">Database not configured</div>;

    const header = (
        <AdminPageHeader
            title="Feedback"
            description="Messages customers sent from the Feedback button in their dashboard, with the page they were on."
        />
    );

    if (!data.installed) {
        return (
            <div className="space-y-6">
                {header}
                <AdminDataTableShell>
                    <AdminEmptyState
                        title="Feedback inbox is not installed yet"
                        description="The database migration (migrations-feedback-submissions.sql) has not been run. Until it is, feedback still arrives by email only."
                        icon={Inbox}
                    />
                </AdminDataTableShell>
            </div>
        );
    }

    const writesDisabled = process.env.ADMIN_WRITES_DISABLED === 'true'
        ? 'Admin writes are disabled (ADMIN_WRITES_DISABLED=true), so feedback status is read-only.'
        : null;
    const filtered = Boolean(status || category);

    return (
        <div className="space-y-6">
            {header}

            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
                <h2 className="text-base font-medium sm:text-lg">How to use this</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Reply to the customer from the notification email (reply-to is their address). Status and
                    notes here are internal only: changing them never contacts the customer.
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                    Messages are customer free text. They can contain codes, account numbers, or personal
                    details, so treat them as sensitive and do not paste them into tickets, analytics, or AI
                    tools.
                </p>
            </div>

            <AdminStatStrip
                stats={[
                    {
                        label: 'New',
                        value: data.newCount.toLocaleString(),
                        hint: 'Not yet reviewed or resolved',
                        icon: Inbox,
                    },
                    {
                        label: 'Total feedback',
                        value: data.total.toLocaleString(),
                        hint: `${data.last30d.toLocaleString()} in the last 30 days`,
                        icon: MessageSquare,
                    },
                    {
                        label: 'Accounts writing in',
                        value: data.accounts.toLocaleString(),
                        hint: 'Distinct accounts, not messages',
                        icon: Users,
                    },
                    {
                        label: 'Email notices failed',
                        value: data.emailFailed.toLocaleString(),
                        hint: 'Stored here, but no email reached you',
                        icon: MailWarning,
                    },
                ]}
            />

            <AdminDataTableShell>
                <div className="space-y-3 border-b border-border/70 p-4">
                    <div>
                        <h2 className="text-base font-medium sm:text-lg">Messages</h2>
                        <p className="text-sm text-muted-foreground">
                            Newest first, up to {FEEDBACK_ROW_LIMIT}.
                        </p>
                    </div>
                    <nav aria-label="Filter by status" className="flex flex-wrap items-center gap-2">
                        <FilterLink href={filterHref(null, category)} active={!status}>All statuses</FilterLink>
                        {FEEDBACK_STATUSES.map((option) => (
                            <FilterLink key={option} href={filterHref(option, category)} active={status === option}>
                                {FEEDBACK_STATUS_LABELS[option]}
                            </FilterLink>
                        ))}
                    </nav>
                    <nav aria-label="Filter by type" className="flex flex-wrap items-center gap-2">
                        <FilterLink href={filterHref(status, null)} active={!category}>All types</FilterLink>
                        {FEEDBACK_CATEGORIES.map((option) => (
                            <FilterLink key={option} href={filterHref(status, option)} active={category === option}>
                                {FEEDBACK_CATEGORY_LABELS[option]}
                            </FilterLink>
                        ))}
                    </nav>
                </div>

                {data.rows.length === 0 ? (
                    <div className="p-4">
                        <AdminEmptyState
                            title={filtered ? 'No feedback matches these filters' : 'No feedback yet'}
                            description={filtered
                                ? 'Try a different status or type.'
                                : 'Nothing has been sent from the dashboard Feedback button.'}
                            icon={MessageSquare}
                        />
                    </div>
                ) : (
                    <ul className="divide-y divide-border/70">
                        {data.rows.map((row) => (
                            <li key={row.id} className="space-y-3 p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={row.status === 'new' ? 'default' : 'secondary'}>
                                        {FEEDBACK_STATUS_LABELS[row.status] || row.status}
                                    </Badge>
                                    <Badge variant="outline">
                                        {FEEDBACK_CATEGORY_LABELS[row.category] || row.category}
                                    </Badge>
                                    {row.email_status === 'failed' ? (
                                        <Badge variant="destructive">Email notice failed</Badge>
                                    ) : null}
                                </div>
                                <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                                    {row.message}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                                    {row.account_id ? (
                                        <Link
                                            href={`/admin/users/${row.account_id}`}
                                            className="break-all font-medium text-foreground underline-offset-2 hover:underline"
                                        >
                                            {row.user_email || row.user_name || row.account_id}
                                        </Link>
                                    ) : (
                                        <span className="font-medium text-foreground">Unknown account</span>
                                    )}
                                    <Badge variant={row.is_paid ? 'default' : 'secondary'}>
                                        {row.is_paid ? 'Paid-plan access' : 'Free'}
                                    </Badge>
                                    {row.page_path ? <span className="break-all">Page: {row.page_path}</span> : null}
                                    {row.viewport ? <span>Screen: {row.viewport}</span> : null}
                                    <span>{formatAdminDateTime(row.created_at)}</span>
                                </div>
                                {row.user_agent ? (
                                    <p className="break-words text-xs text-muted-foreground/80">Browser: {row.user_agent}</p>
                                ) : null}
                                <FeedbackStatusControls
                                    item={{
                                        id: row.id,
                                        status: row.status,
                                        version: Number(row.version),
                                        note: row.note,
                                        updatedByEmail: row.updated_by_email,
                                        statusChangedAt: row.status_changed_at,
                                    }}
                                    disabledReason={writesDisabled}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </AdminDataTableShell>
        </div>
    );
}
