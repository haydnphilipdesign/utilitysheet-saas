export interface SimplePdfFitDiagnostics {
    scale: number;
    fittedWidth: number;
    fittedHeight: number;
    limitingDimension: 'width' | 'height';
    effectiveBaselineFontPt: number;
    isReadable: boolean;
}

const MIN_READABLE_BASELINE_FONT_PT = 7;

export function calculateSimplePdfFitDiagnostics(params: {
    sourceWidth: number;
    sourceHeight: number;
    targetWidth: number;
    targetHeight: number;
    baselineFontPx?: number;
    minimumReadableFontPt?: number;
}): SimplePdfFitDiagnostics {
    const {
        sourceWidth,
        sourceHeight,
        targetWidth,
        targetHeight,
        baselineFontPx = 14,
        minimumReadableFontPt = MIN_READABLE_BASELINE_FONT_PT,
    } = params;

    if (
        !Number.isFinite(sourceWidth) ||
        !Number.isFinite(sourceHeight) ||
        !Number.isFinite(targetWidth) ||
        !Number.isFinite(targetHeight) ||
        !Number.isFinite(baselineFontPx) ||
        sourceWidth <= 0 ||
        sourceHeight <= 0 ||
        targetWidth <= 0 ||
        targetHeight <= 0 ||
        baselineFontPx <= 0
    ) {
        return {
            scale: 0,
            fittedWidth: 0,
            fittedHeight: 0,
            limitingDimension: 'width',
            effectiveBaselineFontPt: 0,
            isReadable: false,
        };
    }

    const widthScale = targetWidth / sourceWidth;
    const heightScale = targetHeight / sourceHeight;
    const scale = Math.min(widthScale, heightScale);
    const effectiveBaselineFontPt = baselineFontPx * scale * 72;

    return {
        scale,
        fittedWidth: sourceWidth * scale,
        fittedHeight: sourceHeight * scale,
        limitingDimension: heightScale < widthScale ? 'height' : 'width',
        effectiveBaselineFontPt,
        isReadable: effectiveBaselineFontPt >= minimumReadableFontPt,
    };
}
