import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureActivation: vi.fn(),
  getBrandProfiles: vi.fn(),
  getRequestCounts: vi.fn(),
  getIntakeLink: vi.fn(),
  createBrandProfile: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/stack/server', () => ({
  stackServerApp: { getUser: mocks.getUser },
}));
vi.mock('@/lib/activation/ensure-account-activation', () => ({
  ensureAccountActivation: mocks.ensureActivation,
}));
vi.mock('@/lib/neon/queries', () => ({
  getBrandProfiles: mocks.getBrandProfiles,
  getBrandProfileRequestCounts: mocks.getRequestCounts,
  getIntakeLinkByAccountId: mocks.getIntakeLink,
  createBrandProfile: mocks.createBrandProfile,
}));

import { GET } from '@/app/api/branding/route';

describe('GET /api/branding organization scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: 'stack_1' });
    mocks.ensureActivation.mockResolvedValue({
      account: {
        id: 'acct_1',
        active_organization_id: 'org_stale',
        full_name: 'Owner',
        email: 'owner@example.com',
      },
      activeOrganization: null,
    });
    mocks.getBrandProfiles.mockResolvedValue([{
      id: 'profile_personal',
      account_id: 'acct_1',
      organization_id: null,
      name: 'Personal profile',
    }]);
    mocks.getRequestCounts.mockResolvedValue({});
    mocks.getIntakeLink.mockResolvedValue(null);
  });

  it('does not trust a stale active-organization pointer without a live membership', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.getBrandProfiles).toHaveBeenCalledWith('acct_1', undefined);
    expect(mocks.getBrandProfiles).not.toHaveBeenCalledWith('acct_1', 'org_stale');
  });
});
