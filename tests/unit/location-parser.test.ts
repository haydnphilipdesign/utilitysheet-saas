import { describe, expect, it } from 'vitest';
import { buildLocationContext, parseAddressWithConfidence } from '@/lib/address/location-parser';

describe('location-parser', () => {
    it('sets high confidence when state and zip are present in comma-less input', () => {
        const parsed = parseAddressWithConfidence('123 Main St Austin TX 78701');
        expect(parsed.street).toBe('123 Main St');
        expect(parsed.city).toBe('Austin');
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

    it('parses no-comma addresses without duplicating city state and zip into the street', () => {
        const parsed = parseAddressWithConfidence('135 acorn ln kunkletown pa 18058');
        expect(parsed.street).toBe('135 acorn ln');
        expect(parsed.city).toBe('Kunkletown');
        expect(parsed.state).toBe('PA');
        expect(parsed.zip).toBe('18058');
    });

    it('does not mistake street directions for the state code', () => {
        const parsed = parseAddressWithConfidence('627 NE 2nd Ave Cape Coral Fl 33909');
        expect(parsed.street).toBe('627 NE 2nd Ave');
        expect(parsed.city).toBe('Cape Coral');
        expect(parsed.state).toBe('FL');
        expect(parsed.zip).toBe('33909');
    });

    it('prefers the trailing ZIP over a 5-digit street number', () => {
        const parsed = parseAddressWithConfidence('19475 Cavendish Court, North Royalton, OH 44133');
        expect(parsed.street).toBe('19475 Cavendish Court');
        expect(parsed.city).toBe('North Royalton');
        expect(parsed.state).toBe('OH');
        expect(parsed.zip).toBe('44133');
    });

    it('handles extra commas around the state and zip', () => {
        const parsed = parseAddressWithConfidence('17413 Glenshire ave, cleveland, oh, 44135');
        expect(parsed.street).toBe('17413 Glenshire ave');
        expect(parsed.city).toBe('Cleveland');
        expect(parsed.state).toBe('OH');
        expect(parsed.zip).toBe('44135');
    });

    it('can recover a clean street from previously duplicated addresses', () => {
        const parsed = parseAddressWithConfidence('135 acorn ln kunkletown pa 18058, Kunkletown, PA 18058');
        expect(parsed.street).toBe('135 acorn ln');
        expect(parsed.city).toBe('Kunkletown');
        expect(parsed.state).toBe('PA');
        expect(parsed.zip).toBe('18058');
    });
});
