import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sellerFormCreationCapability } from '@/lib/seller-forms/config';
import { sellerFormCapabilities } from '@/lib/seller-forms/capabilities';

beforeEach(() => {
    vi.stubEnv('SAVED_SELLER_FORMS_ENABLED', 'true');
    vi.stubEnv('SAVED_SELLER_FORMS_ROLLOUT', 'all');
    vi.stubEnv('SAVED_SELLER_FORMS_PILOT_ACCOUNT_IDS', '');
    vi.stubEnv('SAVED_SELLER_FORMS_TECHNICAL_CAP', '50');
});
afterEach(() => vi.unstubAllEnvs());

describe('all-users saved form rollout', () => {
    it('enables paid accounts without an allowlist while preserving commercial and technical limits', () => {
        expect(sellerFormCapabilities('any-account', true, 1, 1).canCreate).toBe(true);
        expect(sellerFormCapabilities('any-account', false, 1, 1).reason).toBe('commercial');
        expect(sellerFormCapabilities('any-account', true, 10, 10).reason).toBe('commercial');
        expect(sellerFormCapabilities('any-account', true, 1, 50).reason).toBe('technical');
    });
    it('keeps the master switch authoritative', () => {
        vi.stubEnv('SAVED_SELLER_FORMS_ENABLED', 'false');
        expect(sellerFormCreationCapability('any-account').canCreate).toBe(false);
    });
    it.each(['', '0', '-1', '1.5', 'Infinity', '2147483648'])('rejects invalid technical cap %s', (cap) => {
        vi.stubEnv('SAVED_SELLER_FORMS_TECHNICAL_CAP', cap);
        expect(sellerFormCreationCapability('any-account').canCreate).toBe(false);
    });
    it.each(['', 'ALL', 'true', 'typo'])('does not interpret %s as global enablement; preserves explicit pilots', (mode) => {
        vi.stubEnv('SAVED_SELLER_FORMS_ROLLOUT', mode);
        vi.stubEnv('SAVED_SELLER_FORMS_PILOT_ACCOUNT_IDS', ' pilot-account ');
        expect(sellerFormCreationCapability('any-account').canCreate).toBe(false);
        expect(sellerFormCreationCapability('pilot-account').canCreate).toBe(true);
    });
});
