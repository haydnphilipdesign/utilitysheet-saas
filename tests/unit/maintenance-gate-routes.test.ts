// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Every dependency a paused endpoint could reach. None may be touched while maintenance is on.
const deps = vi.hoisted(() => {
    const names = [
        'checkRateLimit',
        'getRequestBySellerToken', 'getRequestByToken', 'getAccountById', 'getDefaultBrandProfile', 'getBrandProfile',
        'getOrganizationById', 'getOrganizationAdminRecipients', 'getOrganizationMemberRole', 'getReferralIdentityForm',
        'getUtilityEntriesByRequestId', 'getMonthlyUsage', 'createEventLog', 'sql', 'submitSellerRequest',
        'getAllSuggestions', 'searchProviders', 'resolveContact',
        'sendSellerReminderEmail', 'sendTCCompletionNotificationEmail', 'sendContactResolutionAlertEmail',
        'createPacketPdfAttachmentForPublicToken', 'markAiSuggestionSelection', 'scheduleReferralCreditAward',
        'lazyBackfillRequestStructuredAddress', 'insertSellerObservations',
        'recordOperationalEvent', 'recordOperationalSuccess',
    ] as const;
    return Object.fromEntries(names.map((name) => [name, vi.fn()])) as Record<typeof names[number], ReturnType<typeof vi.fn>>;
});

vi.mock('server-only', () => ({}));
vi.mock('@/lib/ops/events', () => ({
    recordOperationalEvent: deps.recordOperationalEvent,
    recordOperationalSuccess: deps.recordOperationalSuccess,
    errorNameOf: () => 'Error',
}));
vi.mock('@/lib/neon/queries', () => ({
    getRequestBySellerToken: deps.getRequestBySellerToken,
    getRequestByToken: deps.getRequestByToken,
    getAccountById: deps.getAccountById,
    getDefaultBrandProfile: deps.getDefaultBrandProfile,
    getBrandProfile: deps.getBrandProfile,
    getOrganizationById: deps.getOrganizationById,
    getOrganizationAdminRecipients: deps.getOrganizationAdminRecipients,
    getOrganizationMemberRole: deps.getOrganizationMemberRole,
    getReferralIdentityForm: deps.getReferralIdentityForm,
    getUtilityEntriesByRequestId: deps.getUtilityEntriesByRequestId,
    getMonthlyUsage: deps.getMonthlyUsage,
    createEventLog: deps.createEventLog,
}));
vi.mock('@/lib/neon/db', () => ({ sql: deps.sql }));
vi.mock('@/lib/neon/queries/event-logs', () => ({ createEventLog: deps.createEventLog }));
vi.mock('@/lib/neon/queries/seller-submission', () => ({ submitSellerRequest: deps.submitSellerRequest }));
vi.mock('@/lib/neon/queries/seller-observations', () => ({ insertSellerObservations: deps.insertSellerObservations }));
vi.mock('@/lib/neon/queries/ai-telemetry', () => ({ markAiSuggestionSelection: deps.markAiSuggestionSelection }));
vi.mock('@/lib/rate-limit', () => ({
    formSubmissionRatelimit: {}, aiRatelimit: {}, reminderRatelimit: {}, packetPdfRatelimit: {}, sellerObservationRatelimit: {},
    checkRateLimit: deps.checkRateLimit,
    getRateLimitHeaders: () => ({}),
    isRateLimitUnavailable: (result: { reason?: string }) => result.reason === 'unavailable',
}));
vi.mock('@/lib/providers/suggestion-service', () => ({ getAllSuggestions: deps.getAllSuggestions, searchProviders: deps.searchProviders }));
vi.mock('@/lib/providers/contact-service', () => ({ hasValidContact: () => true, resolveContact: deps.resolveContact }));
vi.mock('@/lib/email/email-service', () => ({
    sendSellerReminderEmail: deps.sendSellerReminderEmail,
    sendTCCompletionNotificationEmail: deps.sendTCCompletionNotificationEmail,
    sendContactResolutionAlertEmail: deps.sendContactResolutionAlertEmail,
}));
vi.mock('@/lib/pdf/packet-attachment', () => ({ createPacketPdfAttachmentForPublicToken: deps.createPacketPdfAttachmentForPublicToken }));
vi.mock('@/lib/referrals/award-referral-credit', () => ({ scheduleReferralCreditAward: deps.scheduleReferralCreditAward }));
vi.mock('@/lib/address/structured-address', () => ({ lazyBackfillRequestStructuredAddress: deps.lazyBackfillRequestStructuredAddress }));

