import { savedForm } from '../fixtures/saved-seller-forms';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/neon/queries', () => ({
    getIntakeLinkBySlug: vi.fn(),
    getIntakeLinkBySuffix: vi.fn(),
    getSellerFormAliasSlugs: vi.fn(),
    getAccountById: vi.fn(),
    getAccountOrganizations: vi.fn(),
    getMonthlyUsage: vi.fn(),
    getIntakeBrandProfile: vi.fn(),
    normalizeIntakeUtilityCategories: vi.fn((value: unknown) => (
        Array.isArray(value) && value.length > 0
            ? value
            : ['electric', 'gas', 'propane', 'oil', 'water', 'sewer', 'trash', 'internet', 'cable']
    )),
    getRequestBySellerToken: vi.fn(),
    createRequest: vi.fn(),
    createEventLog: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
    intakeStartRatelimit: {},
    checkRateLimit: vi.fn(),
    getRateLimitHeaders: vi.fn(() => ({})),
    isRateLimitUnavailable: vi.fn(() => false),
}));

vi.mock('@/lib/address/structured-address', () => ({
    buildStructuredPropertyAddress: vi.fn(),
}));

vi.mock('@/lib/network/client-ip', () => ({
    getClientIp: vi.fn(() => '1.2.3.4'),
}));

import { POST } from '@/app/api/intake/[slug]/start/route';
import { POST as nestedStart } from '@/app/api/intake/[slug]/forms/[suffix]/start/route';
import { GET as nestedMetadata } from '@/app/api/intake/[slug]/forms/[suffix]/route';
import {
    createEventLog,
    createRequest,
    getAccountById,
    getAccountOrganizations,
    getIntakeBrandProfile,
    getIntakeLinkBySlug,
    getIntakeLinkBySuffix,
    getSellerFormAliasSlugs,
    getMonthlyUsage,
    getRequestBySellerToken,
} from '@/lib/neon/queries';
import { buildStructuredPropertyAddress } from '@/lib/address/structured-address';
import { checkRateLimit, isRateLimitUnavailable } from '@/lib/rate-limit';

