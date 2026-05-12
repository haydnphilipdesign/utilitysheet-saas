import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Clock, CreditCard, Filter, Sparkles } from 'lucide-react';
import { TestimonialCandidatesTable } from '@/components/admin/TestimonialCandidatesTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    AdminDataTableShell,
    AdminFilterBar,
    AdminPageHeader,
    AdminPagination,
    AdminStatStrip,
} from '@/components/admin/primitives';
import {
    getTestimonialCandidates,
    type TestimonialCandidateSortDirection,
    type TestimonialCandidateSortField,
} from '@/lib/admin/testimonial-candidates';
import {
    DEFAULT_PAGE_SIZE,
    buildAdminHref,
    clampPage,
    getParam,
    parseDirection,
    parsePage,
    parsePageSize,
    parsePositiveInt,
    resolveSearchParams,
    shouldCanonicalizePage,
} from '@/lib/admin/list-query';

export const dynamic = 'force-dynamic';

type CandidatesSearchParams = Promise<Record<string, string | string[] | undefined>>;

function isPlanFilter(value: string): value is 'all' | 'pro' | 'team' {
    return value === 'all' || value === 'pro' || value === 'team';
}

function isActiveFilter(value: string): value is 'all' | '30' | '90' {
    return value === 'all' || value === '30' || value === '90';
}

function isSortField(value: string): value is TestimonialCandidateSortField {
    return value === 'score' || value === 'totalRequests' || value === 'lastActivity' || value === 'created';
}

function parseBooleanParam(value: string | undefined, fallback: boolean): boolean {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
}

function nextSortDir(
    currentSortBy: TestimonialCandidateSortField,
    currentSortDir: TestimonialCandidateSortDirection,
    field: TestimonialCandidateSortField
): TestimonialCandidateSortDirection {
    if (currentSortBy === field) return currentSortDir === 'asc' ? 'desc' : 'asc';
    return 'desc';
}