import { GET as sellerRead, POST as sellerSubmit } from '@/app/api/seller/[token]/route';
import { GET as suggestions } from '@/app/api/seller/[token]/suggestions/route';
import { GET as suggestionSearch } from '@/app/api/seller/[token]/suggestions/search/route';
import { POST as sendLink } from '@/app/api/seller/[token]/send-link/route';
import { POST as observations } from '@/app/api/seller/[token]/observations/route';
import { GET as packetPdf } from '@/app/api/packet/[token]/pdf/route';
import { GET as maintenanceStatus } from '@/app/api/maintenance/route';

const TOKEN = 'synthetic-capability-sentinel';
const context = { params: Promise.resolve({ token: TOKEN }) };
const base = `http://localhost/api`;

type Endpoint = {
    name: string;
    surface: string;
    request: () => Request;
    call: (request: Request) => Promise<Response>;
};

const endpoints: Endpoint[] = [
    {
        name: 'POST seller submission', surface: 'seller_submission',
        request: () => new Request(`${base}/seller/${TOKEN}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ water_source: 'city' }) }),
        call: (request) => sellerSubmit(request, context),
    },
    {
        name: 'GET suggestions', surface: 'seller_suggestions',
        request: () => new Request(`${base}/seller/${TOKEN}/suggestions?categories=electric`),
        call: (request) => suggestions(request, context),
    },
    {
        name: 'GET suggestion search', surface: 'seller_suggestion_search',
        request: () => new Request(`${base}/seller/${TOKEN}/suggestions/search?query=sentinel&category=electric`),
        call: (request) => suggestionSearch(request, context),
    },
    {
        name: 'POST seller self-link email', surface: 'seller_send_link',
        request: () => new Request(`${base}/seller/${TOKEN}/send-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'seller@example.test' }) }),
        call: (request) => sendLink(request, context),
    },
    {
        name: 'GET packet PDF', surface: 'packet_pdf',
        request: () => new Request(`${base}/packet/${TOKEN}/pdf`),
        call: (request) => packetPdf(request, context),
    },
];

const limited = { success: false, limit: 5, remaining: 0, reset: 12345, reason: 'limited' as const };

beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    deps.getRequestBySellerToken.mockResolvedValue({ id: 'r1', account_id: 'a1', property_address: '12 Sentinel Street', status: 'in_progress' });
    deps.checkRateLimit.mockResolvedValue(limited);
});
afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
});

describe.each(endpoints)('$name during maintenance', ({ surface, request, call }) => {
    it('refuses with a recognizable, uncached 503 before the limiter and every side effect', async () => {
        vi.stubEnv('MAINTENANCE_MODE', 'on');
        const incoming = request();
        const response = await call(incoming);

        expect(response.status).toBe(503);
        expect(response.headers.get('Retry-After')).toBe('1800');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(response.headers.get('X-UtilitySheet-Maintenance')).toBe('1');
        expect(response.headers.get('X-RateLimit-Limit')).toBeNull();
        const body = await response.json();
        expect(body).toEqual({ error: expect.any(String), code: 'MAINTENANCE', maintenance: true, surface, expectedBackAt: null });
        expect(body.error).not.toContain(TOKEN);
        expect(body.error).not.toContain('—');

        // Nothing ran: no limiter, lookup, write, email, render or model call, and the body was not read.
        for (const [name, mock] of Object.entries(deps)) expect(mock, name).not.toHaveBeenCalled();
        expect(incoming.bodyUsed).toBe(false);
    });

    it('reaches the limiter as before once maintenance is off', async () => {
        const response = await call(request());
        expect(response.status).toBe(429);
        expect(response.headers.get('X-UtilitySheet-Maintenance')).toBeNull();
        expect(deps.checkRateLimit).toHaveBeenCalledTimes(1);
    });

    it.each(['off', 'false', '0', ''])('treats MAINTENANCE_MODE=%j as off', async (value) => {
        vi.stubEnv('MAINTENANCE_MODE', value);
        expect((await call(request())).status).toBe(429);
    });
});

