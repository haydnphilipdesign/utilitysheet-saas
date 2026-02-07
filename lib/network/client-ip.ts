export function getClientIp(request: Request, fallback: string = 'anonymous'): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        const first = forwarded.split(',')[0]?.trim();
        if (first) return first;
    }

    const realIp = request.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;

    return fallback;
}

export function getClientIpOrNull(request: Request): string | null {
    const ip = getClientIp(request, '');
    return ip || null;
}
