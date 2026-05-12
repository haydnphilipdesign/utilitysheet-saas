import Link from 'next/link';
import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatAdminDate } from '@/lib/admin/date-format';
import type {
    TestimonialCandidateRow,
    TestimonialCandidateSortDirection,
    TestimonialCandidateSortField,
} from '@/lib/admin/testimonial-candidates';

type TestimonialCandidatesTableProps = {
    candidates: TestimonialCandidateRow[];
    sortBy: TestimonialCandidateSortField;
    sortDir: TestimonialCandidateSortDirection;
    sortHrefs: Record<TestimonialCandidateSortField, string>;
};

function SortIndicator(props: { active: boolean; dir: TestimonialCandidateSortDirection }) {
    if (!props.active) return null;
    return props.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function planBadge(plan: TestimonialCandidateRow['effectivePlan']) {
    if (plan === 'team') {
        return <Badge className="border-indigo-500/30 bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">Team</Badge>;
    }
    if (plan === 'pro') {
        return <Badge className="border-sky-500/30 bg-sky-500/20 text-sky-600 dark:text-sky-300">Pro</Badge>;
    }
    if (plan === 'canceled') return <Badge variant="outline">Canceled</Badge>;
    return <Badge variant="outline">Free</Badge>;
}

export function TestimonialCandidatesTable({
    candidates,
    sortBy,
    sortDir,
    sortHrefs,
}: TestimonialCandidatesTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border/70">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <Link href={sortHrefs.score} className="inline-flex items-center gap-1 hover:text-foreground">
                                Rank
                                <SortIndicator active={sortBy === 'score'} dir={sortDir} />
                            </Link>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <Link href={sortHrefs.totalRequests} className="inline-flex items-center gap-1 hover:text-foreground">
                                Requests
                                <SortIndicator active={sortBy === 'totalRequests'} dir={sortDir} />
                            </Link>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">30 / 90 Days</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <Link href={sortHrefs.lastActivity} className="inline-flex items-center gap-1 hover:text-foreground">
                                Last Activity
                                <SortIndicator active={sortBy === 'lastActivity'} dir={sortDir} />
                            </Link>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <Link href={sortHrefs.created} className="inline-flex items-center gap-1 hover:text-foreground">
                                Created
                                <SortIndicator active={sortBy === 'created'} dir={sortDir} />
                            </Link>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                    {candidates.length === 0 ? (
                        <tr>
                            <td colSpan={10} className="h-28 px-4 text-center text-muted-foreground">
                                No testimonial candidates found for the current filters.
                            </td>
                        </tr>
                    ) : (
                        candidates.map((candidate) => (
                            <tr key={candidate.id} className="hover:bg-secondary/35">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-sm font-semibold">
                                            {candidate.score}
                                        </span>
                                        <span className="text-xs text-muted-foreground">/100</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <Link href={`/admin/users/${candidate.id}`} className="font-medium text-foreground hover:underline">
                                        {candidate.fullName || candidate.email}
                                    </Link>
                                    <div className="mt-1 text-xs text-muted-foreground">{candidate.email}</div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                    <span className="block max-w-[180px] truncate">
                                        {candidate.businessName || 'No business name'}
                                    </span>
                                    {candidate.organizationNames.length ? (
                                        <span className="mt-1 block text-xs">
                                            {candidate.organizationNames.join(', ')}
                                            {candidate.teamSeatQuantity ? ` - ${candidate.teamSeatQuantity} seats` : ''}
                                        </span>
                                    ) : null}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col gap-1">
                                        {planBadge(candidate.effectivePlan)}
                                        <span className="text-xs text-muted-foreground">{candidate.subscriptionStatus}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-medium">{candidate.totalRequests}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {candidate.uniqueProperties} unique properties - {candidate.submittedRequests} seller completed
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-medium">{candidate.requestsLast30Days} / {candidate.requestsLast90Days}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {candidate.activeMonthsLast6} active months
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                    {candidate.lastActivityAt ? formatAdminDate(candidate.lastActivityAt) : 'No activity'}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{formatAdminDate(candidate.accountCreatedAt)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex max-w-[320px] flex-wrap gap-1.5">
                                        {candidate.reasons.slice(0, 4).map((reason) => (
                                            <Badge key={reason} variant="secondary" className="font-normal">
                                                {reason}
                                            </Badge>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Link href={`/admin/users/${candidate.id}`}>
                                        <Button variant="ghost" size="sm">
                                            <ExternalLink className="h-4 w-4" />
                                            View
                                        </Button>
                                    </Link>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
