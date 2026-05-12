import { sql } from '@/lib/neon/db';
import type { EffectivePlan, UserRole } from '@/types';

export type TestimonialCandidateSortField = 'score' | 'totalRequests' | 'lastActivity' | 'created';
export type TestimonialCandidateSortDirection = 'asc' | 'desc';

export type TestimonialCandidateScoringInput = {
    effectivePlan: EffectivePlan;
    totalRequests: number;
    requestsLast30Days: number;
    requestsLast90Days: number;
    activeMonthsLast6: number;
    uniqueProperties: number;
    hasCompletedOnboarding: boolean;
    hasBrandProfile: boolean;
    hasIntakeLink: boolean;
    role: UserRole;
    email: string;
    fullName: string | null;
    companyName: string | null;
    lastActivityAt: string | null;
};

export type TestimonialCandidateRow = TestimonialCandidateScoringInput & {
    id: string;
    businessName: string | null;
    subscriptionStatus: string;
    accountSubscriptionStatus: string;
    organizationNames: string[];
    teamSeatQuantity: number;
    submittedRequests: number;
    sellerSubmittedEvents: number;
    pdfGeneratedEvents: number;
    reminderSentEvents: number;
    accountCreatedAt: string;
    score: number;
    reasons: string[];
    latestTestimonialOutreach: {
        status: 'pending' | 'sent' | 'failed' | 'dry_run' | null;
        sentAt: string | null;
    } | null;
};

export type TestimonialCandidateFilters = {
    payingOnly?: boolean;
    plan?: 'all' | 'pro' | 'team';
    active?: 'all' | '30' | '90';
    minRequests?: number;
    excludeInternalTest?: boolean;
    sortBy?: TestimonialCandidateSortField;
    sortDir?: TestimonialCandidateSortDirection;
    limit?: number;
    offset?: number;
};

type RawCandidateRow = {
    id: string;
    email: string;
    full_name: string | null;
    company_name: string | null;
    role: UserRole;
    subscription_status: EffectivePlan;
    created_at: string;
    onboarding_completed_at: string | null;
    effective_plan: EffectivePlan;
    organization_names: string[] | null;
    team_seat_quantity: number | string | null;
    total_requests: number | string | null;
    submitted_requests: number | string | null;
    requests_last_30_days: number | string | null;
    requests_last_90_days: number | string | null;
    active_months_last_6: number | string | null;
    unique_properties: number | string | null;
    last_activity_at: string | null;
    brand_profile_count: number | string | null;
    intake_link_count: number | string | null;
    seller_submitted_events: number | string | null;
    pdf_generated_events: number | string | null;
    reminder_sent_events: number | string | null;
    testimonial_outreach_status: 'pending' | 'sent' | 'failed' | 'dry_run' | null;
    testimonial_outreach_sent_at: string | null;
};

function asNumber(value: number | string | null | undefined): number {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
}

function clampScore(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
}

function isRecent(lastActivityAt: string | null, days: number): boolean {
    if (!lastActivityAt) return false;
    const lastActivity = new Date(lastActivityAt).getTime();
    if (!Number.isFinite(lastActivity)) return false;
    return Date.now() - lastActivity <= days * 24 * 60 * 60 * 1000;
}

export function calculateTestimonialCandidateScore(input: TestimonialCandidateScoringInput): number {
    let score = 0;

    if (input.effectivePlan === 'team') score += 26;
    if (input.effectivePlan === 'pro') score += 20;
    if (input.effectivePlan === 'canceled') score += 4;

    score += Math.min(input.totalRequests, 30) * 1.1;
    score += Math.min(input.requestsLast30Days, 10) * 2.2;
    score += Math.min(input.requestsLast90Days, 24) * 0.75;
    score += Math.min(input.activeMonthsLast6, 6) * 3;
    score += Math.min(input.uniqueProperties, 20) * 0.65;

    if (isRecent(input.lastActivityAt, 30)) score += 8;
    else if (isRecent(input.lastActivityAt, 90)) score += 4;

    if (input.hasCompletedOnboarding) score += 4;
    if (input.hasBrandProfile) score += 4;
    if (input.hasIntakeLink) score += 2;

    if (isLikelyInternalOrTestAccount(input)) score -= 100;

    return clampScore(score);
}