export default async function TestimonialCandidatesPage({ searchParams }: { searchParams: CandidatesSearchParams }) {
    const sp = await resolveSearchParams(searchParams);
    const rawPage = getParam(sp, 'page');
    const rawPageSize = getParam(sp, 'pageSize');

    const page = parsePage(rawPage, 1);
    const pageSize = parsePageSize(rawPageSize, [25, 50, 100], DEFAULT_PAGE_SIZE);
    const planRaw = getParam(sp, 'plan');
    const activeRaw = getParam(sp, 'active');
    const minRequestsRaw = getParam(sp, 'minRequests');
    const payingOnly = parseBooleanParam(getParam(sp, 'payingOnly'), true);
    const excludeInternalTest = parseBooleanParam(getParam(sp, 'excludeInternalTest'), true);
    const sortRaw = getParam(sp, 'sort');
    const dirRaw = getParam(sp, 'dir');

    const plan = planRaw && isPlanFilter(planRaw) ? planRaw : 'all';
    const active = activeRaw && isActiveFilter(activeRaw) ? activeRaw : 'all';
    const minRequests = parsePositiveInt(minRequestsRaw, 1);
    const sortBy: TestimonialCandidateSortField = sortRaw && isSortField(sortRaw) ? sortRaw : 'score';
    const sortDir = parseDirection(dirRaw, 'desc');
    const offset = (page - 1) * pageSize;

    const { candidates, total } = await getTestimonialCandidates({
        payingOnly,
        plan,
        active,
        minRequests,
        excludeInternalTest,
        sortBy,
        sortDir,
        limit: pageSize,
        offset,
    });

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const canonicalPage = clampPage(page, totalPages);
    const baseValues = {
        payingOnly: String(payingOnly),
        plan,
        active,
        minRequests,
        excludeInternalTest: String(excludeInternalTest),
        pageSize,
        sort: sortBy,
        dir: sortDir,
    };

    const buildPageHref = (targetPage: number) =>
        buildAdminHref('/admin/testimonial-candidates', {
            ...baseValues,
            page: targetPage,
        });

    if (shouldCanonicalizePage({ rawPage, rawPageSize, page, canonicalPage, pageSize })) {
        redirect(buildPageHref(canonicalPage));
    }

    const buildSortHref = (field: TestimonialCandidateSortField) =>
        buildAdminHref('/admin/testimonial-candidates', {
            ...baseValues,
            sort: field,
            dir: nextSortDir(sortBy, sortDir, field),
            page: 1,
        });

    const resetHref = buildAdminHref('/admin/testimonial-candidates', {
        page: 1,
        pageSize,
        payingOnly: 'true',
        excludeInternalTest: 'true',
        minRequests: 1,
        plan: 'all',
        active: 'all',
        sort: 'score',
        dir: 'desc',
    });

    const active30 = candidates.filter((candidate) => candidate.requestsLast30Days > 0).length;
    const teamCount = candidates.filter((candidate) => candidate.effectivePlan === 'team').length;
    const averageScore = candidates.length
        ? Math.round(candidates.reduce((sum, candidate) => sum + candidate.score, 0) / candidates.length)
        : 0;

    return (
        <div className="space-y-4">
            <AdminPageHeader
                title="Testimonial Candidates"
                description={`Rank paying customers by UtilitySheet activity, recency, consistency, setup health, and data quality (${total.toLocaleString()}).`}
            />

            <AdminStatStrip
                stats={[
                    { label: 'Candidates', value: total.toLocaleString(), icon: Sparkles },
                    { label: 'Avg Score', value: averageScore ? `${averageScore}/100` : '0/100', icon: Filter },
                    { label: 'Teams On Page', value: teamCount.toLocaleString(), icon: CreditCard },
                    { label: 'Active 30d On Page', value: active30.toLocaleString(), icon: Clock },
                ]}
            />

            <AdminFilterBar>
                <form method="GET" action="/admin/testimonial-candidates" className="flex flex-col gap-3">
                    <input type="hidden" name="page" value="1" />
                    <input type="hidden" name="pageSize" value={pageSize} />
                    <input type="hidden" name="sort" value={sortBy} />
                    <input type="hidden" name="dir" value={sortDir} />

                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                name="payingOnly"
                                defaultValue={String(payingOnly)}
                                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            >
                                <option value="true">Paying users only</option>
                                <option value="false">Include free users</option>
                            </select>
                            <select
                                name="excludeInternalTest"
                                defaultValue={String(excludeInternalTest)}
                                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            >
                                <option value="true">Exclude internal/test</option>
                                <option value="false">Include internal/test</option>
                            </select>
                            <select
                                name="plan"
                                defaultValue={plan}
                                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            >
                                <option value="all">Pro and Teams</option>
                                <option value="pro">Pro users</option>
                                <option value="team">Teams users</option>
                            </select>
                            <select
                                name="active"
                                defaultValue={active}
                                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            >
                                <option value="all">Any activity</option>
                                <option value="30">Active last 30 days</option>
                                <option value="90">Active last 90 days</option>
                            </select>
                            <Input
                                type="number"
                                min={0}
                                name="minRequests"
                                defaultValue={minRequests}
                                className="h-9 w-36"
                                aria-label="Minimum request count"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button type="submit" variant="outline" size="sm">
                                Apply filters
                            </Button>
                            <Link href={resetHref} className="text-xs text-muted-foreground hover:text-foreground">
                                Reset
                            </Link>
                        </div>
                    </div>
                </form>
            </AdminFilterBar>

            <AdminDataTableShell>
                <TestimonialCandidatesTable
                    candidates={candidates}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    sortHrefs={{
                        score: buildSortHref('score'),
                        totalRequests: buildSortHref('totalRequests'),
                        lastActivity: buildSortHref('lastActivity'),
                        created: buildSortHref('created'),
                    }}
                />

                <AdminPagination
                    page={canonicalPage}
                    pageSize={pageSize}
                    total={total}
                    totalPages={totalPages}
                    prevHref={buildPageHref(Math.max(1, canonicalPage - 1))}
                    nextHref={buildPageHref(Math.min(totalPages, canonicalPage + 1))}
                    buildPageSizeHref={(size) =>
                        buildAdminHref('/admin/testimonial-candidates', {
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
