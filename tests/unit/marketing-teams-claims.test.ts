import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { pricingTiers } from '@/lib/marketing-content';

// Teams shares requests and Branding Profiles. Seller forms and their packet
// settings belong to each member, so nothing may promise workspace-wide defaults.
describe('what the pricing pages promise for Teams', () => {
    const teams = pricingTiers.find((tier) => tier.name === 'Teams')!;

    it('does not promise defaults that are shared across a workspace', () => {
        const sources = [
            [teams.description, ...teams.features].join('\n'),
            readFileSync(join(process.cwd(), 'components/landing/PricingSection.tsx'), 'utf8'),
            readFileSync(join(process.cwd(), 'app/(marketing)/pricing/page.tsx'), 'utf8'),
        ];
        for (const source of sources) {
            expect(source).not.toMatch(/org-wide|shared defaults|packet defaults/i);
        }
    });

    it('carries the paid plan choice into sign-up', () => {
        expect(teams.href).toBe('/auth/signup?plan=teams');
        expect(pricingTiers.find((tier) => tier.name === 'Pro')!.href).toBe('/auth/signup?plan=pro');
    });
});
