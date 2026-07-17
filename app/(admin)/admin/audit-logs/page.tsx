import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ComponentType } from 'react';
import {
    ArrowUpDown,
    Ban,
    CreditCard,
    FileText,
    Mail,
    Megaphone,
    Pencil,
    Search,
    Shield,
    Trash2,
    User,
    UserCheck,
} from 'lucide-react';
import { searchAuditLogs } from '@/lib/admin';
import type { AdminAction } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminDataTableShell, AdminFilterBar, AdminPageHeader, AdminPagination } from '@/components/admin/primitives';
import {
    buildAuditLogPresentation,
    getAuditActionLabel,
    parseAuditDateFilter,
} from '@/lib/admin/audit-log-presentation';
import { formatAdminDateTime } from '@/lib/admin/date-format';
import {
    DEFAULT_PAGE_SIZE,
    buildAdminHref,
    clampPage,
    getParam,
    parsePage,
    parsePageSize,
    resolveSearchParams,
    shouldCanonicalizePage,
} from '@/lib/admin/list-query';

export const dynamic = 'force-dynamic';

type AuditLogsSearchParams = Promise<Record<string, string | string[] | undefined>>;

const adminActionFilters = [
    'user_banned',
    'user_unbanned',
    'role_changed',
    'plan_changed',
    'impersonation_started',
    'impersonation_ended',
    'request_status_changed',
    'request_seller_updated',
    'request_reminder_sent',
    'testimonial_request_sent',
    'testimonial_test_sent',
    'user_updated',
    'product_update_created',
    'product_update_published',
    'product_update_deleted',
] as const satisfies readonly AdminAction[];

function isAdminAction(value: string): value is AdminAction {
    return (adminActionFilters as readonly string[]).includes(value);
}
type ActionIcon = ComponentType<{ className?: string }>;

const actionIcons: Partial<Record<AdminAction, ActionIcon>> = {
    impersonation_started: UserCheck,
    impersonation_ended: UserCheck,
    user_banned: Ban,
    user_unbanned: UserCheck,
    role_changed: Shield,
    plan_changed: CreditCard,
    request_status_changed: ArrowUpDown,
    request_seller_updated: Pencil,
    request_reminder_sent: Mail,
    testimonial_request_sent: Mail,
    testimonial_test_sent: Mail,
    user_updated: User,
    product_update_created: Megaphone,
    product_update_published: Megaphone,
    product_update_deleted: Trash2,
};

