import Link from 'next/link';
import { getStatusStyle } from '@/components/ui/status-badge';
import { buildAdminHref } from '@/lib/admin/list-query';
import type { RequestStatusBreakdown } from '@/lib/admin/operations-overview';
import { cn } from '@/lib/utils';
import type { RequestStatus } from '@/types';

const LIFECYCLE_ORDER: readonly RequestStatus[] = ['draft', 'sent', 'in_progress', 'submitted'];

/**
 * Solid fills for the stacked bar. The hues match `STATUS_STYLES` in
 * `components/ui/status-badge.tsx` so a segment and its badge always read as the same
 * status; only the opacity differs, because a 15% tint is invisible at bar height.
 */
const SEGMENT_FILLS: Record<string, string> = {
    draft: 'bg-muted-foreground/35',
    sent: 'bg-blue-500/70',
    in_progress: 'bg-amber-500/80',
    submitted: 'bg-emerald-500/80',
};

function orderStatuses(rows: RequestStatusBreakdown[]): RequestStatusBreakdown[] {
    const known = LIFECYCLE_ORDER.map((status) => rows.find((row) => row.status === status)).filter(
        (row): row is RequestStatusBreakdown => Boolean(row)
    );
    const unknown = rows
        .filter((row) => !LIFECYCLE_ORDER.includes(row.status as RequestStatus))
        .sort((a, b) => a.status.localeCompare(b.status));

    return [...known, ...unknown];
}

export function RequestLifecycleBar({ rows, total }: { rows: RequestStatusBreakdown[]; total: number }) {
    const ordered = orderStatuses(rows).filter((row) => row.count > 0);

    if (ordered.length === 0 || total <= 0) {
        return <p className="text-sm text-muted-foreground">No requests recorded yet.</p>;
    }

    return (
        <div className="space-y-3">
            <div
                className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary"
                role="img"
                aria-label={ordered
                    .map((row) => `${getStatusStyle(row.status).label}: ${row.count}`)
                    .join(', ')}
            >
                {ordered.map((row) => (
                    <div
                        key={row.status}
                        className={cn('h-full', SEGMENT_FILLS[row.status] || 'bg-muted-foreground/35')}
                        style={{ width: `${(row.count / total) * 100}%` }}
                    />
                ))}
            </div>

            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {ordered.map((row) => (
                    <li key={row.status}>
                        <Link
                            href={buildAdminHref('/admin/requests', { status: row.status })}
                            className="group flex items-center gap-2 rounded text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <span
                                aria-hidden="true"
                                className={cn('h-2 w-2 shrink-0 rounded-full', SEGMENT_FILLS[row.status] || 'bg-muted-foreground/35')}
                            />
                            <span className="text-muted-foreground group-hover:text-foreground">
                                {getStatusStyle(row.status).label}
                            </span>
                            <span className="font-semibold tabular-nums text-foreground">{row.count.toLocaleString()}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
