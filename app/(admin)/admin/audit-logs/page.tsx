import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ComponentType } from 'react';
import { format } from 'date-fns';
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
    'user_updated',
    'product_update_created',
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
    user_updated: User,
    product_update_created: Megaphone,
    product_update_deleted: Trash2,
};

const actionColors: Partial<Record<AdminAction, string>> = {
    impersonation_started: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    impersonation_ended: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    user_banned: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    user_unbanned: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    role_changed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    plan_changed: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    request_status_changed: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    request_seller_updated: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    request_reminder_sent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    user_updated: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
    product_update_created: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
    product_update_deleted: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
};

function renderMetadata(metadata: Record<string, unknown> | null) {
    if (!metadata || Object.keys(metadata).length === 0) return null;

    const entries = Object.entries(metadata).slice(0, 8);
    return (
        <div className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-1.5">
                {entries.map(([key, value]) => (
                    <Badge key={key} variant="outline" className="bg-secondary/50 text-[11px] font-normal">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="ml-1 max-w-[200px] truncate text-foreground">{String(value)}</span>
                    </Badge>
                ))}
            </div>
            <details className="rounded-md border border-border/70 bg-secondary/20 p-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">Raw metadata</summary>
                <pre className="mt-2 overflow-x-auto text-[11px] text-muted-foreground">
                    {JSON.stringify(metadata, null, 2)}
                </pre>
            </details>
        </div>
    );
}

export default async function AuditLogsPage({ searchParams }: { searchParams: AuditLogsSearchParams }) {
    const sp = await resolveSearchParams(searchParams);
    const rawPage = getParam(sp, 'page');
    const rawPageSize = getParam(sp, 'pageSize');

    const page = parsePage(rawPage, 1);
    const pageSize = parsePageSize(rawPageSize, [25, 50, 100], DEFAULT_PAGE_SIZE);
    const query = (getParam(sp, 'q') || '').trim();
    const actionRaw = getParam(sp, 'action');
    const action = actionRaw && isAdminAction(actionRaw) ? actionRaw : undefined;
    const offset = (page - 1) * pageSize;

    const { logs, total } = await searchAuditLogs({ limit: pageSize, offset, query, action });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const canonicalPage = clampPage(page, totalPages);

    const baseValues = {
        q: query || undefined,
        action,
        pageSize,
    };

    const buildPageHref = (targetPage: number) =>
        buildAdminHref('/admin/audit-logs', {
            ...baseValues,
            page: targetPage,
        });

    if (shouldCanonicalizePage({ rawPage, rawPageSize, page, canonicalPage, pageSize })) {
        redirect(buildPageHref(canonicalPage));
    }

    return (
        <div className="space-y-4">
            <AdminPageHeader
                title="Audit Logs"
                description={`Track admin changes and security-sensitive actions (${total.toLocaleString()}).`}
            />

            <AdminFilterBar>
                <form method="GET" action="/admin/audit-logs" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <input type="hidden" name="page" value="1" />
                    <input type="hidden" name="pageSize" value={pageSize} />

                    <div className="flex flex-1 items-center gap-2">
                        <Input
                            name="q"
                            placeholder="Search action, admin, target, metadata..."
                            defaultValue={query}
                            className="w-full"
                        />
                        <Button type="submit" variant="outline" size="sm">
                            <Search className="mr-1 h-4 w-4" />
                            Search
                        </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            name="action"
                            defaultValue={action || ''}
                            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                        >
                            <option value="">All actions</option>
                            {adminActionFilters.map((filter) => (
                                <option key={filter} value={filter}>
                                    {filter.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                        {(query || action) ? (
                            <Link
                                href={buildAdminHref('/admin/audit-logs', { page: 1, pageSize })}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                Reset
                            </Link>
                        ) : null}
                    </div>
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
                            const colorClass = actionColors[logAction] || 'bg-gray-500/10 text-gray-600 border-gray-500/20';

                            return (
                                <article key={log.id} className="p-4 transition-colors hover:bg-secondary/30">
                                    <div className="flex items-start gap-4">
                                        <div className={`rounded-lg border p-2 ${colorClass}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="outline" className={colorClass}>
                                                    {String(log.action).replace(/_/g, ' ')}
                                                </Badge>
                                                <span className="text-sm text-muted-foreground">
                                                    by <span className="font-medium text-foreground">{log.admin_name || log.admin_email || 'Unknown'}</span>
                                                </span>
                                                {log.target_email ? (
                                                    <span className="text-sm text-muted-foreground">
                                                        → <span className="font-medium text-foreground">{log.target_name || log.target_email}</span>
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                                            </p>
                                            {renderMetadata(log.metadata)}
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
                    buildPageSizeHref={(size) =>
                        buildAdminHref('/admin/audit-logs', {
                            ...baseValues,
                            page: 1,
                            pageSize: size,
                        })
                    }
                />
            </AdminDataTableShell>
        </div>
    );
}