const actionColors: Partial<Record<AdminAction, string>> = {
    impersonation_started: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    impersonation_ended: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    user_banned: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
    user_unbanned: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    role_changed: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    plan_changed: 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    request_status_changed: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    request_seller_updated: 'border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300',
    request_reminder_sent: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    testimonial_request_sent: 'border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-300',
    testimonial_test_sent: 'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300',
    user_updated: 'border-gray-500/20 bg-gray-500/10 text-gray-700 dark:text-gray-300',
    product_update_created: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
    product_update_published: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    product_update_deleted: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

export default async function AuditLogsPage({ searchParams }: { searchParams: AuditLogsSearchParams }) {
    const sp = await resolveSearchParams(searchParams);
    const rawPage = getParam(sp, 'page');
    const rawPageSize = getParam(sp, 'pageSize');

    const page = parsePage(rawPage, 1);
    const pageSize = parsePageSize(rawPageSize, [25, 50, 100], DEFAULT_PAGE_SIZE);
    const query = (getParam(sp, 'q') || '').trim();
    const actionRaw = getParam(sp, 'action');
    const action = actionRaw && isAdminAction(actionRaw) ? actionRaw : undefined;
    const rawFromDate = getParam(sp, 'from');
    const rawToDate = getParam(sp, 'to');
    const parsedFromDate = parseAuditDateFilter(rawFromDate);
    const parsedToDate = parseAuditDateFilter(rawToDate);
    const dateOrderInvalid = Boolean(parsedFromDate && parsedToDate && parsedFromDate > parsedToDate);
    const fromDate = dateOrderInvalid ? undefined : parsedFromDate;
    const toDate = dateOrderInvalid ? undefined : parsedToDate;
    const offset = (page - 1) * pageSize;

    const { logs, total } = await searchAuditLogs({
        limit: pageSize,
        offset,
        query,
        action,
        fromDate,
        toDate,
    });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const canonicalPage = clampPage(page, totalPages);

    const baseValues = {
        q: query || undefined,
        action,
        from: fromDate,
        to: toDate,
        pageSize,
    };

    const buildPageHref = (targetPage: number) => buildAdminHref('/admin/audit-logs', {
        ...baseValues,
        page: targetPage,
    });

    if (shouldCanonicalizePage({ rawPage, rawPageSize, page, canonicalPage, pageSize })) {
        redirect(buildPageHref(canonicalPage));
    }

    const filtersActive = Boolean(query || action || rawFromDate || rawToDate);

    return (
        <div className="space-y-4">
            <AdminPageHeader
                title="Audit Logs"
                description={`Understand who changed what, when, and why while retaining technical evidence (${total.toLocaleString()}).`}
            />

            <AdminFilterBar>
                <form method="GET" action="/admin/audit-logs" className="space-y-3">
                    <input type="hidden" name="page" value="1" />
                    <input type="hidden" name="pageSize" value={pageSize} />

                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <label htmlFor="audit-search" className="text-xs font-medium text-muted-foreground">Search audit evidence</label>
                            <Input
                                id="audit-search"
                                name="q"
                                placeholder="Action, actor, affected user, reason, or record ID"
                                defaultValue={query}
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 xl:w-[38rem]">
                            <div className="space-y-1.5">
                                <label htmlFor="audit-action" className="text-xs font-medium text-muted-foreground">Action</label>
                                <select
                                    id="audit-action"
                                    name="action"
                                    defaultValue={action || ''}
                                    className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground sm:h-8"
                                >
                                    <option value="">All actions</option>
                                    {adminActionFilters.map((filter) => (
                                        <option key={filter} value={filter}>{getAuditActionLabel(filter)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="audit-from" className="text-xs font-medium text-muted-foreground">From date</label>
                                <Input id="audit-from" name="from" type="date" defaultValue={parsedFromDate || rawFromDate || ''} />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="audit-to" className="text-xs font-medium text-muted-foreground">Through date</label>
                                <Input id="audit-to" name="to" type="date" defaultValue={parsedToDate || rawToDate || ''} />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button type="submit" variant="outline">
                                <Search className="h-4 w-4" />
                                Apply filters
                            </Button>
                            {filtersActive ? (
                                <Link
                                    href={buildAdminHref('/admin/audit-logs', { page: 1, pageSize })}
                                    className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Reset
                                </Link>
                            ) : null}
                        </div>
                    </div>

                    {dateOrderInvalid ? (
                        <p role="alert" className="text-sm text-destructive">
                            The from date must be on or before the through date. Date filtering was not applied.
                        </p>
                    ) : null}
                </form>
            </AdminFilterBar>

            <AdminDataTableShell>
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <FileText className="mb-3 h-10 w-10 opacity-50" />
                        <p className="text-sm">No audit entries found.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/70">
                        {logs.map((log) => {
                            const logAction = log.action as AdminAction;
                            const Icon = actionIcons[logAction] || FileText;
                            const colorClass = actionColors[logAction] || 'border-gray-500/20 bg-gray-500/10 text-gray-700';
                            const presentation = buildAuditLogPresentation(log);
                            const hasTechnicalEvidence = Boolean(
                                log.ip_address
                                || presentation.userAgent
                                || Object.keys(presentation.metadata).length
                            );

                            return (
                                <article key={log.id} className="p-4 transition-colors hover:bg-secondary/20">
                                    <div className="flex items-start gap-3 sm:gap-4">
                                        <div className={`rounded-lg border p-2 ${colorClass}`} aria-hidden="true">
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1 space-y-3">
                                            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant="outline" className={colorClass}>{presentation.label}</Badge>
                                                        {log.metadata?.blocked === true ? <Badge variant="outline">Blocked by policy</Badge> : null}
                                                    </div>
                                                    <p className="mt-2 text-sm font-medium text-foreground">{presentation.summary}</p>
                                                </div>
                                                <time dateTime={log.created_at} className="shrink-0 text-sm font-semibold text-foreground">
                                                    {formatAdminDateTime(log.created_at)}
                                                </time>
                                            </div>

                                            <dl className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                                                <div>
                                                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Actor</dt>
                                                    <dd className="mt-1">
                                                        <Link href={`/admin/users/${log.admin_id}`} className="font-medium text-foreground hover:underline">
                                                            {log.admin_name || log.admin_email || 'Unknown Admin'}
                                                        </Link>
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Affected record</dt>
                                                    <dd className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                                        {presentation.relatedRecords.length ? presentation.relatedRecords.map((record) => (
                                                            <Link key={`${record.href}-${record.label}`} href={record.href} className="font-medium text-foreground hover:underline">
                                                                {record.label}
                                                            </Link>
                                                        )) : <span className="text-muted-foreground">No linked Admin record</span>}
                                                    </dd>
                                                </div>
                                            </dl>

                                            {presentation.reason ? (
                                                <div className="rounded-md border border-border/70 bg-secondary/20 px-3 py-2 text-sm">
                                                    <span className="font-medium text-foreground">Reason:</span>{' '}
                                                    <span className="text-muted-foreground">{presentation.reason}</span>
                                                </div>
                                            ) : null}

                                            {hasTechnicalEvidence ? (
                                                <details className="rounded-md border border-border/70 bg-secondary/10 p-3">
                                                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                                                        Technical evidence
                                                    </summary>
                                                    <div className="mt-3 space-y-3 text-xs text-muted-foreground">
                                                        {log.ip_address ? (
                                                            <p><span className="font-medium text-foreground">IP address:</span> {log.ip_address}</p>
                                                        ) : null}
                                                        {presentation.userAgent ? (
                                                            <p className="break-words"><span className="font-medium text-foreground">User agent:</span> {presentation.userAgent}</p>
                                                        ) : null}
                                                        {Object.keys(presentation.metadata).length ? (
                                                            <pre className="overflow-x-auto rounded-md bg-background p-3 text-[11px]">
                                                                {JSON.stringify(presentation.metadata, null, 2)}
                                                            </pre>
                                                        ) : null}
                                                    </div>
                                                </details>
                                            ) : null}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}

                <AdminPagination
                    page={canonicalPage}
                    pageSize={pageSize}
                    total={total}
                    totalPages={totalPages}
                    prevHref={buildPageHref(Math.max(1, canonicalPage - 1))}
                    nextHref={buildPageHref(Math.min(totalPages, canonicalPage + 1))}
                    buildPageSizeHref={(size) => buildAdminHref('/admin/audit-logs', {
                        ...baseValues,
                        page: 1,
                        pageSize: size,
                    })}
                />
            </AdminDataTableShell>
        </div>
    );
}
