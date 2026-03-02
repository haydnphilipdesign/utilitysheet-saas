import { NextResponse } from 'next/server';

export function getRequestContentLength(request: Request): number | null {
    const raw = request.headers.get('content-length');
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
}

export function enforceMaxRequestBodyBytes(request: Request, maxBytes: number): NextResponse | null {
    const contentLength = getRequestContentLength(request);
    if (contentLength !== null && contentLength > maxBytes) {
        return NextResponse.json(
            {
                error: 'Payload too large',
                code: 'PAYLOAD_TOO_LARGE',
            },
            { status: 413 }
        );
    }
    return null;
}

export function invalidRequestBodyResponse(
    code: string = 'INVALID_REQUEST_BODY',
    message: string = 'Invalid request body'
): NextResponse {
    return NextResponse.json({ error: message, code }, { status: 400 });
}
