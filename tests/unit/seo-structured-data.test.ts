import { describe, expect, it } from 'vitest';

import { pricingTiers } from '@/lib/marketing-content';
import { planOfferTerms, softwareApplicationSchema } from '@/lib/seo/schema';

describe('SoftwareApplication structured data', () => {
    it('keeps plan terms in step with the displayed prices', () => {
        expect(pricingTiers.find((tier) => tier.name === 'Free')?.price).toBe('Free');
        expect(pricingTiers.find((tier) => tier.name === 'Pro')?.price).toBe(`$${planOfferTerms.Pro.price}/month`);
        expect(pricingTiers.find((tier) => tier.name === 'Teams')?.price).toBe(`$${planOfferTerms.Teams.price}/seat/month`);
    });

    it('describes per-seat Teams pricing with its seat minimum', () => {
        const teams = softwareApplicationSchema().offers.find((offer) => offer.name === 'Teams');
        expect(teams).toMatchObject({
            price: 7,
            priceCurrency: 'USD',
            priceSpecification: { unitText: 'per seat per month', billingDuration: 'P1M' },
            eligibleQuantity: { minValue: 3 },
        });
    });

    it('uses one stable @id and never invents ratings or reviews', () => {
        const schema = softwareApplicationSchema();
        expect(schema['@id']).toMatch(/\/#software$/);
        expect(schema).not.toHaveProperty('aggregateRating');
        expect(schema).not.toHaveProperty('review');
    });
});
