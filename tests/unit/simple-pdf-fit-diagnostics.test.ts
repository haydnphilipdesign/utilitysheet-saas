import { describe, expect, it } from 'vitest';
import { calculateSimplePdfFitDiagnostics } from '@/lib/pdf/simple-fit-diagnostics';

describe('calculateSimplePdfFitDiagnostics', () => {
    it('keeps normal simple sheets readable when height is modest', () => {
        const diagnostics = calculateSimplePdfFitDiagnostics({
            sourceWidth: 800,
            sourceHeight: 1000,
            targetWidth: 7.5,
            targetHeight: 10,
            baselineFontPx: 14,
        });

        expect(diagnostics.limitingDimension).toBe('width');
        expect(diagnostics.effectiveBaselineFontPt).toBeGreaterThanOrEqual(9);
        expect(diagnostics.isReadable).toBe(true);
    });

    it('flags very tall simple sheets when one-page scaling makes text too small', () => {
        const diagnostics = calculateSimplePdfFitDiagnostics({
            sourceWidth: 800,
            sourceHeight: 2400,
            targetWidth: 7.5,
            targetHeight: 10,
            baselineFontPx: 14,
        });

        expect(diagnostics.limitingDimension).toBe('height');
        expect(diagnostics.effectiveBaselineFontPt).toBeLessThan(7);
        expect(diagnostics.isReadable).toBe(false);
    });
});
