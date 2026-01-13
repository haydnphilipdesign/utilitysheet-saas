import { sql } from '@/lib/neon/db';
import { RequestsTable } from '@/components/admin/RequestsTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { RequestStatus } from '@/types';

export const dynamic = 'force-dynamic';

type RequestsSearchParams = {
    q?: string;
    status?: string;
    page?: string;
};

function parseIntParam(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
}

function isRequestStatus(value: string): value is RequestStatus {
    return value === 'draft' || value === 'sent' || value === 'in_progress' || value === 'submitted';
}

type AdminRequestRow = {
    id: string;
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
        ORDER BY r.created_at DESC
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
    const page = Math.max(1, parseIntParam(searchParams.page, 1));
    const limit = 50;
    const offset = (page - 1) * limit;

    const query = searchParams.q?.trim() || '';
    const status = searchParams.status && isRequestStatus(searchParams.status) ? searchParams.status : undefined;

    const [requests, total] = await Promise.all([
        getRequests({ query, status, limit, offset }),
        getRequestsCount({ query, status }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    async function searchAction(formData: FormData) {
        "use server";
        const q = String(formData.get('q') || '').trim();
        const status = String(formData.get('status') || '').trim();

        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (status && status !== 'all') params.set('status', status);

        const qs = params.toString();
        redirect(qs ? `/admin/requests?${qs}` : '/admin/requests');
    }

    function buildPageHref(nextPage: number) {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (status) params.set('status', status);
        params.set('page', String(nextPage));
        return `/admin/requests?${params.toString()}`;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Request Inspector</h2>
                    <p className="text-muted-foreground">
                        View and manage all utility requests ({total}).
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <form action={searchAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2">
                        <Input
                            type="search"
                            name="q"
                            placeholder="Search address, seller, user, id..."
                            defaultValue={query}
                            className="w-full sm:w-96"
                        />
                        <Button type="submit" size="icon" variant="outline" aria-label="Search">
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            name="status"
                            defaultValue={status || 'all'}
                            className="h-7 rounded-md border border-border bg-input/20 px-2 text-xs text-foreground"
                        >
                            <option value="all">All statuses</option>
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="in_progress">In progress</option>
                            <option value="submitted">Submitted</option>
                        </select>
                        {(query || status) && (
                            <Link href="/admin/requests" className="text-xs text-muted-foreground hover:text-foreground">
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

            <RequestsTable requests={requests} />
        </div>
    );
}
