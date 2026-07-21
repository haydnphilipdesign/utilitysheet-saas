import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getOrCreateAccount: vi.fn(),
  updateAccount: vi.fn(),
  setDisplayName: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/stack/server', () => ({
  stackServerApp: { getUser: mocks.getUser },
}));
vi.mock('@/lib/neon/queries', () => ({
  getOrCreateAccount: mocks.getOrCreateAccount,
  updateAccount: mocks.updateAccount,
  getMonthlyUsage: vi.fn(),
}));
vi.mock('@/lib/activation/ensure-account-activation', () => ({
  ensureAccountActivation: vi.fn(),
}));

import { POST } from '@/app/api/account/route';

describe('POST /api/account profile update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      id: 'stack_1',
      primaryEmail: 'owner@example.com',
      displayName: 'Old Name',
      setDisplayName: mocks.setDisplayName,
    });
    mocks.getOrCreateAccount.mockResolvedValue({ id: 'acct_1' });
    mocks.updateAccount.mockResolvedValue({ id: 'acct_1', full_name: 'New Name' });
  });

  it('updates Stack identity before the UtilitySheet profile', async () => {
    const response = await POST(new Request('http://localhost/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'New Name' }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.setDisplayName).toHaveBeenCalledWith('New Name');
    expect(mocks.updateAccount).toHaveBeenCalledWith('acct_1', {
      fullName: 'New Name',
      notificationPreferences: undefined,
    });
    expect(mocks.setDisplayName.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.updateAccount.mock.invocationCallOrder[0],
    );
  });

  it('derives account identity from the authenticated user, not the request body', async () => {
    const response = await POST(new Request('http://localhost/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'New Name', account_id: 'acct_attacker' }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.getOrCreateAccount).toHaveBeenCalledWith('stack_1', 'owner@example.com');
    expect(mocks.updateAccount).toHaveBeenCalledWith('acct_1', {
      fullName: 'New Name',
      notificationPreferences: undefined,
    });
  });
});
