import { describe, expect, it } from 'vitest';
import {
    formatCanonicalIntakeAddress,
    validateIntakeAddress,
} from '@/lib/address/intake-validation';

describe('intake-validation', () => {
    it('returns missing ZIP when omitted', () => {
        const result = validateIntakeAddress('123 Main St, Austin, TX');
        expect(result.isComplete).toBe(false);
        expect(result.missingFields).toContain('zip');
    });

    it('passes a complete US address', () => {
        const result = validateIntakeAddress('123 Main St, Austin, TX 78701');
        expect(result.isComplete).toBe(true);
        expect(result.missingFields).toEqual([]);
        expect(result.parsed).toEqual({
            street: '123 Main St',
            city: 'Austin',
            state: 'TX',
            zip: '78701',
        });
    });

    it('formats canonical address without unit', () => {
        const formatted = formatCanonicalIntakeAddress({
            street: '123 Main St',
            city: 'Austin',
            state: 'texas',
            zip: '78701-1234',
        });
        expect(formatted).toBe('123 Main St, Austin, TX 78701');
    });

    it('formats canonical address with unit', () => {
        const formatted = formatCanonicalIntakeAddress({
            street: '123 Main St',
            unit: 'Apt 4B',
            city: 'Austin',
            state: 'tx',
            zip: '78701',
        });
        expect(formatted).toBe('123 Main St Apt 4B, Austin, TX 78701');
    });
});
