import { describe, expect, it } from 'vitest';
import { formatAdminDate } from '@/lib/admin/date-format';

describe('formatAdminDate', () => {
    it('formats dates in the admin timezone instead of the server timezone', () => {
        expect(formatAdminDate('2026-05-08T02:30:00.000Z')).toBe('5/7/2026');
    });

    it('keeps same-day timestamps on the same calendar date', () => {
        expect(formatAdminDate('2026-05-08T16:30:00.000Z')).toBe('5/8/2026');
    });

    it('handles missing or invalid values without throwing', () => {
        expect(formatAdminDate(null)).toBe('-');
        expect(formatAdminDate('not a date')).toBe('-');
    });
});
