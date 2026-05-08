import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Search } from 'lucide-react';
import { sql } from '@/lib/neon/db';
import { OrgTable } from '@/components/admin/OrgTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
};

async function getOrgs(params: { query?: string; limit: number; offset: number }) {
    if (!sql) return [];

    const q = params.query?.trim() ? `%${params.query.trim()}%` : null;
    let whereClause = sql`TRUE`;
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

    return (data as unknown as Array<AdminOrgRow & {
        member_count: string | number;
        admin_count: string | number;
        seat_quantity: string | number;
    }>).map((org) => ({
        ...org,
        member_count: Number(org.member_count || 0),
        admin_count: Number(org.admin_count || 0),
        seat_quantity: Number(org.seat_quantity || 0),
        admin_names: org.admin_names || [],
    }));
}

async function getOrgsCount(params: { query?: string }) {
    if (!sql) return 0;

    const q = params.query?.trim() ? `%${params.query.trim()}%` : null;
    let whereClause = sql`TRUE`;
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
    const offset = (page - 1) * pageSize;

    const [orgs, total] = await Promise.all([
        getOrgs({ query, limit: pageSize, offset }),
        getOrgsCount({ query }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const canonicalPage = clampPage(page, totalPages);

    const baseValues = {
        q: query || undefined,
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
                title="Organizations"
                description={`Manage B2B accounts and team workspaces (${total.toLocaleString()}).`}
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
                    {query ? (
                        <Link
                            href={buildAdminHref('/admin/organizations', { page: 1, pageSize })}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            Reset
                        </Link>
                    ) : null}
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
