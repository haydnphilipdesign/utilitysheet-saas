import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/neon/queries/updates', () => ({
    getProductUpdates: vi.fn(),
}));

import { GET } from '@/app/api/updates/route';
import { getProductUpdates } from '@/lib/neon/queries/updates';

const getProductUpdatesMock = vi.mocked(getProductUpdates);

describe('GET /api/updates', () => {
    it('returns published updates and passes limit/offset', async () => {
        getProductUpdatesMock.mockResolvedValue([{ id: 'u1' }] as Awaited<ReturnType<typeof getProductUpdates>>);

        const response = await GET(new Request('http://localhost/api/updates?limit=3&offset=2'));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([{ id: 'u1' }]);

        expect(getProductUpdates).toHaveBeenCalledWith({
            limit: 3,
            offset: 2,
            includeUnpublished: false,
        });
    });

    it('clamps limit to 20', async () => {
        getProductUpdatesMock.mockResolvedValue([]);

        await GET(new Request('http://localhost/api/updates?limit=999'));

        expect(getProductUpdates).toHaveBeenCalledWith({
            limit: 20,
            offset: 0,
            includeUnpublished: false,
        });
    });
});
