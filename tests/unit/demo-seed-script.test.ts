import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

import { buildDemoSeedConfig, chooseCanonicalDemoAccount } from '../../scripts/demo-seed.mjs';

describe('demo seed configuration', () => {
    it('uses isolated fake demo identity and Team access without Stripe identifiers', () => {
        const config = buildDemoSeedConfig({ appUrl: 'https://app.utilitysheet.com' });

        expect(config.account.email).toBe('demo.tc@utilitysheet.test');
        expect(config.account.fullName).toBe('Demo TC');
        expect(config.account.authUserId).toBeNull();
        expect(config.organization.name).toBe('UtilitySheet Demo');
        expect(config.organization.subscriptionStatus).toBe('team');
        expect(config.account.stripeCustomerId).toBeNull();
        expect(config.organization.stripeCustomerId).toBeNull();
        expect(config.intakeLink.slug).toBe('utilitysheet-demo');
        expect(config.intakeLink.url).toBe('https://app.utilitysheet.com/i/utilitysheet-demo');
    });

    it('seeds a completed fake request with realistic providers and no real customer data', () => {
        const config = buildDemoSeedConfig({});

        expect(config.sampleRequest.propertyAddress).toBe('123 Main Street, Anytown, PA 18301');
        expect(config.sampleRequest.sellerName).toBe('Jane Seller');
        expect(config.sampleUtilities).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ category: 'electric', displayName: 'Keystone Electric Co.' }),
                expect.objectContaining({ category: 'gas', displayName: 'Valley Natural Gas' }),
                expect.objectContaining({ category: 'water', displayName: 'Anytown Water Authority' }),
                expect.objectContaining({ category: 'sewer', displayName: 'Anytown Sewer Authority' }),
                expect.objectContaining({ category: 'trash', displayName: 'GreenCart Waste Services' }),
                expect.objectContaining({ category: 'internet', displayName: 'Blue Ridge Fiber' }),
                expect.objectContaining({ category: 'cable', displayName: 'Blue Ridge Fiber' }),
            ])
        );
    });

    it('exposes an npm reset command for repeatable recordings', async () => {
        const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
        expect(packageJson.scripts['demo:reset']).toBe('node scripts/demo-seed.mjs');
        expect(packageJson.scripts['seed:demo']).toBe('npm run demo:reset');
    });

    it('keeps the real authenticated account when production has a seeded duplicate', () => {
        const canonical = chooseCanonicalDemoAccount([
            {
                id: 'seeded-team-row',
                auth_user_id: null,
                created_at: '2026-05-13T16:05:00.084Z',
            },
            {
                id: 'stack-signup-row',
                auth_user_id: 'real-stack-user-id',
                created_at: '2026-05-13T17:18:41.292Z',
            },
        ]);

        expect(canonical?.id).toBe('stack-signup-row');
    });
});
