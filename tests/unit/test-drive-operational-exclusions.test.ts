import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
    return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('test-drive operational exclusions', () => {
    it('excludes demos from customer lists, stats, weekly summaries, and request eligibility counts', () => {
        const requestQueries = source('lib/neon/queries/requests.ts');
        const exclusionCount = requestQueries.match(/COALESCE\(is_demo, FALSE\) = FALSE/g)?.length || 0;
        expect(exclusionCount).toBeGreaterThanOrEqual(10);
        expect(requestQueries).toContain("status = 'sent'");
        expect(requestQueries).toContain('needs_attention');
    });

    it('excludes demos from activation outreach, provider memory, and Branding Profile usage', () => {
        expect(source('lib/neon/queries/activation-outreach.ts')).toContain('COALESCE(is_demo, FALSE) = FALSE');
        expect(source('lib/neon/queries/provider-memory.ts')).toContain('COALESCE(r.is_demo, FALSE) = FALSE');
        expect(source('lib/neon/queries/brand-profiles.ts')).toContain('COALESCE(is_demo, FALSE) = FALSE');
        expect(source('app/api/seller/[token]/route.ts')).toContain('COALESCE(r.is_demo, FALSE) = FALSE');
    });

    it('excludes demos from admin latest work and seller-progress/abandonment reporting', () => {
        expect(source('lib/admin/index.ts')).toContain('COALESCE(r.is_demo, FALSE) = FALSE');
        const abandonment = source('app/(admin)/admin/abandonment/page.tsx');
        expect(abandonment.match(/COALESCE\((?:r\.)?is_demo, FALSE\) = FALSE/g)?.length).toBeGreaterThanOrEqual(6);
    });

    it('preserves existing activation, habit, testimonial, and referral exclusions', () => {
        expect(source('lib/admin/activation-funnel.ts').match(/COALESCE\(is_demo, FALSE\) = FALSE/g)?.length).toBeGreaterThanOrEqual(5);
        expect(source('lib/admin/testimonial-candidates.ts').match(/COALESCE\(r.is_demo, FALSE\) = FALSE/g)?.length).toBeGreaterThanOrEqual(2);
        expect(source('lib/neon/queries/referral-credits.ts').match(/COALESCE\(is_demo, FALSE\) = FALSE/g)?.length).toBeGreaterThanOrEqual(2);
    });
});
