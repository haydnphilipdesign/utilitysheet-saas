import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getBrandProfileMock: vi.fn(),
    getOrCreateAccountMock: vi.fn(),
    getOrganizationByIdMock: vi.fn(),
    createBrandProfileMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/stack/server', () => ({
    stackServerApp: { getUser: mocks.getUserMock },
}));

vi.mock('@/lib/neon/queries', () => ({
    getBrandProfile: mocks.getBrandProfileMock,
    getOrCreateAccount: mocks.getOrCreateAccountMock,
    getOrganizationById: mocks.getOrganizationByIdMock,
    createBrandProfile: mocks.createBrandProfileMock,
}));

import { POST } from '@/app/api/branding/[id]/duplicate/route';

function duplicate(id = 'profile_1') {
    return POST(
        new Request(`http://localhost/api/branding/${id}/duplicate`, { method: 'POST' }),
        { params: Promise.resolve({ id }) }
    );
}

const baseProfile = {
    id: 'profile_1',
    account_id: 'acct_owner',
    organization_id: null,
    name: 'Acme Realty',
    logo_url: 'https://cdn.example.com/logo.png',
    primary_color: '#123456',
    secondary_color: '#654321',
    contact_name: 'Jane Smith',
    contact_phone: '(555) 123-4567',
    contact_email: 'jane@acme.test',
    contact_website: 'acme.test',
    disclaimer_text: 'Provided for convenience only.',
    message_templates: { seller_request: { sms: 'Custom SMS {{link}}' } },
    is_default: true,
    buyer_next_steps: ['Call the electric company'],
    next_steps_title: 'Move-in checklist',
    show_powered_by: false,
    show_generation_date: false,
    welcome_message: 'Welcome to your new home!',
};

describe('POST /api/branding/[id]/duplicate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserMock.mockResolvedValue({
            id: 'user_owner',
            primaryEmail: 'owner@example.com',
            displayName: 'Owner',
        });
        mocks.getBrandProfileMock.mockResolvedValue({ ...baseProfile });
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_owner',
            subscription_status: 'pro',
            active_organization_id: null,
        });
        mocks.createBrandProfileMock.mockImplementation(async (data: { name: string }) => ({
            ...baseProfile,
            id: 'profile_copy',
            name: data.name,
            is_default: false,
        }));
    });

    it('rejects unauthenticated requests', async () => {
        mocks.getUserMock.mockResolvedValue(null);
        const response = await duplicate();
        expect(response.status).toBe(401);
        expect(mocks.createBrandProfileMock).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing profile', async () => {
        mocks.getBrandProfileMock.mockResolvedValue(null);
        const response = await duplicate('missing');
        expect(response.status).toBe(404);
        expect(mocks.createBrandProfileMock).not.toHaveBeenCalled();
    });

    it('rejects profiles owned by another account', async () => {
        mocks.getBrandProfileMock.mockResolvedValue({ ...baseProfile, account_id: 'acct_other' });
        const response = await duplicate();
        expect(response.status).toBe(403);
        expect(mocks.createBrandProfileMock).not.toHaveBeenCalled();
    });

    it('rejects organization profiles outside the active organization', async () => {
        mocks.getBrandProfileMock.mockResolvedValue({ ...baseProfile, organization_id: 'org_other' });
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_owner',
            subscription_status: 'pro',
            active_organization_id: 'org_active',
        });
        const response = await duplicate();
        expect(response.status).toBe(403);
        expect(mocks.createBrandProfileMock).not.toHaveBeenCalled();
    });

    it('rejects free accounts with UPGRADE_REQUIRED', async () => {
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_owner',
            subscription_status: 'free',
            active_organization_id: null,
        });
        const response = await duplicate();
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe('UPGRADE_REQUIRED');
        expect(mocks.createBrandProfileMock).not.toHaveBeenCalled();
    });

    it('copies configurable content into a non-default copy in the same scope', async () => {
        const response = await duplicate();

        expect(response.status).toBe(201);
        expect(mocks.createBrandProfileMock).toHaveBeenCalledWith({
            accountId: 'acct_owner',
            organizationId: undefined,
            name: 'Acme Realty (Copy)',
            logoUrl: baseProfile.logo_url,
            primaryColor: baseProfile.primary_color,
            secondaryColor: baseProfile.secondary_color,
            contactName: baseProfile.contact_name,
            contactPhone: baseProfile.contact_phone,
            contactEmail: baseProfile.contact_email,
            contactWebsite: baseProfile.contact_website,
            disclaimerText: baseProfile.disclaimer_text,
            messageTemplates: baseProfile.message_templates,
            isDefault: false,
            buyerNextSteps: baseProfile.buyer_next_steps,
            nextStepsTitle: baseProfile.next_steps_title,
            showPoweredBy: false,
            showGenerationDate: false,
            welcomeMessage: baseProfile.welcome_message,
        });
        const body = await response.json();
        expect(body.id).toBe('profile_copy');
        expect(body.is_default).toBe(false);
    });

    it('duplicates a team profile into the same organization for team members', async () => {
        mocks.getBrandProfileMock.mockResolvedValue({
            ...baseProfile,
            account_id: 'acct_creator',
            organization_id: 'org_active',
        });
        mocks.getOrCreateAccountMock.mockResolvedValue({
            id: 'acct_member',
            subscription_status: 'free',
            active_organization_id: 'org_active',
        });
        mocks.getOrganizationByIdMock.mockResolvedValue({
            id: 'org_active',
            subscription_status: 'team',
        });

        const response = await duplicate();

        expect(response.status).toBe(201);
        expect(mocks.createBrandProfileMock).toHaveBeenCalledWith(expect.objectContaining({
            accountId: 'acct_member',
            organizationId: 'org_active',
            isDefault: false,
        }));
    });

    it('keeps the copy name within the brand-name limit', async () => {
        mocks.getBrandProfileMock.mockResolvedValue({
            ...baseProfile,
            name: 'A'.repeat(60),
        });

        const response = await duplicate();

        expect(response.status).toBe(201);
        const createdName = mocks.createBrandProfileMock.mock.calls[0][0].name as string;
        expect(createdName.endsWith(' (Copy)')).toBe(true);
        expect(createdName.length).toBeLessThanOrEqual(60);
    });
});
