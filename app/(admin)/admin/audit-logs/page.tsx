import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ComponentType } from 'react';
import { searchAuditLogs } from '@/lib/admin';
import { format } from 'date-fns';
import {
    ArrowUpDown,
    Ban,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    FileText,
    Mail,
    Pencil,
    Search,
    Shield,
    User,
    UserCheck,
} from 'lucide-react';
import type { AdminAction } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

type AuditLogsSearchParams = {
    q?: string;
    action?: string;
    page?: string;
};

function parseIntParam(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
}

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
};

const actionColors: Partial<Record<AdminAction, string>> = {
    impersonation_started: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    impersonation_ended: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    user_banned: 'bg-red-500/10 text-red-500 border-red-500/20',
    user_unbanned: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    role_changed: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    plan_changed: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    request_status_changed: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    request_seller_updated: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    request_reminder_sent: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    user_updated: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export default async function AuditLogsPage({ searchParams }: { searchParams: AuditLogsSearchParams }) {
    const page = Math.max(1, parseIntParam(searchParams.page, 1));
    const limit = 50;
    const offset = (page - 1) * limit;

    const query = searchParams.q?.trim() || '';
    const action = searchParams.action && isAdminAction(searchParams.action) ? searchParams.action : undefined;

    const { logs, total } = await searchAuditLogs({ limit, offset, query, action });
    const totalPages = Math.max(1, Math.ceil(total / limit));

    async function searchAction(formData: FormData) {
        'use server';
        const q = String(formData.get('q') || '').trim();
        const action = String(formData.get('action') || '').trim();

        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (action && action !== 'all') params.set('action', action);

        const qs = params.toString();
        redirect(qs ? `/admin/audit-logs?${qs}` : '/admin/audit-logs');
    }

    function buildPageHref(nextPage: number) {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (action) params.set('action', action);
        params.set('page', String(nextPage));
        return `/admin/audit-logs?${params.toString()}`;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
                <p className="text-muted-foreground mt-1">Track all admin actions and changes ({total})</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <form action={searchAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2">
                        <Input
                            name="q"
                            placeholder="Search action, admin, target, metadata..."
                            defaultValue={query}
                            className="w-full sm:w-96"
                        />
                        <Button type="submit" size="icon" variant="outline" aria-label="Search">
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            name="action"
                            defaultValue={action || 'all'}
                            className="h-7 rounded-md border border-border bg-input/20 px-2 text-xs text-foreground"
                        >
                            <option value="all">All actions</option>
                            {adminActionFilters.map((action) => (
                                <option key={action} value={action}>
                                    {action.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                        {(query || action) && (
                            <Link href="/admin/audit-logs" className="text-xs text-muted-foreground hover:text-foreground">
                                Reset
                            </Link>
                        )}
                    </div>
                </form>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p className="text-xs text-muted-foreground">
                        Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <Link
                            href={buildPageHref(Math.max(1, page - 1))}
                            aria-disabled={page <= 1}
                            className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                        >
                            <Button variant="outline" size="sm" disabled={page <= 1}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <Link
                            href={buildPageHref(Math.min(totalPages, page + 1))}
                            aria-disabled={page >= totalPages}
                            className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                        >
                            <Button variant="outline" size="sm" disabled={page >= totalPages}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            <div className="border border-border rounded-xl bg-card/50 backdrop-blur-sm overflow-hidden">
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <FileText className="h-12 w-12 mb-4 opacity-50" />
                        <p>No audit logs yet</p>
                        <p className="text-sm">Admin actions will appear here</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {logs.map((log) => {
                            const action = log.action as AdminAction;
                            const Icon = actionIcons[action] || FileText;
                            const colorClass = actionColors[action] || 'bg-gray-500/10 text-gray-500';

                            return (
                                <div key={log.id} className="p-4 hover:bg-secondary/30 transition-colors">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2 rounded-lg ${colorClass}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className={colorClass}>
                                                    {String(log.action).replace(/_/g, ' ')}
                                                </Badge>
                                                <span className="text-sm text-muted-foreground">
                                                    by{' '}
                                                    <span className="font-medium text-foreground">
                                                        {log.admin_name || log.admin_email}
                                                    </span>
                                                </span>
                                                {log.target_email && (
                                                    <>
                                                        <span className="text-muted-foreground">&rarr;</span>
                                                        <span className="text-sm font-medium text-foreground">
                                                            {log.target_name || log.target_email}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                                            </p>
                                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                <pre className="mt-2 text-xs text-muted-foreground bg-secondary/50 p-2 rounded overflow-x-auto">
                                                    {JSON.stringify(log.metadata, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
