import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Search } from 'lucide-react';
import { sql } from '@/lib/neon/db';
import { RequestsTable } from '@/components/admin/RequestsTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AdminDataTableShell, AdminFilterBar, AdminPageHeader, AdminPagination } from '@/components/admin/primitives';
import { getLatestRequestsForUsers } from '@/lib/admin';
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
import type { RequestStatus } from '@/types';

export const dynamic = 'force-dynamic';

type RequestsSearchParams = Promise<Record<string, string | string[] | undefined>>;

function isRequestStatus(value: string): value is RequestStatus {
    return value === 'draft' || value === 'sent' || value === 'in_progress' || value === 'submitted';
}

type AdminRequestRow = {
    id: string;
    account_id: string | null;
    property_address: string;
    status: string;
    created_at: string;
    utility_categories: string[] | null;
    user_name: string | null;
    user_email: string | null;
    seller_name: string | null;
    seller_email: string | null;
};

async function getRequests(params: { query?: string; status?: RequestStatus; limit: number; offset: number }) {
    if (!sql) return [];

    const q = params.query?.trim() ? `%${params.query.trim()}%` : null;
    let whereClause = sql`TRUE`;

    if (params.status) {
        whereClause = sql`${whereClause} AND r.status = ${params.status}`;
    }

    if (q) {
        whereClause = sql`
            ${whereClause}
            AND (
                r.property_address ILIKE ${q}
                OR r.seller_name ILIKE ${q}
                OR r.seller_email ILIKE ${q}
                OR CAST(r.id AS TEXT) ILIKE ${q}
                OR a.email ILIKE ${q}
                OR a.full_name ILIKE ${q}
            )
        `;
    }

    const result = await sql`
        SELECT
            r.*,
            a.full_name as user_name,
            a.email as user_email
        FROM requests r
        LEFT JOIN accounts a ON r.account_id = a.id
        WHERE ${whereClause}
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT ${params.limit} OFFSET ${params.offset}
    `;

    return result as unknown as AdminRequestRow[];
}

async function getRequestsCount(params: { query?: string; status?: RequestStatus }) {
    if (!sql) return 0;

    const q = params.query?.trim() ? `%${params.query.trim()}%` : null;
    let whereClause = sql`TRUE`;

    if (params.status) {
        whereClause = sql`${whereClause} AND r.status = ${params.status}`;
    }

    if (q) {
        whereClause = sql`
            ${whereClause}
            AND (
                r.property_address ILIKE ${q}
                OR r.seller_name ILIKE ${q}
                OR r.seller_email ILIKE ${q}
                OR CAST(r.id AS TEXT) ILIKE ${q}
                OR a.email ILIKE ${q}
                OR a.full_name ILIKE ${q}
            )
        `;
    }

    const result = await sql`
        SELECT COUNT(*) as count
        FROM requests r
        LEFT JOIN accounts a ON r.account_id = a.id
        WHERE ${whereClause}
    `;

    return Number(result[0]?.count || 0);
}

export default async function RequestsPage({ searchParams }: { searchParams: RequestsSearchParams }) {
    const sp = await resolveSearchParams(searchParams);
    const rawPage = getParam(sp, 'page');
    const rawPageSize = getParam(sp, 'pageSize');

    const page = parsePage(rawPage, 1);
    const pageSize = parsePageSize(rawPageSize, [25, 50, 100], DEFAULT_PAGE_SIZE);
    const query = (getParam(sp, 'q') || '').trim();
    const statusRaw = getParam(sp, 'status');
    const status = statusRaw && isRequestStatus(statusRaw) ? statusRaw : undefined;
    const offset = (page - 1) * pageSize;

    const [requests, total] = await Promise.all([
        getRequests({ query, status, limit: pageSize, offset }),
        getRequestsCount({ query, status }),
    ]);
    const latestRequests = await getLatestRequestsForUsers(
        requests.map((request) => request.account_id).filter((id): id is string => Boolean(id))
    );
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const canonicalPage = clampPage(page, totalPages);

    const baseValues = {
        q: query || undefined,
        status,
        pageSize,
    };

    const buildPageHref = (targetPage: number) =>
        buildAdminHref('/admin/requests', {
            ...baseValues,
            page: targetPage,
        });

    if (shouldCanonicalizePage({ rawPage, rawPageSize, page, canonicalPage, pageSize })) {
        redirect(buildPageHref(canonicalPage));
    }

    return (
        <div className="space-y-4">
            <AdminPageHeader
                title="Request inspection"
                description={`Search ${total.toLocaleString()} seller flows by address, seller, account, lifecycle state, or ID.`}
            />

            <AdminFilterBar>
                <form method="GET" action="/admin/requests" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <input type="hidden" name="page" value="1" />
                    <input type="hidden" name="pageSize" value={pageSize} />

                    <div className="flex flex-1 items-center gap-2">
                        <Input
                            type="search"
                            name="q"
                            placeholder="Search address, seller, user, id..."
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
                            name="status"
                            defaultValue={status || ''}
                            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                        >
                            <option value="">All statuses</option>
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="in_progress">In progress</option>
                            <option value="submitted">Submitted</option>
                        </select>
                        {(query || status) ? (
                            <Link
                                href={buildAdminHref('/admin/requests', { page: 1, pageSize })}
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
                    <RequestsTable requests={requests} latestRequests={latestRequests} />
                </div>
                <AdminPagination
                    page={canonicalPage}
                    pageSize={pageSize}
                    total={total}
                    totalPages={totalPages}
                    prevHref={buildPageHref(Math.max(1, canonicalPage - 1))}
                    nextHref={buildPageHref(Math.min(totalPages, canonicalPage + 1))}
                    buildPageSizeHref={(size) =>
                        buildAdminHref('/admin/requests', {
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