export function isLikelyInternalOrTestAccount(input: Pick<TestimonialCandidateScoringInput, 'email' | 'fullName' | 'companyName' | 'role'>): boolean {
    if (input.role === 'admin' || input.role === 'banned') return true;

    const haystack = [
        input.email,
        input.fullName || '',
        input.companyName || '',
    ].join(' ').toLowerCase();

    if (/@example\./.test(haystack)) return true;
    if (/@localhost\b/.test(haystack)) return true;
    if (/\b(test|demo|fake|sample|internal)\b/.test(haystack)) return true;
    if (/\+(test|demo)\@/.test(haystack)) return true;
    if (/\b(utilitysheet|norma suite|haydn)\b/.test(haystack)) return true;

    return false;
}

export function buildCandidateReasons(input: TestimonialCandidateScoringInput): string[] {
    const reasons: string[] = [];

    if (input.effectivePlan === 'team') reasons.push('Teams customer');
    if (input.effectivePlan === 'pro') reasons.push('Pro customer');
    if (input.totalRequests >= 10) reasons.push(`${input.totalRequests} total requests`);
    if (input.requestsLast30Days > 0) reasons.push(`${input.requestsLast30Days} requests in the last 30 days`);
    else if (input.requestsLast90Days > 0) reasons.push(`${input.requestsLast90Days} requests in the last 90 days`);
    if (input.activeMonthsLast6 >= 2) reasons.push(`Used across ${input.activeMonthsLast6} of the last 6 months`);
    if (input.uniqueProperties >= 5) reasons.push(`${input.uniqueProperties} unique properties`);
    if (input.hasCompletedOnboarding && input.hasBrandProfile) reasons.push('Branding/setup complete');
    else if (input.hasBrandProfile) reasons.push('Brand profile configured');
    else if (input.hasCompletedOnboarding) reasons.push('Onboarding complete');
    if (input.hasIntakeLink) reasons.push('Reusable seller intake link enabled');

    return reasons;
}

function mapRawCandidate(row: RawCandidateRow): TestimonialCandidateRow {
    const input: TestimonialCandidateScoringInput = {
        effectivePlan: row.effective_plan,
        totalRequests: asNumber(row.total_requests),
        requestsLast30Days: asNumber(row.requests_last_30_days),
        requestsLast90Days: asNumber(row.requests_last_90_days),
        activeMonthsLast6: asNumber(row.active_months_last_6),
        uniqueProperties: asNumber(row.unique_properties),
        hasCompletedOnboarding: Boolean(row.onboarding_completed_at),
        hasBrandProfile: asNumber(row.brand_profile_count) > 0,
        hasIntakeLink: asNumber(row.intake_link_count) > 0,
        role: row.role,
        email: row.email,
        fullName: row.full_name,
        companyName: row.company_name,
        lastActivityAt: row.last_activity_at,
    };

    const organizationNames = row.organization_names || [];
    const sellerSubmittedEvents = asNumber(row.seller_submitted_events);
    const pdfGeneratedEvents = asNumber(row.pdf_generated_events);
    const reminderSentEvents = asNumber(row.reminder_sent_events);
    const reasons = buildCandidateReasons(input);
    if (sellerSubmittedEvents > 0) reasons.push(`${sellerSubmittedEvents} seller submissions logged`);
    if (pdfGeneratedEvents > 0) reasons.push(`${pdfGeneratedEvents} packet PDF events`);
    if (reminderSentEvents > 0) reasons.push(`${reminderSentEvents} reminder emails sent`);

    return {
        ...input,
        id: row.id,
        businessName: row.company_name || organizationNames[0] || null,
        subscriptionStatus: row.effective_plan === 'team' ? 'team' : row.subscription_status,
        accountSubscriptionStatus: row.subscription_status,
        organizationNames,
        teamSeatQuantity: asNumber(row.team_seat_quantity),
        submittedRequests: asNumber(row.submitted_requests),
        sellerSubmittedEvents,
        pdfGeneratedEvents,
        reminderSentEvents,
        accountCreatedAt: row.created_at,
        score: calculateTestimonialCandidateScore(input),
        reasons,
        latestTestimonialOutreach: row.testimonial_outreach_status
            ? {
                status: row.testimonial_outreach_status,
                sentAt: row.testimonial_outreach_sent_at,
            }
            : null,
    };
}

