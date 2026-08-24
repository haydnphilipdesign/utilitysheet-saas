import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { AdminAccountPreview } from '@/components/admin/AdminAccountPreview';
import { StatusBadge } from '@/components/ui/status-badge';
import { AdminEmptyState } from '@/components/admin/primitives';
import { formatAdminDate } from '@/lib/admin/date-format';
import type { RecentRequestSummary } from '@/lib/admin/operations-overview';
import type { UserLatestRequest } from '@/lib/admin';

export function RecentRequestsList({
    requests,
    latestRequests = {},
}: {
    requests: RecentRequestSummary[];
    latestRequests?: Record<string, UserLatestRequest[]>;
}) {
    if (requests.length === 0) {
        return (
            <AdminEmptyState
                title="No requests yet"
                description="New requests appear here as soon as a customer creates one."
            />
        );
    }

    return (
        <ul className="divide-y divide-border/70">
            {requests.map((request) => (
                <li key={request.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                        <Link
                            href={`/admin/requests/${request.id}`}
                            className="group flex items-center gap-1.5 rounded text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <span className="truncate group-hover:underline">{request.propertyAddress}</span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                        {request.accountId ? (
                            <AdminAccountPreview
                                account={{
                                    id: request.accountId,
                                    name: request.userName,
                                    email: request.userEmail,
                                }}
                                latestRequests={latestRequests[request.accountId] || []}
                                align="inline"
                                className="mt-0.5 text-xs text-muted-foreground"
                            >
                                <span className="truncate">{request.userName || request.userEmail || 'Unknown user'}</span>
                            </AdminAccountPreview>
                        ) : (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">Unknown user</p>
                        )}
                    </div>
                    <StatusBadge status={request.status} className="shrink-0" />
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {formatAdminDate(request.createdAt)}
                    </span>
                </li>
            ))}
        </ul>
    );
}
