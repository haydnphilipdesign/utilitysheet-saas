import type { RequestStatus } from '@/types';

export const REQUESTS_DEFAULT_PAGE_SIZE = 20;
export const REQUESTS_MAX_PAGE_SIZE = 100;
export const REQUESTS_SEARCH_MAX_LENGTH = 200;
export const REQUEST_NEEDS_ATTENTION_DAYS = 3;

export const REQUEST_LIST_STATUS_FILTERS = [
    'all',
    'draft',
    'sent',
    'in_progress',
    'submitted',
    'needs_attention',
] as const;

export type RequestListStatusFilter =
    | 'all'
    | RequestStatus
    | 'needs_attention';

export const REQUEST_LIST_SORTS = [
    'last_activity_desc',
    'closing_date_asc',
    'closing_date_desc',
    'created_desc',
    'created_asc',
    'status_asc',
] as const;

export type RequestListSort = (typeof REQUEST_LIST_SORTS)[number];

export const DEFAULT_REQUEST_LIST_SORT: RequestListSort = 'last_activity_desc';

export interface RequestListParams {
    page: number;
    limit: number;
    search?: string;
    status: RequestListStatusFilter;
    sort: RequestListSort;
}

function parseBoundedInteger(
    value: string | null,
    fallback: number,
    minimum: number,
    maximum?: number
): number {
    if (!value || !/^\d+$/.test(value)) return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum) return fallback;
    if (maximum !== undefined && parsed > maximum) return fallback;
    return parsed;
}

export function isRequestListStatusFilter(value: string | null): value is RequestListStatusFilter {
    return value !== null
        && (REQUEST_LIST_STATUS_FILTERS as readonly string[]).includes(value);
}

export function isRequestListSort(value: string | null): value is RequestListSort {
    return value !== null
        && (REQUEST_LIST_SORTS as readonly string[]).includes(value);
}

export function normalizeRequestListParams(searchParams: URLSearchParams): RequestListParams {
    const normalizedSearch = searchParams.get('q')?.trim().slice(0, REQUESTS_SEARCH_MAX_LENGTH);
    const rawStatus = searchParams.get('status');
    const rawSort = searchParams.get('sort');

    return {
        page: parseBoundedInteger(searchParams.get('page'), 1, 1),
        limit: parseBoundedInteger(
            searchParams.get('limit'),
            REQUESTS_DEFAULT_PAGE_SIZE,
            1,
            REQUESTS_MAX_PAGE_SIZE
        ),
        search: normalizedSearch || undefined,
        status: isRequestListStatusFilter(rawStatus) ? rawStatus : 'all',
        sort: isRequestListSort(rawSort) ? rawSort : DEFAULT_REQUEST_LIST_SORT,
    };
}
