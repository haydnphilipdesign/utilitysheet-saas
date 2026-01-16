export type FitRectResult = {
    scale: number;
    width: number;
    height: number;
};

export function fitRectWithin(params: {
    sourceWidth: number;
    sourceHeight: number;
    targetWidth: number;
    targetHeight: number;
}): FitRectResult {
    const { sourceWidth, sourceHeight, targetWidth, targetHeight } = params;

    if (
        !Number.isFinite(sourceWidth) ||
        !Number.isFinite(sourceHeight) ||
        !Number.isFinite(targetWidth) ||
        !Number.isFinite(targetHeight) ||
        sourceWidth <= 0 ||
        sourceHeight <= 0 ||
        targetWidth <= 0 ||
        targetHeight <= 0
    ) {
        return { scale: 0, width: 0, height: 0 };
    }

    const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
    return {
        scale,
        width: sourceWidth * scale,
        height: sourceHeight * scale,
    };
}

