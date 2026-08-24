import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, Search, Users } from 'lucide-react';
import { sql } from '@/lib/neon/db';
import { OrgTable } from '@/components/admin/OrgTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AdminDataTableShell, AdminFilterBar, AdminPageHeader, AdminPagination, AdminStatStrip } from '@/components/admin/primitives';
import {
    DEFAULT_PAGE_SIZE,
    buildAdminHref,
    clampPage,
    getParam,
    parseOrgBillingFilter,
    parsePage,
    parsePageSize,
    resolveSearchParams,
    shouldCanonicalizePage,
    type OrgBillingFilter,
} from '@/lib/admin/list-query';
import { classifyAdminWorkspace, type AdminWorkspaceKind } from '@/lib/admin/workspace-classification';

export const dynamic = 'force-dynamic';

type OrgsSearchParams = Promise<Record<string, string | string[] | undefined>>;

type AdminOrgRow = {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    subscription_status: string | null;
    seat_quantity: number;
    created_at: string;
    member_count: number;
    admin_names: string[];
    admin_count: number;
    workspace_kind: AdminWorkspaceKind;
};

/**
 * `billing` filters on the workspace's own subscription status, which is what the operations overview
 * counts. It is deliberately narrower than `workspace_kind`, which also considers member count.
 */
async function getOrgs(params: { query?: string; billing?: OrgBillingFilter; limit: number; offset: number }) {
    if (!sql) return [];

    const q = params.query?.trim() ? `%${params.query.trim()}%` : null;
    let whereClause = sql`TRUE`;
    if (params.billing === 'team') {
        whereClause = sql`${whereClause} AND o.subscription_status = 'team'`;
    }
    if (params.billing === 'non-team') {
        whereClause = sql`${whereClause} AND COALESCE(o.subscription_status, 'free') != 'team'`;
    }
    if (q) {
        whereClause = sql`
            ${whereClause}
            AND (
                o.name ILIKE ${q}
                OR o.slug ILIKE ${q}
                OR CAST(o.id AS TEXT) ILIKE ${q}
            )
        `;
    }

    const data = await sql`
        SELECT
            o.*,
            (SELECT count(*) FROM organization_members WHERE organization_id = o.id) as member_count,
            (
                SELECT count(*)
                FROM organization_members om
                WHERE om.organization_id = o.id AND om.role = 'admin'
            ) as admin_count,
            COALESCE(
                (
                    SELECT array_agg(COALESCE(a.full_name, a.email) ORDER BY COALESCE(a.full_name, a.email))
                    FROM organization_members om
                    JOIN accounts a ON a.id = om.account_id
                    WHERE om.organization_id = o.id AND om.role = 'admin'
                ),
                ARRAY[]::text[]
            ) as admin_names
        FROM organizations o
        WHERE ${whereClause}
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT ${params.limit} OFFSET ${params.offset}
    `;

    return (data as unknown as Array<Omit<AdminOrgRow, 'workspace_kind'> & {
        member_count: string | number;
        admin_count: string | number;
        seat_quantity: string | number;
    }>).map((org) => {
        const memberCount = Number(org.member_count || 0);
        return {
            ...org,
            member_count: memberCount,
            admin_count: Number(org.admin_count || 0),
            seat_quantity: Number(org.seat_quantity || 0),
            admin_names: org.admin_names || [],
            workspace_kind: classifyAdminWorkspace({
                subscriptionStatus: org.subscription_status,
                memberCount,
            }),
        };
    });
}

/**
 * Unfiltered workspace totals. These moved here from the operations overview: Team adoption is a
 * question you ask while looking at workspaces, not a daily operations figure. `team` matches the
 * workspace's own Team entitlement, the same predicate as the `billing=team` filter.
 */
async function getWorkspaceTotals() {
    if (!sql) return { total: 0, team: 0, nonTeam: 0 };

    const result = await sql`
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE subscription_status = 'team')::int AS team,
            COUNT(*) FILTER (WHERE COALESCE(subscription_status, 'free') != 'team')::int AS non_team
        FROM organizations
    `;

    return {
        total: Number(result[0]?.total || 0),
        team: Number(result[0]?.team || 0),
        nonTeam: Number(result[0]?.non_team || 0),
    };
}

