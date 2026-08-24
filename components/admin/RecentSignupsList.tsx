import Link from 'next/link';
import { AdminEmptyState } from '@/components/admin/primitives';
import { Badge } from '@/components/ui/badge';
import { formatAdminDate } from '@/lib/admin/date-format';
import type { RecentSignupSummary } from '@/lib/admin/operations-overview';
import { cn } from '@/lib/utils';

/**
 * A new account is only interesting once you know whether it did anything. The progress
 * label answers that in one glance so the operator does not have to open each profile.
 */
function describeProgress(signup: RecentSignupSummary): { label: string; tone: 'idle' | 'started' | 'live' } {
    if (signup.submittedCount > 0) {
        return { label: `${signup.submittedCount} submitted`, tone: 'live' };
    }
    if (signup.requestCount > 0) {
        return { label: `${signup.requestCount} request${signup.requestCount === 1 ? '' : 's'}`, tone: 'started' };
    }
    return { label: 'No request yet', tone: 'idle' };
}

export function RecentSignupsList({ signups }: { signups: RecentSignupSummary[] }) {
    if (signups.length === 0) {
        return (
            <AdminEmptyState
                title="No signups yet"
                description="New customer accounts appear here as they register."
            />
        );
    }

    return (
        <ul className="divide-y divide-border/70">
            {signups.map((signup) => {
                const progress = describeProgress(signup);
                const displayName = signup.name || signup.email || 'Unknown account';

                return (
                    <li key={signup.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                            <Link
                                href={`/admin/users/${signup.id}`}
                                className="block truncate rounded text-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {displayName}
                            </Link>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                                <span
                                    className={cn(
                                        progress.tone === 'live'
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : progress.tone === 'started'
                                                ? 'text-foreground'
                                                : 'text-muted-foreground'
                                    )}
                                >
                                    {progress.label}
                                </span>
                                {signup.plan && signup.plan !== 'free' ? (
                                    <Badge variant="outline" className="h-4 px-1 text-[10px] capitalize">
                                        {signup.plan}
                                    </Badge>
                                ) : null}
                            </p>
                        </div>
                        <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            {formatAdminDate(signup.createdAt)}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
