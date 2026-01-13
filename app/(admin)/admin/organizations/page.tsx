import { sql } from '@/lib/neon/db';
import { OrgTable } from '@/components/admin/OrgTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type OrgsSearchParams = {
    q?: string;
    page?: string;
};

function parseIntParam(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
}

type AdminOrgRow = {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    created_at: string;
    member_count: number;
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
        SELECT o.*, 
        (SELECT count(*) FROM organization_members WHERE organization_id = o.id) as member_count 
        FROM organizations o 
        WHERE ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT ${params.limit} OFFSET ${params.offset}
    `;

    return (data as unknown as Array<AdminOrgRow & { member_count: string | number }>).map((org) => ({
        ...org,
        member_count: Number(org.member_count || 0),
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
    const page = Math.max(1, parseIntParam(searchParams.page, 1));
    const limit = 50;
    const offset = (page - 1) * limit;

    const query = searchParams.q?.trim() || '';

    const [orgs, total] = await Promise.all([
        getOrgs({ query, limit, offset }),
        getOrgsCount({ query }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    async function searchAction(formData: FormData) {
        'use server';
        const q = String(formData.get('q') || '').trim();
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        const qs = params.toString();
        redirect(qs ? `/admin/organizations?${qs}` : '/admin/organizations');
    }

    function buildPageHref(nextPage: number) {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        params.set('page', String(nextPage));
        return `/admin/organizations?${params.toString()}`;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Organizations</h2>
                    <p className="text-muted-foreground">
                        Manage B2B accounts and teams ({total}).
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <form action={searchAction} className="flex items-center gap-2">
                    <Input
                        name="q"
                        placeholder="Search name, slug, id..."
                        defaultValue={query}
                        className="w-full sm:w-96"
                    />
                    <Button type="submit" size="icon" variant="outline" aria-label="Search">
                        <Search className="h-4 w-4" />
                    </Button>
                    {query && (
                        <Link href="/admin/organizations" className="text-xs text-muted-foreground hover:text-foreground">
                            Reset
                        </Link>
                    )}
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
            <OrgTable orgs={orgs} />
        </div>
    );
}
