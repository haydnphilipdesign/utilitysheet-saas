import { beforeEach, describe, expect, it, vi } from 'vitest';
import { savedForm } from '../fixtures/saved-seller-forms';
const m = vi.hoisted(() => ({
    user: vi.fn(),
    activation: vi.fn(),
    profiles: vi.fn(),
    ensure: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    setDefault: vi.fn(),
    links: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser: m.user } }));
vi.mock('@/lib/activation/ensure-account-activation', () => ({
    ensureAccountActivation: m.activation,
}));
vi.mock('@/lib/neon/queries', () => ({
    getBrandProfiles: m.profiles,
    getOrCreateIntakeLink: m.ensure,
    listSellerForms: m.list,
    getSellerFormCount: m.count,
    getSellerForm: m.get,
    saveSellerForm: m.save,
    setDefaultSellerForm: m.setDefault,
    getSellerFormLinkScope: m.links,
}));
import { GET, POST } from '@/app/api/seller-forms/route';
import { PATCH } from '@/app/api/seller-forms/[id]/route';
import { POST as makeDefault } from '@/app/api/seller-forms/[id]/default/route';
import { PATCH as renameBase } from '@/app/api/seller-form-link-base/route';
const params = { params: Promise.resolve({ id: savedForm.id }) };
const request = (body: unknown) =>
    new Request('http://localhost/api/seller-forms', {
        method: 'POST',
        body: JSON.stringify(body),
    });
beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    m.user.mockResolvedValue({ id: 'user-1' });
    m.activation.mockResolvedValue({
        account: { id: savedForm.account_id, subscription_status: 'pro' },
        activeOrganization: { id: 'org-A', name: 'Workspace A' },
    });
    m.profiles.mockResolvedValue([]);
    m.ensure.mockResolvedValue(savedForm);
    m.list.mockResolvedValue([savedForm]);
    m.count.mockResolvedValue(1);
    m.get.mockResolvedValue(savedForm);
    m.save.mockResolvedValue(savedForm);
    m.setDefault.mockResolvedValue(savedForm);
    m.links.mockResolvedValue(null);
});
function enablePilot() {
    vi.stubEnv('SAVED_SELLER_FORMS_ENABLED', 'true');
    vi.stubEnv('SAVED_SELLER_FORMS_PILOT_ACCOUNT_IDS', savedForm.account_id);
    vi.stubEnv('SAVED_SELLER_FORMS_TECHNICAL_CAP', '20');
}
const linkScope = () => ({
    rootFormId: savedForm.id, baseSlug: 'jane-smith', baseRevision: 2,
    defaultFormId: savedForm.id, defaultFormName: 'Listing', defaultIsActive: true,
    suffixes: {} as Record<string, string>, reserved: [],
});
describe('shared base and form-ending APIs', () => {
    it('renames the server-selected base with its own optimistic revision', async () => {
        m.links.mockResolvedValue(linkScope());
        const res = await renameBase(request({ base: 'jane-team', revision: 2 }));
        expect(res.status).toBe(200);
        expect(m.links).toHaveBeenCalledWith(savedForm.account_id, 'org-A');
        expect(m.save).toHaveBeenCalledExactlyOnceWith(savedForm.account_id, 'org-A', savedForm.id, 2, { slug: 'jane-team' });
    });
    it('renames the base on the form that owns the name, not on the current default', async () => {
        const root = '00000000-0000-4000-8000-000000000099';
        m.links.mockResolvedValue({ ...linkScope(), rootFormId: root });
        await renameBase(request({ base: 'new-base', revision: 2 }));
        expect(m.save.mock.calls[0][2]).toBe(root);
    });
    it('shares the bare link for the default and the ending link for other forms', async () => {
        m.links.mockResolvedValue({ ...linkScope(), suffixes: { [savedForm.id]: 'listing' } });
        const asDefault = await (await GET())!.json();
        expect(asDefault.forms[0].url).toMatch(/\/form\/jane-smith$/);
        expect(asDefault.forms[0].endingUrl).toMatch(/\/form\/jane-smith\/listing$/);
        expect(asDefault.linkBase).toMatchObject({ formId: savedForm.id, formName: 'Listing' });
        m.links.mockResolvedValue({ ...linkScope(), defaultFormId: 'another-form', defaultFormName: 'Closing', suffixes: { [savedForm.id]: 'listing' } });
        const notDefault = await (await GET())!.json();
        expect(notDefault.forms[0].url).toMatch(/\/form\/jane-smith\/listing$/);
        expect(notDefault.linkBase).toMatchObject({ formId: 'another-form', formName: 'Closing' });
        expect(notDefault.forms[0]).not.toHaveProperty('isBaseForm');
    });
    it.each([{ base: 'UPPER', revision: 2 }, { base: 'valid', revision: 2, organizationId: 'forged' }, { base: 'valid' }])('rejects unsafe base inputs %j without writing', async body => {
        expect((await renameBase(request(body))).status).toBe(400);
        expect(m.save).not.toHaveBeenCalled();
    });
    it('requires authentication and a paid fixed scope for base changes', async () => {
        m.user.mockResolvedValue(null);
        expect((await renameBase(request({ base: 'new-base', revision: 2 }))).status).toBe(401);
        m.user.mockResolvedValue({ id: 'user-1' });
        m.activation.mockResolvedValue({ account: { id: savedForm.account_id, subscription_status: 'free' }, activeOrganization: null });
        m.links.mockResolvedValue(linkScope());
        expect((await renameBase(request({ base: 'new-base', revision: 2 }))).status).toBe(403);
        expect(m.save).not.toHaveBeenCalled();
    });
    it('reports stale base edits and reserved-base collisions', async () => {
        m.links.mockResolvedValue(linkScope());
        m.save.mockRejectedValueOnce({ code: 'SF409' });
        expect((await renameBase(request({ base: 'new-base', revision: 1 }))).status).toBe(409);
        m.save.mockRejectedValueOnce({ code: '23505' });
        const res = await renameBase(request({ base: 'taken-base', revision: 2 }));
        expect((await res.json()).code).toBe('SLUG_IN_USE');
    });
    it('lets the form that owns the base name set an ending and maps a historical suffix collision', async () => {
        m.links.mockResolvedValue(linkScope());
        const owner = await PATCH(request({ suffix: 'listing', revision: 2 }), params);
        expect(owner!.status).toBe(200);
        expect(m.save).toHaveBeenCalledExactlyOnceWith(savedForm.account_id, 'org-A', savedForm.id, 2, { suffix: 'listing' });
        const invalid = await PATCH(request({ suffix: 'Not Valid', revision: 2 }), params);
        expect((await invalid!.json()).code).toBe('INVALID_SUFFIX');
        m.links.mockResolvedValue({ ...linkScope(), rootFormId: 'other-root', suffixes: { [savedForm.id]: 'listing' } });
        m.save.mockRejectedValueOnce({ code: 'SF423' });
        const collision = await PATCH(request({ suffix: 'reserved', revision: 2 }), params);
        expect(collision!.status).toBe(409);
        expect((await collision!.json()).code).toBe('SUFFIX_IN_USE');
    });
    it('retains a published ending on downgrade and blocks a customization', async () => {
        m.activation.mockResolvedValue({ account: { id: savedForm.account_id, subscription_status: 'free' }, activeOrganization: null });
        m.links.mockResolvedValue({ ...linkScope(), rootFormId: 'other-root', suffixes: { [savedForm.id]: 'listing' } });
        expect((await PATCH(request({ suffix: 'listing', name: 'Still editable', revision: 2 }), params))!.status).toBe(200);
        m.save.mockClear();
        expect((await PATCH(request({ suffix: 'new-ending', revision: 2 }), params))!.status).toBe(403);
        expect(m.save).not.toHaveBeenCalled();
    });
});
describe('creator scoped saved form APIs', () => {
    it('requires authentication for reads and writes', async () => {
        m.user.mockResolvedValue(null);
        expect((await GET())!.status).toBe(401);
        expect((await POST(request({ name: 'New' })))!.status).toBe(401);
        expect(m.save).not.toHaveBeenCalled();
    });
    it('lists only the authenticated owner/workspace and keeps rollout off by default', async () => {
        const res = await GET();
        expect(res!.status).toBe(200);
        expect(m.list).toHaveBeenCalledWith(savedForm.account_id, 'org-A');
        expect((await res!.json()).capabilities.canCreate).toBe(false);
        expect((await POST(request({ name: 'Closing' })))!.status).toBe(403);
        expect(m.save).not.toHaveBeenCalled();
    });
    it('requires explicit eligibility and a configured technical cap, independently of pricing', async () => {
        vi.stubEnv('SAVED_SELLER_FORMS_ENABLED', 'true');
        vi.stubEnv(
            'SAVED_SELLER_FORMS_PILOT_ACCOUNT_IDS',
            savedForm.account_id,
        );
        expect((await POST(request({ name: 'Closing' })))!.status).toBe(403);
        enablePilot();
        m.list.mockResolvedValue([]);
        m.activation.mockResolvedValue({
            account: { id: savedForm.account_id, subscription_status: 'free' },
            activeOrganization: null,
        });
        expect(
            (await POST(
                request({ name: 'Closing', collectHoaQuestions: true }),
            ))!.status,
        ).toBe(201);
    });
    it('duplicates configuration without identity, default, URL, or seller data', async () => {
        enablePilot();
        expect(
            (await POST(
                request({ name: 'Closing', duplicateFromId: savedForm.id }),
            ))!.status,
        ).toBe(201);
        expect(m.get).toHaveBeenCalledWith(
            savedForm.id,
            savedForm.account_id,
            'org-A',
        );
        const config = m.save.mock.calls[0][4];
        expect(config).toMatchObject({
            name: 'Closing',
            sellerHeading: savedForm.seller_heading,
            sellerIntro: savedForm.seller_intro,
            collectHoaQuestions: false,
        });
        expect(config).not.toHaveProperty('slug');
        expect(config).not.toHaveProperty('isDefault');
        expect(m.save.mock.calls[0][2]).toBeNull();
    });
    it('rejects foreign duplicate/form IDs without a write', async () => {
        enablePilot();
        m.get.mockResolvedValue(null);
        expect(
            (await POST(
                request({ name: 'Closing', duplicateFromId: savedForm.id }),
            ))!.status,
        ).toBe(404);
        expect(
            (await PATCH(request({ revision: 2, name: 'Changed' }), params))!
                .status,
        ).toBe(404);
        expect(m.save).not.toHaveBeenCalled();
    });
    it.each([
        { name: 'No revision' },
        { revision: 2, organizationId: 'forged', name: 'X' },
        { revision: 2, sellerIntro: 'x'.repeat(501) },
        { revision: 2, sellerHeading: 'x'.repeat(81) },
    ])('rejects unsafe edit %j', async (body) => {
        expect((await PATCH(request(body), params))!.status).toBe(400);
        expect(m.save).not.toHaveBeenCalled();
    });
    it('rejects stale revision at the atomic writer and offers reload guidance', async () => {
        m.save.mockRejectedValue({ code: 'SF409' });
        const res = await PATCH(
            request({ revision: 1, name: 'Changed' }),
            params,
        );
        expect(res!.status).toBe(409);
        expect((await res!.json()).code).toBe('FORM_REVISION_CONFLICT');
    });
    it('switches only the scoped default and leaves referral identity to storage', async () => {
        expect((await makeDefault(request({}), params))!.status).toBe(200);
        expect(m.setDefault).toHaveBeenCalledWith(
            savedForm.account_id,
            'org-A',
            savedForm.id,
        );
        expect(m.save).not.toHaveBeenCalled();
    });
    it('retains paid configuration after downgrade while still allowing free question edits', async () => {
        m.get.mockResolvedValue({
            ...savedForm,
            default_packet_mode: 'advanced',
            advanced_modules: ['service_providers'],
        });
        m.activation.mockResolvedValue({
            account: { id: savedForm.account_id, subscription_status: 'free' },
            activeOrganization: null,
        });
        expect(
            (await PATCH(
                request({
                    revision: 2,
                    name: 'New name',
                    collectHoaQuestions: true,
                }),
                params,
            ))!.status,
        ).toBe(200);
        expect(m.save.mock.calls[0][4]).not.toHaveProperty('defaultPacketMode');
    });
    it.each(['free', 'pro', 'team'])('reports allowance and enforces %s commercial limit before allocating', async (plan) => {
        enablePilot();
        m.activation.mockResolvedValue({ account: { id: savedForm.account_id, subscription_status: plan === 'pro' ? 'pro' : 'free' }, activeOrganization: { id: 'org-A', subscription_status: plan === 'team' ? 'team' : 'free' } });
        const allowance = plan === 'free' ? 1 : 10;
        m.list.mockResolvedValue(Array.from({ length: allowance }, (_, n) => ({ ...savedForm, id: String(n), is_active: false })));
        m.count.mockResolvedValue(allowance);
        const listed = await GET();
        expect((await listed!.json()).capabilities).toMatchObject({ allowance, usage: allowance, reason: 'commercial', canCreate: false });
        const denied = await POST(request({ name: 'Over limit', duplicateFromId: savedForm.id }));
        expect(denied!.status).toBe(403);
        expect((await denied!.json()).code).toBe('FORM_ALLOWANCE_REACHED');
        expect(m.save).not.toHaveBeenCalled();
    });
    it('does not borrow entitlement from a Team workspace outside the authenticated current scope', async () => {
        enablePilot();
        m.activation.mockResolvedValue({ account: { id: savedForm.account_id, subscription_status: 'free' }, activeOrganization: { id: 'org-B', subscription_status: 'free' }, organizations: [{ id: 'org-A', subscription_status: 'team' }] });
        const res = await POST(request({ name: 'Not paid here' }));
        expect((await res!.json()).capabilities.allowance).toBe(1);
        expect(m.list).toHaveBeenCalledWith(savedForm.account_id, 'org-B');
        expect(m.save).not.toHaveBeenCalled();
    });
    it.each([{ organizationId: 'org-paid' }, { isPaid: true }, { allowance: 100 }])('rejects forged commercial inputs %j', async (forged) => {
        enablePilot(); m.list.mockResolvedValue([]);
        expect((await POST(request({ name: 'Forged', ...forged })))!.status).toBe(400);
        expect(m.save).not.toHaveBeenCalled();
    });
    it('maps atomic allowance races to a commercial explanation without exposing raw SQL detail', async () => {
        enablePilot(); m.save.mockRejectedValue({ code: 'SF402', detail: '{"allowance":10,"usage":10}' });
        const res = await POST(request({ name: 'Concurrent' }));
        expect(res!.status).toBe(403); expect(await res!.json()).toMatchObject({ code: 'FORM_ALLOWANCE_REACHED', allowance: 10, usage: 10 });
    });

});
