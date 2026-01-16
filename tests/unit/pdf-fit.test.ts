import { describe, expect, it } from 'vitest';
import { fitRectWithin } from '@/lib/pdf-fit';

describe('fitRectWithin', () => {
    it('fits a wide rect within a box', () => {
        const result = fitRectWithin({
            sourceWidth: 2000,
            sourceHeight: 1000,
            targetWidth: 7.5,
            targetHeight: 10,
        });

        expect(result.width).toBeCloseTo(7.5);
        expect(result.height).toBeCloseTo(3.75);
        expect(result.width).toBeLessThanOrEqual(7.5);
        expect(result.height).toBeLessThanOrEqual(10);
    });

    it('fits a tall rect within a box', () => {
        const result = fitRectWithin({
            sourceWidth: 1000,
            sourceHeight: 2000,
            targetWidth: 7.5,
            targetHeight: 10,
        });

        expect(result.height).toBeCloseTo(10);
        expect(result.width).toBeCloseTo(5);
        expect(result.width).toBeLessThanOrEqual(7.5);
        expect(result.height).toBeLessThanOrEqual(10);
    });

    it('returns zeros for invalid inputs', () => {
        const result = fitRectWithin({
            sourceWidth: 0,
            sourceHeight: 100,
            targetWidth: 7.5,
            targetHeight: 10,
        });
        expect(result).toEqual({ scale: 0, width: 0, height: 0 });
    });
});

