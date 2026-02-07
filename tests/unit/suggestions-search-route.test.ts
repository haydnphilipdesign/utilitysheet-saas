import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/suggestions/search/route';

describe('GET /api/suggestions/search (deprecated)', () => {
    it('returns 403 with deprecation message', async () => {
        const res = await GET();
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toContain('/api/seller/[token]/suggestions/search');
    });
});
