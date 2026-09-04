'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import {
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    FileText,
    Loader2,
    Plus,
    RotateCcw,
    Search,
    SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

import { RequestListActions } from '@/components/requests/RequestListActions';
import { PACKET_MODE_SHORT_LABELS } from '@/lib/packet/modules';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { trackEvent } from '@/lib/analytics/events';
import { generatePacketPdf } from '@/lib/pdf-generator';
import {
    DEFAULT_REQUEST_LIST_SORT,
    REQUESTS_DEFAULT_PAGE_SIZE,
    normalizeRequestListParams,
} from '@/lib/requests/listing';
import type { Request } from '@/types';

type RequestListResponse = {
    data: Request[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
};

const EMPTY_META: Omit<RequestListResponse, 'data'> = {
    total: 0,
    page: 1,
    limit: REQUESTS_DEFAULT_PAGE_SIZE,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
};

function formatDate(value: string | null | undefined, pattern = 'MMM d, yyyy') {
    if (!value) return '—';
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? '—' : format(parsed, pattern);
}

export default function RequestsPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const serializedSearchParams = searchParams.toString();
    const listParams = useMemo(
        () => normalizeRequestListParams(new URLSearchParams(serializedSearchParams)),
        [serializedSearchParams]
    );

    const [requests, setRequests] = useState<Request[]>([]);
    const [meta, setMeta] = useState(EMPTY_META);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    const [searchQuery, setSearchQuery] = useState(listParams.search || '');
    const [downloadingPdfToken, setDownloadingPdfToken] = useState<string | null>(null);
    const [sendingReminderRequestId, setSendingReminderRequestId] = useState<string | null>(null);

    const navigateWithParams = useCallback((
        updates: Record<string, string | number | null | undefined>,
        mode: 'push' | 'replace' = 'push'
    ) => {
        const next = new URLSearchParams(serializedSearchParams);
        for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === undefined || value === '') {
                next.delete(key);
            } else {
                next.set(key, String(value));
            }
        }

        const query = next.toString();
        router[mode](`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    }, [pathname, router, serializedSearchParams]);

    const clearFilters = useCallback(() => {
        router.push(pathname, { scroll: false });
    }, [pathname, router]);

    useEffect(() => {
        setSearchQuery(listParams.search || '');
    }, [listParams.search]);

    useEffect(() => {
        const normalizedInput = searchQuery.trim();
        if (normalizedInput === (listParams.search || '')) return;

        const timeout = window.setTimeout(() => {
            navigateWithParams({
                q: normalizedInput || null,
                page: null,
            }, 'replace');
        }, 350);

        return () => window.clearTimeout(timeout);
    }, [listParams.search, navigateWithParams, searchQuery]);

    useEffect(() => {
        const controller = new AbortController();

        async function fetchRequests() {
            setLoading(true);
            setError(null);

            const query = new URLSearchParams({
                page: String(listParams.page),
                limit: String(REQUESTS_DEFAULT_PAGE_SIZE),
            });
            if (listParams.search) query.set('q', listParams.search);
            if (listParams.status !== 'all') query.set('status', listParams.status);
            if (listParams.sort !== DEFAULT_REQUEST_LIST_SORT) query.set('sort', listParams.sort);

            try {
                const response = await fetch(`/api/requests?${query.toString()}`, {
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error('Unable to load requests');
                }

                const data = await response.json() as RequestListResponse;
                if (controller.signal.aborted) return;

                setRequests(Array.isArray(data.data) ? data.data : []);
                setMeta({
                    total: Number(data.total) || 0,
                    page: Number(data.page) || 1,
                    limit: Number(data.limit) || REQUESTS_DEFAULT_PAGE_SIZE,
                    totalPages: Number(data.totalPages) || 0,
                    hasPreviousPage: Boolean(data.hasPreviousPage),
                    hasNextPage: Boolean(data.hasNextPage),
                });

                if (data.page && data.page !== listParams.page) {
                    navigateWithParams({
                        page: data.page === 1 ? null : data.page,
                    }, 'replace');
                }
            } catch (fetchError) {
                if (controller.signal.aborted) return;
                console.error('Error fetching requests:', fetchError);
                setRequests([]);
                setMeta(EMPTY_META);
                setError('Unable to load requests. Check your connection and try again.');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        fetchRequests();
        return () => controller.abort();
    }, [
        listParams.page,
        listParams.search,
        listParams.sort,
        listParams.status,
        navigateWithParams,
        retryKey,
    ]);

    const copySellerLink = useCallback(async (request: Request) => {
        const token = request.seller_token || request.public_token;
        if (!token) return;

        try {
            await navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
            toast.success('Seller link copied');
        } catch {
            toast.error('Failed to copy seller link');
        }
    }, []);

    const downloadPdf = useCallback(async (request: Request) => {
        if (!request.public_token) return;
        setDownloadingPdfToken(request.public_token);
        try {
            await generatePacketPdf(request.public_token);
            toast.success('PDF downloaded successfully');
        } catch (downloadError) {
            console.error('Error generating PDF:', downloadError);
            toast.error('Failed to generate PDF. Please try again.');
        } finally {
            setDownloadingPdfToken(null);
        }
    }, []);

    const sendReminder = useCallback(async (request: Request) => {
        if (!request.seller_email) return;
        setSendingReminderRequestId(request.id);
        try {
            const response = await fetch(`/api/requests/${request.id}/remind`, { method: 'POST' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                toast.error(data.error || 'Failed to send reminder');
                return;
            }
            toast.success('Reminder sent');
        } catch (reminderError) {
            console.error('Error sending reminder:', reminderError);
            toast.error('Failed to send reminder. Please try again.');
        } finally {
            setSendingReminderRequestId(null);
        }
    }, []);

    const hasActiveFilters = Boolean(listParams.search) || listParams.status !== 'all';
    const firstResult = meta.total === 0 ? 0 : ((meta.page - 1) * meta.limit) + 1;
    const lastResult = Math.min(meta.page * meta.limit, meta.total);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Requests"
                description="Track every seller request from first send through completed packet."
                actions={
                    <Link
                        href="/dashboard/requests/new"
                        data-testid="requests-new-request"
                        className={buttonVariants()}
                        onClick={() =>
                            trackEvent('new_request_started', {
                                source: 'requests_header_button',
                                location: 'requests_page',
                            })
                        }
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        New Request
                    </Link>
                }
            />

            <Card className="gap-0 py-0 sm:py-0">
                <div className="border-b border-border bg-muted/20 p-3 sm:p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                inputMode="search"
                                aria-label="Search requests"
                                placeholder="Search address or seller"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                className="bg-background pl-9 sm:pl-9"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:shrink-0">
                            <label className="sr-only" htmlFor="request-status-filter">
                                Filter by status
                            </label>
                            <select
                                id="request-status-filter"
                                aria-label="Filter by status"
                                value={listParams.status}
                                onChange={(event) => navigateWithParams({
                                    status: event.target.value === 'all' ? null : event.target.value,
                                    page: null,
                                })}
                                className="h-11 rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus:ring-2 focus:ring-ring sm:h-8 sm:min-w-40 sm:text-sm"
                            >
                                <option value="all">All statuses</option>
                                <option value="needs_attention">Needs attention</option>
                                <option value="draft">Draft</option>
                                <option value="sent">Sent</option>
                                <option value="in_progress">In progress</option>
                                <option value="submitted">Submitted</option>
                            </select>

                            <label className="sr-only" htmlFor="request-sort">
                                Sort requests
                            </label>
                            <select
                                id="request-sort"
                                aria-label="Sort requests"
                                value={listParams.sort}
                                onChange={(event) => navigateWithParams({
                                    sort: event.target.value === DEFAULT_REQUEST_LIST_SORT
                                        ? null
                                        : event.target.value,
                                    page: null,
                                })}
                                className="h-11 rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus:ring-2 focus:ring-ring sm:h-8 sm:min-w-48 sm:text-sm"
                            >
                                <option value="last_activity_desc">Last activity</option>
                                <option value="closing_date_asc">Closing date: soonest</option>
                                <option value="closing_date_desc">Closing date: latest</option>
                                <option value="created_desc">Created: newest</option>
                                <option value="created_asc">Created: oldest</option>
                                <option value="status_asc">Status</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-3 flex min-h-7 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal className="h-4 w-4" />
                            {loading ? (
                                <span>Updating results…</span>
                            ) : (
                                <span>
                                    <span className="font-medium text-foreground">{meta.total} requests</span>
                                    {meta.total > 0 ? ` · Showing ${firstResult}–${lastResult}` : ''}
                                </span>
                            )}
                        </div>
                        {hasActiveFilters && (loading || Boolean(error) || requests.length > 0) ? (
                            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                                <RotateCcw />
                                Clear filters
                            </Button>
                        ) : null}
                    </div>
                </div>

                {loading ? (
                    <div
                        role="status"
                        aria-live="polite"
                        className="flex min-h-72 items-center justify-center gap-2 text-muted-foreground"
                    >
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading requests…
                    </div>
                ) : error ? (
                    <div role="alert" className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                        </div>
                        <h2 className="font-semibold text-foreground">Unable to load requests</h2>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
                        <Button
                            type="button"
                            variant="outline"
                            className="mt-4"
                            onClick={() => setRetryKey((value) => value + 1)}
                        >
                            Try again
                        </Button>
                    </div>
                ) : requests.length === 0 ? (
                    hasActiveFilters ? (
                        <EmptyState
                            icon={Search}
                            title="No matching requests"
                            description="No requests match this search or filter. Clear the filters to return to the full workspace."
                            action={
                                <Button type="button" variant="outline" onClick={clearFilters}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={FileText}
                            title="No requests yet"
                            description="Create a manual request or share your reusable seller link to start collecting utility details."
                            action={
                                <>
                                    <Link href="/dashboard" className={buttonVariants({ variant: 'outline' })}>
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Open seller link
                                    </Link>
                                    <Link href="/dashboard/requests/new" className={buttonVariants()}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        New Request
                                    </Link>
                                </>
                            }
                        />
                    )
                ) : (
                    <>
                        <div className="divide-y divide-border md:hidden">
                            {requests.map((request) => (
                                <article
                                    key={request.id}
                                    data-testid={`request-mobile-${request.id}`}
                                    className="space-y-4 p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <Link
                                                href={`/dashboard/requests/${request.id}`}
                                                className="font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                {request.property_address}
                                            </Link>
                                            <p className="mt-1 truncate text-sm text-muted-foreground">
                                                {request.seller_name || 'No seller name'}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                                            <StatusBadge status={request.status} locked={Boolean(request.is_locked)} />
                                            {request.needs_attention && !request.is_locked ? (
                                                <Badge
                                                    variant="outline"
                                                    className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                                >
                                                    Needs attention
                                                </Badge>
                                            ) : null}
                                        </div>
                                    </div>

                                    <dl className="grid grid-cols-2 gap-3 rounded-md bg-muted/30 p-3 text-xs">
                                        <div>
                                            <dt className="text-muted-foreground">Closing</dt>
                                            <dd className="mt-0.5 font-medium text-foreground">
                                                {formatDate(request.closing_date)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-muted-foreground">Last activity</dt>
                                            <dd className="mt-0.5 font-medium text-foreground">
                                                {formatDate(request.last_activity_at)}
                                            </dd>
                                        </div>
                                    </dl>

                                    <RequestListActions
                                        request={request}
                                        layout="mobile"
                                        onCopySellerLink={copySellerLink}
                                        onSendReminder={sendReminder}
                                        onDownloadPdf={downloadPdf}
                                        sendingReminder={sendingReminderRequestId === request.id}
                                        downloadingPdf={downloadingPdfToken === request.public_token}
                                    />
                                </article>
                            ))}
                        </div>

                        <div className="hidden overflow-x-auto md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Property</TableHead>
                                        <TableHead>Seller</TableHead>
                                        <TableHead>Closing date</TableHead>
                                        <TableHead>Activity</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {requests.map((request) => (
                                        <TableRow key={request.id}>
                                            <TableCell className="max-w-72">
                                                <Link
                                                    href={`/dashboard/requests/${request.id}`}
                                                    className="block truncate font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                >
                                                    {request.property_address}
                                                </Link>
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    {PACKET_MODE_SHORT_LABELS[request.packet_mode === 'advanced' ? 'advanced' : 'simple']}
                                                </p>
                                            </TableCell>
                                            <TableCell className="max-w-48 truncate text-muted-foreground">
                                                {request.seller_name || '—'}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-muted-foreground">
                                                {formatDate(request.closing_date)}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                <p className="text-foreground">{formatDate(request.last_activity_at)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Created {formatDate(request.created_at, 'MMM d')}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col items-start gap-1.5">
                                                    <StatusBadge
                                                        status={request.status}
                                                        locked={Boolean(request.is_locked)}
                                                    />
                                                    {request.needs_attention && !request.is_locked ? (
                                                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                                            Needs attention
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <RequestListActions
                                                    request={request}
                                                    layout="desktop"
                                                    onCopySellerLink={copySellerLink}
                                                    onSendReminder={sendReminder}
                                                    onDownloadPdf={downloadPdf}
                                                    sendingReminder={sendingReminderRequestId === request.id}
                                                    downloadingPdf={downloadingPdfToken === request.public_token}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}

                {!loading && !error && meta.totalPages > 1 ? (
                    <nav
                        aria-label="Requests pagination"
                        className="flex flex-col gap-3 border-t border-border bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <p className="text-sm text-muted-foreground">
                            Page <span className="font-medium text-foreground">{meta.page}</span> of{' '}
                            <span className="font-medium text-foreground">{meta.totalPages}</span>
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-label="Previous page"
                                disabled={!meta.hasPreviousPage}
                                onClick={() => navigateWithParams({
                                    page: meta.page - 1 <= 1 ? null : meta.page - 1,
                                })}
                            >
                                <ChevronLeft />
                                Previous
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-label="Next page"
                                disabled={!meta.hasNextPage}
                                onClick={() => navigateWithParams({ page: meta.page + 1 })}
                            >
                                Next
                                <ChevronRight />
                            </Button>
                        </div>
                    </nav>
                ) : null}
            </Card>
        </div>
    );
}