describe('POST /api/intake/[slug]/start', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(checkRateLimit).mockResolvedValue({
            success: true,
            limit: 20,
            remaining: 19,
            reset: 999999,
        } as never);
        vi.mocked(getIntakeLinkBySlug).mockResolvedValue({
            ...savedForm,
            slug: 'test-slug',
            account_id: 'acct-1',
            is_active: true,
            default_packet_mode: 'simple',
            advanced_modules: [],
            advanced_module_exclusions: {},
        } as never);
        vi.mocked(getIntakeLinkBySuffix).mockResolvedValue({ ...savedForm, account_id: 'acct-1', is_referral_identity: false });
        vi.mocked(getSellerFormAliasSlugs).mockResolvedValue(['very-old-flat']);
        vi.mocked(isRateLimitUnavailable).mockReturnValue(false);
        vi.mocked(getAccountById).mockResolvedValue({
            id: 'acct-1',
            role: 'user',
            subscription_status: 'free',
            active_organization_id: null,
        } as never);
        vi.mocked(getAccountOrganizations).mockResolvedValue([] as never);
        vi.mocked(getMonthlyUsage).mockResolvedValue({
            used: 0,
            limit: 3,
            plan: 'free',
        } as never);
        vi.mocked(getIntakeBrandProfile).mockResolvedValue(null);
        vi.mocked(getRequestBySellerToken).mockResolvedValue(null);
        vi.mocked(buildStructuredPropertyAddress).mockResolvedValue({
            street: '123 Main St',
            city: 'Austin',
            state: 'TX',
            zip: '78701',
            full: '123 Main St, Austin, TX 78701',
            confidence: 'high',
            issues: [],
            source: 'local',
        });
        vi.mocked(createRequest).mockResolvedValue({
            id: 'req-1',
            seller_token: 'seller-token-1',
        } as never);
        vi.mocked(createEventLog).mockResolvedValue(undefined as never);
    });

    it('snapshots fixed workspace, form revision, introduction and concrete question switches', async () => {
        vi.mocked(getIntakeLinkBySlug).mockResolvedValue({ ...savedForm, organization_id: 'org-A' } as never);
        vi.mocked(getAccountById).mockResolvedValue({ id: savedForm.account_id, role: 'user', subscription_status: 'free', active_organization_id: 'org-B' } as never);
        vi.mocked(getAccountOrganizations).mockResolvedValue([{ id: 'org-A', subscription_status: 'team' }, { id: 'org-B' }] as never);
        const response = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701' }) }), { params: Promise.resolve({ slug: 'listing-form' }) });
        expect(response.status).toBe(200);
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-A', sourceFormId: savedForm.id, sourceFormRevision: 2, sellerIntro: savedForm.seller_intro, collectHoaQuestions: false, collectElectricMeterNumber: false }));
    });

    const nestedParams = (slug = 'jane', suffix = 'closing') => ({ params: Promise.resolve({ slug, suffix }) });
    const startRequest = (cookie = '') => new Request('http://localhost/api/intake/jane/forms/closing/start', {
        method: 'POST', headers: { cookie }, body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701' }),
    });
    const resumeCookie = Buffer.from(JSON.stringify({ a: '123 main st austin tx 78701', t: 'previous-token' })).toString('base64url');
    it('starts the exact nested form and keeps its source snapshot and form-keyed cookie', async () => {
        const response = await nestedStart(startRequest(), nestedParams());
        expect(response.status).toBe(200);
        expect(getIntakeLinkBySuffix).toHaveBeenCalledWith('jane', 'closing');
        expect(getIntakeLinkBySlug).not.toHaveBeenCalled();
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({ sourceFormId: savedForm.id, sourceFormRevision: 2, sellerIntro: savedForm.seller_intro }));
        expect(response.headers.get('set-cookie')).toContain(`us_intake_f_${savedForm.id}=`);
        expect(response.headers.get('set-cookie')).toContain('HttpOnly');
        expect(checkRateLimit).toHaveBeenLastCalledWith(expect.anything(), `form:${savedForm.id}:1.2.3.4`, expect.anything());
    });
    it('shares rate identity across renamed bases and flat/nested aliases', async () => {
        vi.mocked(getIntakeLinkBySlug).mockResolvedValue({ ...savedForm, account_id: 'acct-1' });
        await POST(startRequest(), { params: Promise.resolve({ slug: 'old-flat' }) });
        await nestedStart(startRequest(), nestedParams('new-base', 'closing'));
        expect(vi.mocked(checkRateLimit).mock.calls.map(call => call[1])).toEqual([
            `form:${savedForm.id}:1.2.3.4`, `form:${savedForm.id}:1.2.3.4`,
        ]);
    });
    it.each(['draft', 'in_progress'])('resumes the same form across its nested aliases (%s)', async status => {
        vi.mocked(getRequestBySellerToken).mockResolvedValue({ account_id: 'acct-1', organization_id: null, source_form_id: savedForm.id, property_address: '123 Main St, Austin, TX 78701', status } as never);
        const res = await nestedStart(startRequest(`us_intake_f_${savedForm.id}=${resumeCookie}`), nestedParams('renamed-base'));
        expect(await res.json()).toEqual({ sellerToken: 'previous-token' });
        expect(createRequest).not.toHaveBeenCalled();
    });
    it('does not read a sibling base cookie for a nested form at the same address', async () => {
        await nestedStart(startRequest(`us_intake_jane=${resumeCookie}; us_intake_f_other=${resumeCookie}`), nestedParams());
        expect(getRequestBySellerToken).not.toHaveBeenCalled();
        expect(createRequest).toHaveBeenCalledOnce();
    });
    it('migrates a matching historical flat-alias cookie when visiting a nested link', async () => {
        vi.mocked(getRequestBySellerToken).mockResolvedValue({ account_id: 'acct-1', organization_id: null, source_form_id: savedForm.id, property_address: '123 Main St, Austin, TX 78701', status: 'draft' } as never);
        const response = await nestedStart(startRequest(`us_intake_very-old-flat=${resumeCookie}`), nestedParams());
        expect(getSellerFormAliasSlugs).toHaveBeenCalledWith(savedForm.id, ['very-old-flat']);
        expect(await response.json()).toEqual({ sellerToken: 'previous-token' });
        expect(response.headers.get('set-cookie')).toContain(`us_intake_f_${savedForm.id}=`);
        expect(createRequest).not.toHaveBeenCalled();
    });
    it.each([{ source_form_id: 'sibling', status: 'draft' }, { source_form_id: savedForm.id, status: 'submitted' }, { source_form_id: null, status: 'draft' }])('rejects unsafe nested resume provenance: %j', async provenance => {
        vi.mocked(getRequestBySellerToken).mockResolvedValue({ account_id: 'acct-1', organization_id: null, property_address: '123 Main St, Austin, TX 78701', ...provenance } as never);
        await nestedStart(startRequest(`us_intake_f_${savedForm.id}=${resumeCookie}`), nestedParams());
        expect(createRequest).toHaveBeenCalledOnce();
    });
    it('serves only the active target configuration and fails closed for lost fixed membership', async () => {
        const metadata = await nestedMetadata(new Request('http://localhost'), nestedParams());
        expect(metadata.status).toBe(200);
        expect((await metadata.json()).sellerIntro).toBe(savedForm.seller_intro);
        vi.mocked(getIntakeLinkBySuffix).mockResolvedValue({ ...savedForm, organization_id: 'lost-org' });
        expect((await nestedMetadata(new Request('http://localhost'), nestedParams())).status).toBe(404);
        expect((await nestedStart(startRequest(), nestedParams())).status).toBe(404);
        expect(createRequest).not.toHaveBeenCalled();
    });
    it('limits unknown endings per IP and refuses starts if the persistent limiter is unavailable', async () => {
        vi.mocked(getIntakeLinkBySuffix).mockResolvedValue(null);
        expect((await nestedStart(startRequest(), nestedParams())).status).toBe(404);
        expect(checkRateLimit).toHaveBeenLastCalledWith(expect.anything(), 'unknown:1.2.3.4', expect.anything());
        vi.mocked(isRateLimitUnavailable).mockReturnValue(true);
        expect((await nestedStart(startRequest(), nestedParams('another'))).status).toBe(503);
        expect(createRequest).not.toHaveBeenCalled();
    });

    it.each([
        { source_form_id: 'different-form', organization_id: null },
        { source_form_id: savedForm.id, organization_id: 'wrong-workspace' },
    ])('cannot resume a request from another form or workspace: %j', async provenance => {
        const cookie = Buffer.from(JSON.stringify({ a: '123 main st austin tx 78701', t: 'previous-token' })).toString('base64url');
        vi.mocked(getRequestBySellerToken).mockResolvedValue({ account_id: 'acct-1', property_address: '123 Main St, Austin, TX 78701', status: 'draft', ...provenance } as never);
        const response = await POST(new Request('http://localhost', { method: 'POST', headers: { cookie: `us_intake_test-slug=${cookie}` }, body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701' }) }), { params: Promise.resolve({ slug: 'test-slug' }) });
        expect(response.status).toBe(200); expect(createRequest).toHaveBeenCalledOnce();
    });

    it('permits legacy NULL provenance resume only on the original identity and matching scope', async () => {
        const cookie = Buffer.from(JSON.stringify({ a: '123 main st austin tx 78701', t: 'previous-token' })).toString('base64url');
        vi.mocked(getRequestBySellerToken).mockResolvedValue({ account_id: 'acct-1', property_address: '123 Main St, Austin, TX 78701', status: 'draft', source_form_id: null, organization_id: null } as never);
        const response = await POST(new Request('http://localhost', { method: 'POST', headers: { cookie: `us_intake_test-slug=${cookie}` }, body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701' }) }), { params: Promise.resolve({ slug: 'test-slug' }) });
        expect(await response.json()).toEqual({ sellerToken: 'previous-token' }); expect(createRequest).not.toHaveBeenCalled();
    });

    it('returns 400 with missingFields when address is incomplete', async () => {
        const request = new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX' }),
        });

        const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Incomplete address');
        expect(body.message).toContain('house number, street address, city, state, and ZIP');
        expect(body.missingFields).toContain('zip');
        expect(createRequest).not.toHaveBeenCalled();
    });

    it('allows and logs addresses that have a street name but no house number', async () => {
        const request = new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: 'Oakwood Court, Middle Smithfield Township, PA 18302' }),
        });

        const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(200);
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
            propertyAddress: 'Oakwood Court, Middle Smithfield Township, PA 18302',
        }));
        expect(createEventLog).toHaveBeenCalledWith(expect.objectContaining({
            eventData: expect.objectContaining({
                submitted_property_address: 'Oakwood Court, Middle Smithfield Township, PA 18302',
                canonical_property_address: 'Oakwood Court, Middle Smithfield Township, PA 18302',
                street_has_number: false,
            }),
        }));
    });

    it('creates request and returns seller token for complete address', async () => {
        const request = new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701' }),
        });

        const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ sellerToken: 'seller-token-1' });
        expect(buildStructuredPropertyAddress).toHaveBeenCalledWith('123 Main St, Austin, TX 78701');
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
            propertyAddress: '123 Main St, Austin, TX 78701',
        }));
        expect(createEventLog).toHaveBeenCalledWith(expect.objectContaining({
            eventData: expect.objectContaining({
                submitted_property_address: '123 Main St, Austin, TX 78701',
                canonical_property_address: '123 Main St, Austin, TX 78701',
                address_was_canonicalized: false,
                street_has_number: true,
            }),
        }));
    });

    it('starts a request for a Free account already at its monthly limit', async () => {
        vi.mocked(getMonthlyUsage).mockResolvedValue({ used: 3, limit: 3, plan: 'free' } as never);

        const response = await POST(new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701' }),
        }), { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(200);
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
            status: 'draft',
            meteredAt: null,
        }));
    });

    it('uses saved Branding Profile and utility-category defaults for a new request', async () => {
        vi.mocked(getIntakeLinkBySlug).mockResolvedValue({
            slug: 'test-slug',
            account_id: 'acct-1',
            is_active: true,
            default_brand_profile_id: 'brand-2',
            default_utility_categories: ['electric', 'water', 'internet'],
            default_packet_mode: 'simple',
            advanced_modules: [],
            advanced_module_exclusions: {},
        } as never);
        vi.mocked(getIntakeBrandProfile).mockResolvedValue({ id: 'brand-2' } as never);

        const request = new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701' }),
        });

        const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(200);
        expect(getIntakeBrandProfile).toHaveBeenCalledWith('acct-1', undefined, 'brand-2');
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
            brandProfileId: 'brand-2',
            utilityCategories: ['electric', 'water', 'internet'],
        }));
        expect(createEventLog).toHaveBeenCalledWith(expect.objectContaining({
            eventData: expect.objectContaining({
                utility_categories: ['electric', 'water', 'internet'],
            }),
        }));
    });

    it('returns a generic 404 for an inactive reusable form', async () => {
        vi.mocked(getIntakeLinkBySlug).mockResolvedValue({
            slug: 'test-slug',
            account_id: 'acct-1',
            is_active: false,
        } as never);

        const request = new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701' }),
        });

        const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'Not found' });
        expect(getAccountById).not.toHaveBeenCalled();
        expect(createRequest).not.toHaveBeenCalled();
    });

    it('accepts a complete no-comma address after parser normalization', async () => {
        const request = new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: '135 acorn ln kunkletown pa 18058' }),
        });

        const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ sellerToken: 'seller-token-1' });
        expect(buildStructuredPropertyAddress).toHaveBeenCalledWith('135 acorn ln, Kunkletown, PA 18058');
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
            propertyAddress: '135 acorn ln, Kunkletown, PA 18058',
        }));
    });

    it('uses reusable-link advanced module defaults for paid accounts', async () => {
        vi.mocked(getIntakeLinkBySlug).mockResolvedValue({
            slug: 'test-slug',
            account_id: 'acct-1',
            is_active: true,
            default_packet_mode: 'advanced',
            advanced_modules: ['mailbox_access', 'service_providers'],
            advanced_module_exclusions: { service_providers: ['service_provider_notes'] },
        } as never);
        vi.mocked(getAccountById).mockResolvedValue({
            id: 'acct-1',
            role: 'user',
            subscription_status: 'pro',
            active_organization_id: null,
        } as never);

        const request = new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701' }),
        });

        const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(200);
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
            packetMode: 'advanced',
            advancedModules: ['mailbox_access', 'service_providers'],
            advancedModuleExclusions: { service_providers: ['service_provider_notes'] },
        }));
    });

    it('falls back to simple mode for free accounts even when reusable-link default is advanced', async () => {
        vi.mocked(getIntakeLinkBySlug).mockResolvedValue({
            slug: 'test-slug',
            account_id: 'acct-1',
            is_active: true,
            default_packet_mode: 'advanced',
            advanced_modules: ['mailbox_access', 'service_providers'],
            advanced_module_exclusions: { service_providers: ['service_provider_notes'] },
        } as never);
        vi.mocked(getAccountById).mockResolvedValue({
            id: 'acct-1',
            role: 'user',
            subscription_status: 'free',
            active_organization_id: null,
        } as never);

        const request = new Request('http://localhost/api/intake/test-slug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyAddress: '123 Main St, Austin, TX 78701' }),
        });

        const response = await POST(request, { params: Promise.resolve({ slug: 'test-slug' }) });

        expect(response.status).toBe(200);
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
            packetMode: 'simple',
            advancedModules: [],
            advancedModuleExclusions: {},
        }));
    });
});
