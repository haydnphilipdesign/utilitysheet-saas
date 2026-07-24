import type { Plan, RequestStatus } from '@/types';

export type SearchParamValue = string | string[] | undefined;
export type SearchParamsRecord = Record<string, SearchParamValue>;

/**
 * List filters shared between an operations-overview metric and the list it links to. Each parser
 * accepts only a closed set of values so a metric and its destination always resolve to the same rows.
 *
 * `paying` and every `AdminActivationFilter` mirror a predicate in `lib/admin/activation-funnel.ts`.
 */
export type AdminPlanFilter = Plan | 'team' | 'paying';
export type AdminActivationFilter = 'no-setup' | 'missing-defaults' | 'activated-7d' | 'habitual';
export type RequestActivityFilter = '7d' | '30d' | 'stale7d' | 'stale30d';
export type OrgBillingFilter = 'team' | 'non-team';

const ADMIN_PLAN_FILTERS: readonly AdminPlanFilter[] = ['free', 'pro', 'canceled', 'team', 'paying'];
const ADMIN_ACTIVATION_FILTERS: readonly AdminActivationFilter[] = [
    'no-setup',
    'missing-defaults',
    'activated-7d',
    'habitual',
];
const REQUEST_ACTIVITY_FILTERS: readonly RequestActivityFilter[] = ['7d', '30d', 'stale7d', 'stale30d'];
const ORG_BILLING_FILTERS: readonly OrgBillingFilter[] = ['team', 'non-team'];
const REQUEST_STATUSES: readonly RequestStatus[] = ['draft', 'sent', 'in_progress', 'submitted'];

function parseFromSet<T extends string>(allowed: readonly T[], value: string | undefined): T | undefined {
    if (!value) return undefined;
    return allowed.includes(value as T) ? (value as T) : undefined;
}

export function parseAdminPlanFilter(value: string | undefined): AdminPlanFilter | undefined {
    return parseFromSet(ADMIN_PLAN_FILTERS, value);
}

export function parseAdminActivationFilter(value: string | undefined): AdminActivationFilter | undefined {
    return parseFromSet(ADMIN_ACTIVATION_FILTERS, value);
}

export function parseRequestActivityFilter(value: string | undefined): RequestActivityFilter | undefined {
    return parseFromSet(REQUEST_ACTIVITY_FILTERS, value);
}

export function parseOrgBillingFilter(value: string | undefined): OrgBillingFilter | undefined {
    return parseFromSet(ORG_BILLING_FILTERS, value);
}

export function parseRequestStatus(value: string | undefined): RequestStatus | undefined {
    return parseFromSet(REQUEST_STATUSES, value);
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZES = [25, 50, 100] as const;

export async function resolveSearchParams(
    searchParams: SearchParamsRecord | Promise<SearchParamsRecord> | undefined
): Promise<SearchParamsRecord> {
    if (!searchParams) return {};
    return Promise.resolve(searchParams);
}

export function getParam(params: SearchParamsRecord, key: string): string | undefined {
    const value = params[key];
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value[0];
    return undefined;
}

export function parsePositiveInt(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    if (!/^\d+$/.test(value)) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return parsed;
}

export function parsePage(value: string | undefined, fallback = DEFAULT_PAGE): number {
    return parsePositiveInt(value, fallback);
}

export function parsePageSize(
    value: string | undefined,
    options: readonly number[] = DEFAULT_PAGE_SIZES,
    fallback = DEFAULT_PAGE_SIZE
): number {
    const parsed = parsePositiveInt(value, fallback);
    return options.includes(parsed) ? parsed : fallback;
}

export function parseDirection(value: string | undefined, fallback: 'asc' | 'desc' = 'desc'): 'asc' | 'desc' {
    if (value === 'asc' || value === 'desc') return value;
    return fallback;
}

export function clampPage(page: number, totalPages: number): number {
    return Math.min(Math.max(1, page), Math.max(1, totalPages));
}

export function shouldCanonicalizePage(params: {
    rawPage: string | undefined;
    rawPageSize: string | undefined;
    page: number;
    canonicalPage: number;
    pageSize: number;
}): boolean {
    const rawPageIsValid = !params.rawPage || /^[1-9]\d*$/.test(params.rawPage);
    const rawPageSizeIsValid = !params.rawPageSize || /^[1-9]\d*$/.test(params.rawPageSize);

    if (!rawPageIsValid || !rawPageSizeIsValid) return true;
    if (params.page !== params.canonicalPage) return true;
    if (params.rawPageSize && Number(params.rawPageSize) !== params.pageSize) return true;
    return false;
}

export function buildSearchParams(
    values: Record<string, string | number | undefined | null>,
    options?: { keepEmpty?: boolean }
): URLSearchParams {
    const params = new URLSearchParams();
    const entries = Object.entries(values).sort(([a], [b]) => a.localeCompare(b));

    for (const [key, value] of entries) {
        if (value === undefined || value === null) continue;
        const text = String(value);
        if (!options?.keepEmpty && text.trim().length === 0) continue;
        params.set(key, text);
    }

    return params;
}

export function buildAdminHref(pathname: string, values: Record<string, string | number | undefined | null>): string {
    const params = buildSearchParams(values);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
}