function sortCandidates(
    candidates: TestimonialCandidateRow[],
    sortBy: TestimonialCandidateSortField,
    sortDir: TestimonialCandidateSortDirection
) {
    const direction = sortDir === 'asc' ? 1 : -1;

    return [...candidates].sort((a, b) => {
        let result = 0;
        if (sortBy === 'score') result = a.score - b.score;
        if (sortBy === 'totalRequests') result = a.totalRequests - b.totalRequests;
        if (sortBy === 'lastActivity') {
            result = new Date(a.lastActivityAt || 0).getTime() - new Date(b.lastActivityAt || 0).getTime();
        }
        if (sortBy === 'created') {
            result = new Date(a.accountCreatedAt).getTime() - new Date(b.accountCreatedAt).getTime();
        }
        if (result === 0) result = a.email.localeCompare(b.email);
        return result * direction;
    });
}

async function hasTestimonialOutreachLogsTable(): Promise<boolean> {
    if (!sql) return false;

    const result = await sql`SELECT to_regclass('public.testimonial_outreach_logs') AS table_name`;
    return Boolean(result[0]?.table_name);
}

export async function getTestimonialCandidates(filters: TestimonialCandidateFilters = {}) {
    if (!sql) return { candidates: [], total: 0 };

    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    const offset = Math.max(0, filters.offset ?? 0);
    const minRequests = Math.max(0, filters.minRequests ?? 1);
    const payingOnly = filters.payingOnly ?? true;
    const excludeInternalTest = filters.excludeInternalTest ?? true;
    const sortBy = filters.sortBy ?? 'score';
    const sortDir = filters.sortDir ?? 'desc';
    const includeTestimonialOutreach = await hasTestimonialOutreachLogsTable();
    const testimonialOutreachCte = includeTestimonialOutreach
        ? sql`
        ,
        latest_testimonial_outreach AS (
            SELECT DISTINCT ON (user_id)
                user_id,
                status,
                sent_at
            FROM testimonial_outreach_logs
            WHERE user_id IS NOT NULL
            ORDER BY user_id, sent_at DESC NULLS LAST, created_at DESC
        )`
        : sql``;
    const testimonialOutreachColumns = includeTestimonialOutreach
        ? sql`
            ,
            lto.status AS testimonial_outreach_status,
            lto.sent_at AS testimonial_outreach_sent_at`
        : sql`
            ,
            NULL::text AS testimonial_outreach_status,
            NULL::timestamptz AS testimonial_outreach_sent_at`;
    const testimonialOutreachJoin = includeTestimonialOutreach
        ? sql`LEFT JOIN latest_testimonial_outreach lto ON lto.user_id = a.id`
        : sql``;

    const rows = await sql`
        WITH team_memberships AS (
            SELECT
                om.account_id,
                array_agg(DISTINCT o.name ORDER BY o.name) FILTER (WHERE o.subscription_status = 'team') AS organization_names,
                COALESCE(MAX(o.seat_quantity) FILTER (WHERE o.subscription_status = 'team'), 0) AS team_seat_quantity,
                BOOL_OR(o.subscription_status = 'team') AS has_team_plan
            FROM organization_members om
            JOIN organizations o ON o.id = om.organization_id
            GROUP BY om.account_id
        ),
        request_stats AS (
            SELECT
                r.account_id,
                COUNT(*) FILTER (WHERE r.metered_at IS NOT NULL)::int AS total_requests,
                COUNT(*) FILTER (WHERE r.status = 'submitted')::int AS submitted_requests,
                COUNT(*) FILTER (
                    WHERE COALESCE(r.last_activity_at, r.metered_at, r.created_at) >= NOW() - INTERVAL '30 days'
                        AND r.metered_at IS NOT NULL
                )::int AS requests_last_30_days,
                COUNT(*) FILTER (
                    WHERE COALESCE(r.last_activity_at, r.metered_at, r.created_at) >= NOW() - INTERVAL '90 days'
                        AND r.metered_at IS NOT NULL
                )::int AS requests_last_90_days,
                COUNT(DISTINCT date_trunc('month', COALESCE(r.metered_at, r.created_at))) FILTER (
                    WHERE COALESCE(r.metered_at, r.created_at) >= NOW() - INTERVAL '6 months'
                        AND r.metered_at IS NOT NULL
                )::int AS active_months_last_6,
                COUNT(DISTINCT lower(trim(r.property_address))) FILTER (
                    WHERE r.property_address IS NOT NULL
                        AND r.metered_at IS NOT NULL
                )::int AS unique_properties,
                MAX(COALESCE(r.last_activity_at, r.metered_at, r.created_at)) AS last_activity_at
            FROM requests r
            WHERE r.deleted_at IS NULL
                AND COALESCE(r.is_demo, FALSE) = FALSE
            GROUP BY r.account_id
        ),
        event_stats AS (
            SELECT
                r.account_id,
                COUNT(*) FILTER (WHERE el.event_type = 'seller_submitted')::int AS seller_submitted_events,
                COUNT(*) FILTER (WHERE el.event_type IN ('pdf_generated', 'pdf_downloaded'))::int AS pdf_generated_events,
                COUNT(*) FILTER (WHERE el.event_type = 'reminder_sent')::int AS reminder_sent_events
            FROM event_logs el
            JOIN requests r ON r.id = el.request_id
            WHERE r.deleted_at IS NULL
                AND COALESCE(r.is_demo, FALSE) = FALSE
            GROUP BY r.account_id
        ),
        brand_stats AS (
            SELECT account_id, COUNT(*)::int AS brand_profile_count
            FROM brand_profiles
            GROUP BY account_id
        ),
        intake_stats AS (
            SELECT account_id, COUNT(*) FILTER (WHERE is_active = TRUE)::int AS intake_link_count
            FROM intake_links
            GROUP BY account_id
        )
        ${testimonialOutreachCte}
        SELECT
            a.id,
            a.email,
            a.full_name,
            a.company_name,
            a.role,
            a.subscription_status,
            a.created_at,
            a.onboarding_completed_at,
            CASE
                WHEN COALESCE(tm.has_team_plan, FALSE) THEN 'team'
                ELSE a.subscription_status
            END AS effective_plan,
            COALESCE(tm.organization_names, ARRAY[]::text[]) AS organization_names,
            COALESCE(tm.team_seat_quantity, 0) AS team_seat_quantity,
            COALESCE(rs.total_requests, 0) AS total_requests,
            COALESCE(rs.submitted_requests, 0) AS submitted_requests,
            COALESCE(rs.requests_last_30_days, 0) AS requests_last_30_days,
            COALESCE(rs.requests_last_90_days, 0) AS requests_last_90_days,
            COALESCE(rs.active_months_last_6, 0) AS active_months_last_6,
            COALESCE(rs.unique_properties, 0) AS unique_properties,
            rs.last_activity_at,
            COALESCE(bs.brand_profile_count, 0) AS brand_profile_count,
            COALESCE(ins.intake_link_count, 0) AS intake_link_count,
            COALESCE(es.seller_submitted_events, 0) AS seller_submitted_events,
            COALESCE(es.pdf_generated_events, 0) AS pdf_generated_events,
            COALESCE(es.reminder_sent_events, 0) AS reminder_sent_events
            ${testimonialOutreachColumns}
        FROM accounts a
        LEFT JOIN team_memberships tm ON tm.account_id = a.id
        LEFT JOIN request_stats rs ON rs.account_id = a.id
        LEFT JOIN brand_stats bs ON bs.account_id = a.id
        LEFT JOIN intake_stats ins ON ins.account_id = a.id
        LEFT JOIN event_stats es ON es.account_id = a.id
        ${testimonialOutreachJoin}
    `;

    let candidates = (rows as unknown as RawCandidateRow[]).map(mapRawCandidate);

    candidates = candidates.filter((candidate) => {
        if (payingOnly && candidate.effectivePlan !== 'pro' && candidate.effectivePlan !== 'team') return false;
        if (filters.plan === 'pro' && candidate.effectivePlan !== 'pro') return false;
        if (filters.plan === 'team' && candidate.effectivePlan !== 'team') return false;
        if (filters.active === '30' && candidate.requestsLast30Days <= 0) return false;
        if (filters.active === '90' && candidate.requestsLast90Days <= 0) return false;
        if (candidate.totalRequests < minRequests) return false;
        if (excludeInternalTest && isLikelyInternalOrTestAccount(candidate)) return false;
        return true;
    });

    const sorted = sortCandidates(candidates, sortBy, sortDir);

    return {
        candidates: sorted.slice(offset, offset + limit),
        total: sorted.length,
    };
}