async function getOrgsCount(params: { query?: string; billing?: OrgBillingFilter }) {
    if (!sql) return 0;

    const q = params.query?.trim() ? `%${params.query.trim()}%` : null;
    let whereClause = sql`TRUE`;
    if (params.billing === 'team') {
        whereClause = sql`${whereClause} AND subscription_status = 'team'`;
    }
    if (params.billing === 'non-team') {
        whereClause = sql`${whereClause} AND COALESCE(subscription_status, 'free') != 'team'`;
    }
    if (q) {
        whereClause = sql`
            ${whereClause}
            AND (
                name ILIKE ${q}
                OR slug ILIKE ${q}
                OR CAST(id AS TEXT) ILIKE ${q}
            )
        `;
    }

    const result = await sql`SELECT COUNT(*) as count FROM organizations WHERE ${whereClause}`;
    return Number(result[0]?.count || 0);
}

export default async function OrgsPage({ searchParams }: { searchParams: OrgsSearchParams }) {
    const sp = await resolveSearchParams(searchParams);
    const rawPage = getParam(sp, 'page');
    const rawPageSize = getParam(sp, 'pageSize');

    const page = parsePage(rawPage, 1);
    const pageSize = parsePageSize(rawPageSize, [25, 50, 100], DEFAULT_PAGE_SIZE);
    const query = (getParam(sp, 'q') || '').trim();
    const billing = parseOrgBillingFilter(getParam(sp, 'billing'));
    const offset = (page - 1) * pageSize;

    const [orgs, total, workspaceTotals] = await Promise.all([
        getOrgs({ query, billing, limit: pageSize, offset }),
        getOrgsCount({ query, billing }),
        getWorkspaceTotals(),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const canonicalPage = clampPage(page, totalPages);

    const baseValues = {
        q: query || undefined,
        billing,
        pageSize,
    };

    const buildPageHref = (targetPage: number) =>
        buildAdminHref('/admin/organizations', {
            ...baseValues,
            page: targetPage,
        });

    if (shouldCanonicalizePage({ rawPage, rawPageSize, page, canonicalPage, pageSize })) {
        redirect(buildPageHref(canonicalPage));
    }

    return (
        <div className="space-y-4">
            <AdminPageHeader
                title="Workspaces"
                description={`Inspect ${total.toLocaleString()} account workspaces. Team organizations are identified by Team entitlement, not workspace creation alone.`}
            />

            <AdminStatStrip
                stats={[
                    {
                        label: 'Team workspaces',
                        value: workspaceTotals.team.toLocaleString(),
                        hint: 'Active Team entitlement. This is the team-adoption signal.',
                        icon: Building2,
                    },
                    {
                        label: 'Personal or default',
                        value: workspaceTotals.nonTeam.toLocaleString(),
                        hint: 'Automatically created or non-Team workspaces, shown as account context.',
                        icon: Users,
                    },
                    {
                        label: 'All workspaces',
                        value: workspaceTotals.total.toLocaleString(),
                        hint: 'Every organization record, regardless of billing.',
                        icon: Building2,
                    },
                ]}
            />

            <AdminFilterBar>
                <form method="GET" action="/admin/organizations" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <input type="hidden" name="page" value="1" />
                    <input type="hidden" name="pageSize" value={pageSize} />
                    <div className="flex flex-1 items-center gap-2">
                        <Input
                            name="q"
                            placeholder="Search name, slug, id..."
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
                            name="billing"
                            aria-label="Workspace billing"
                            defaultValue={billing || ''}
                            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                        >
                            <option value="">All workspaces</option>
                            <option value="team">Team billing</option>
                            <option value="non-team">Personal/default</option>
                        </select>
                        {(query || billing) ? (
                            <Link
                                href={buildAdminHref('/admin/organizations', { page: 1, pageSize })}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                Reset
                            </Link>
                        ) : null}
                    </div>
                </form>
            </AdminFilterBar>

            <AdminDataTableShell>
                <div className="p-4">
                    <OrgTable orgs={orgs} />
                </div>
                <AdminPagination
                    page={canonicalPage}
                    pageSize={pageSize}
                    total={total}
                    totalPages={totalPages}
                    prevHref={buildPageHref(Math.max(1, canonicalPage - 1))}
                    nextHref={buildPageHref(Math.min(totalPages, canonicalPage + 1))}
                    buildPageSizeHref={(size) =>
                        buildAdminHref('/admin/organizations', {
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
