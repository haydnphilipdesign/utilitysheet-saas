import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getProject: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/stack/server', () => ({
  stackServerApp: { getProject: mocks.getProject },
}));

import { GET } from '@/app/api/auth/config/route';

describe('GET /api/auth/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only public sign-in capabilities from the Stack project', async () => {
    mocks.getProject.mockResolvedValue({
      config: {
        credentialEnabled: true,
        oauthProviders: [{ id: 'google' }],
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      credentialEnabled: true,
      oauthProviderIds: ['google'],
    });
  });

  it('fails closed when Stack project configuration is unavailable', async () => {
    mocks.getProject.mockRejectedValue(new Error('Stack unavailable'));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Authentication options are temporarily unavailable',
    });
  });
});
