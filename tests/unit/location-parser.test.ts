import { describe, expect, it } from 'vitest';
import { buildLocationContext, parseAddressWithConfidence } from '@/lib/address/location-parser';

describe('location-parser', () => {
    it('sets high confidence when state and zip are present in comma-less input', () => {
        const parsed = parseAddressWithConfidence('123 Main St Austin TX 78701');
        expect(parsed.state).toBe('TX');
        expect(parsed.zip).toBe('78701');
        expect(parsed.confidence).toBe('high');
    });

    it('resolves near-miss state typos', () => {
        const parsed = parseAddressWithConfidence('400 Pine St, Seattle, Washngton 98101');
        expect(parsed.state).toBe('WA');
    });

    it('handles washington dc correctly', () => {
        const parsed = parseAddressWithConfidence('500 First St NW Washington DC 20001');
        expect(parsed.state).toBe('DC');
        expect(parsed.zip).toBe('20001');
    });

    it('returns low confidence for non-address text', () => {
        const parsed = parseAddressWithConfidence('near the big tree by the lake');
        expect(parsed.confidence).toBe('low');
        expect(parsed.state).toBeNull();
    });

    it('builds location context with confidence and issues', () => {
        const parsed = parseAddressWithConfidence('unknown place');
        const context = buildLocationContext(parsed);
        expect(context.lines.some((line) => line.startsWith('Location Confidence:'))).toBe(true);
        expect(context.lines.some((line) => line.startsWith('Location Issues:'))).toBe(true);
    });
});
