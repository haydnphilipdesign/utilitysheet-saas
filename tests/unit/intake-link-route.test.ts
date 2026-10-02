import { beforeEach, describe, expect, it, vi } from 'vitest';
import { savedForm } from '../fixtures/saved-seller-forms';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), activation: vi.fn(), profiles: vi.fn(), ensure: vi.fn(), save: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/stack/server', () => ({ stackServerApp: { getUser: mocks.getUser } }));
vi.mock('@/lib/activation/ensure-account-activation', () => ({ ensureAccountActivation: mocks.activation }));
vi.mock('@/lib/neon/queries', () => ({ getBrandProfiles: mocks.profiles, getOrCreateIntakeLink: mocks.ensure, saveSellerForm: mocks.save }));
import { GET, POST } from '@/app/api/intake-link/route';
function post(body: unknown) { return POST(new Request('http://localhost/api/intake-link', { method: 'POST', body: JSON.stringify(body) })); }
beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: 'user-1' });
    mocks.activation.mockResolvedValue({ account: { id: 'account-1', subscription_status: 'free' }, activeOrganization: null });
    mocks.profiles.mockResolvedValue([]); mocks.ensure.mockResolvedValue(savedForm);
    mocks.save.mockResolvedValue({ ...savedForm, revision: 3 });
});
describe('legacy intake adapter', () => {
    it('retains response shape while selecting the scoped default', async () => {
        const res = await GET(); expect(res.status).toBe(200);
        expect(mocks.ensure).toHaveBeenCalledWith('account-1', undefined);
        expect((await res.json()).intakeLink).toMatchObject({ slug: savedForm.slug, is_active: true, defaultBrandProfileId: null, revision: 2 });
    });
    it('saves free question/access settings in one atomic ID/revision write', async () => {
        expect((await post({ isActive: false, collectHoaQuestions: true, defaultUtilityCategories: ['electric'] })).status).toBe(200);
        expect(mocks.save).toHaveBeenCalledExactlyOnceWith('account-1', undefined, savedForm.id, 2, { isActive: false, collectHoaQuestions: true, defaultUtilityCategories: ['electric'] });
    });
    it.each([{ slug: 'custom', defaultBrandProfileId: '00000000-0000-4000-8000-000000000022' }, { isActive: false, defaultPacketMode: 'advanced' }, { isActive: false, advancedModules: ['service_providers'] }])('rejects invalid/paid changes before any write: %j', async body => {
        expect((await post(body)).status).toBeGreaterThanOrEqual(400); expect(mocks.save).not.toHaveBeenCalled();
    });
    it('validates foreign brand before changing a paid slug', async () => {
        mocks.activation.mockResolvedValue({ account: { id: 'account-1', subscription_status: 'pro' }, activeOrganization: { id: 'org-A' } });
        expect((await post({ slug: 'new-slug', defaultBrandProfileId: '00000000-0000-4000-8000-000000000022' })).status).toBe(400);
        expect(mocks.save).not.toHaveBeenCalled();
    });
    it('saves paid settings atomically without propagating to existing requests', async () => {
        mocks.activation.mockResolvedValue({ account: { id: 'account-1', subscription_status: 'pro' }, activeOrganization: { id: 'org-A' } });
        expect((await post({ slug: 'new-slug', defaultPacketMode: 'advanced', advancedModules: ['service_providers'] })).status).toBe(200);
        expect(mocks.save).toHaveBeenCalledExactlyOnceWith('account-1', 'org-A', savedForm.id, 2, expect.objectContaining({ slug: 'new-slug', defaultPacketMode: 'advanced', advancedModules: ['service_providers'] }));
    });
    it('reports stale revision and alias collision without exposing raw errors', async () => {
        mocks.save.mockRejectedValue({ code: 'SF409' }); expect((await post({ revision: 1, isActive: false })).status).toBe(409);
        mocks.save.mockRejectedValue({ code: '23505' }); expect((await post({ isActive: false })).status).toBe(409);
    });
    it.each([{}, { defaultUtilityCategories: [] }, { accountId: 'forged', isActive: false }, { sellerIntro: 'x'.repeat(501) }])('rejects invalid payload %j', async body => {
        expect((await post(body)).status).toBe(400); expect(mocks.save).not.toHaveBeenCalled();
    });
});