describe('maintenance refusal details', () => {
    it('reports a configured future estimate and a matching Retry-After, and ignores a past one', async () => {
        vi.useFakeTimers({ now: Date.parse('2026-10-20T01:00:00Z'), toFake: ['Date'] });
        vi.stubEnv('MAINTENANCE_MODE', 'on');
        vi.stubEnv('MAINTENANCE_EXPECTED_BACK_AT', '2026-10-20T01:45:00Z');
        const estimated = await endpoints[0].call(endpoints[0].request());
        expect(estimated.headers.get('Retry-After')).toBe('2700');
        expect((await estimated.json()).expectedBackAt).toBe('2026-10-20T01:45:00.000Z');

        vi.stubEnv('MAINTENANCE_EXPECTED_BACK_AT', '2026-10-20T00:30:00Z');
        const overdue = await endpoints[0].call(endpoints[0].request());
        expect(overdue.headers.get('Retry-After')).toBe('1800');
        expect((await overdue.json()).expectedBackAt).toBeNull();
    });

    it('answers a browser navigation to the PDF with a page, not JSON', async () => {
        vi.stubEnv('MAINTENANCE_MODE', 'on');
        const response = await packetPdf(new Request(`${base}/packet/${TOKEN}/pdf`, {
            headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        }), context);
        expect(response.status).toBe(503);
        expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
        expect(response.headers.get('Retry-After')).toBe('1800');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(response.headers.get('X-UtilitySheet-Maintenance')).toBe('1');
        const html = await response.text();
        expect(html).toContain('<h1>Paused for maintenance</h1>');
        expect(html).toContain('PDF downloads are paused');
        expect(html).not.toContain(TOKEN);
        expect(deps.createPacketPdfAttachmentForPublicToken).not.toHaveBeenCalled();
    });

    it('keeps JSON for the other endpoints even when HTML is accepted', async () => {
        vi.stubEnv('MAINTENANCE_MODE', 'on');
        const response = await suggestions(new Request(`${base}/seller/${TOKEN}/suggestions?categories=electric`, { headers: { Accept: 'text/html' } }), context);
        expect(response.headers.get('Content-Type')).toContain('application/json');
    });
});

describe('what maintenance leaves alone', () => {
    it('still serves the seller form read', async () => {
        vi.stubEnv('MAINTENANCE_MODE', 'on');
        deps.getRequestBySellerToken.mockResolvedValue(null);
        deps.getRequestByToken.mockResolvedValue(null);
        const response = await sellerRead(new Request(`${base}/seller/${TOKEN}`), context);
        expect(response.status).toBe(404);
        expect(response.headers.get('X-UtilitySheet-Maintenance')).toBeNull();
        expect(deps.getRequestBySellerToken).toHaveBeenCalled();
    });

    it('still runs the diagnostic observation limiter, which has no legacy bucket', async () => {
        vi.stubEnv('MAINTENANCE_MODE', 'on');
        const response = await observations(new Request(`${base}/seller/${TOKEN}/observations`, { method: 'POST', body: '{}' }), context);
        expect(response.status).toBe(429);
        expect(response.headers.get('X-UtilitySheet-Maintenance')).toBeNull();
        expect(deps.checkRateLimit).toHaveBeenCalledTimes(1);
    });

    it('gates exactly the five cutover handlers and no webhook, cron, auth, billing or admin route', () => {
        const root = path.resolve(__dirname, '../../app/api');
        const gated = (readdirSync(root, { recursive: true }) as string[])
            .map((entry) => entry.split(path.sep).join('/'))
            .filter((entry) => entry.endsWith('route.ts'))
            .filter((entry) => readFileSync(path.join(root, entry), 'utf8').includes('maintenanceResponse('))
            .sort();
        expect(gated).toEqual([
            'packet/[token]/pdf/route.ts',
            'seller/[token]/route.ts',
            'seller/[token]/send-link/route.ts',
            'seller/[token]/suggestions/route.ts',
            'seller/[token]/suggestions/search/route.ts',
        ]);
        // In the shared submission file only POST is gated; the read above it is not.
        const sellerRoute = readFileSync(path.join(root, 'seller/[token]/route.ts'), 'utf8');
        expect(sellerRoute.match(/maintenanceResponse\(/g)).toHaveLength(1);
        expect(sellerRoute.indexOf('maintenanceResponse(')).toBeGreaterThan(sellerRoute.indexOf('export async function POST('));
    });
});

describe('GET /api/maintenance', () => {
    it('reports the state without caching and without touching the limiter or database', async () => {
        const off = await maintenanceStatus();
        expect(off.status).toBe(200);
        expect(off.headers.get('Cache-Control')).toBe('no-store');
        expect(await off.json()).toEqual({ maintenance: false, expectedBackAt: null });

        vi.stubEnv('MAINTENANCE_MODE', 'on');
        const on = await maintenanceStatus();
        expect(on.status).toBe(200);
        expect(on.headers.get('Cache-Control')).toBe('no-store');
        expect(await on.json()).toEqual({ maintenance: true, expectedBackAt: null });
        for (const [name, mock] of Object.entries(deps)) expect(mock, name).not.toHaveBeenCalled();
    });
});
