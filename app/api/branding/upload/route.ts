import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { stackServerApp } from '@/lib/stack/server';
import { brandingUploadRatelimit, checkRateLimit, getRateLimitHeaders, isRateLimitUnavailable } from '@/lib/rate-limit';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const FILE_EXTENSION_BY_TYPE: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
};

function startsWithSignature(data: Uint8Array, signature: number[]): boolean {
    if (data.length < signature.length) return false;
    return signature.every((value, idx) => data[idx] === value);
}

function detectMimeType(fileData: Uint8Array): string | null {
    if (startsWithSignature(fileData, [0xff, 0xd8, 0xff])) return 'image/jpeg';
    if (startsWithSignature(fileData, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';

    if (
        fileData.length > 12 &&
        String.fromCharCode(...fileData.slice(0, 4)) === 'RIFF' &&
        String.fromCharCode(...fileData.slice(8, 12)) === 'WEBP'
    ) {
        return 'image/webp';
    }

    const prefix = new TextDecoder().decode(fileData.slice(0, 512)).trimStart();
    if (prefix.startsWith('<svg') || prefix.startsWith('<?xml')) return 'image/svg+xml';
    return null;
}

function isSvgSafe(svg: string): boolean {
    const lower = svg.toLowerCase();
    const forbiddenPatterns = [
        /<script[\s>]/,
        /on\w+\s*=/,
        /javascript:/,
        /<foreignobject[\s>]/,
        /<iframe[\s>]/,
    ];
    return !forbiddenPatterns.some((pattern) => pattern.test(lower));
}

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const rateLimitResult = await checkRateLimit(brandingUploadRatelimit, user.id, { requirePersistent: process.env.NODE_ENV === 'production' });
        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json({ error: 'Temporarily unavailable. Please try again shortly.' }, { status: 503 });
        }

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please slow down.' },
                { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
            );
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, SVG' },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File too large. Maximum size is 2MB' },
                { status: 400 }
            );
        }

        const fileData = new Uint8Array(await file.arrayBuffer());
        const sniffedType = detectMimeType(fileData);
        if (!sniffedType || !ALLOWED_TYPES.includes(sniffedType) || sniffedType !== file.type) {
            return NextResponse.json(
                { error: 'File signature does not match the declared type.' },
                { status: 400 }
            );
        }

        // Generate unique filename with user folder
        const fileExt = FILE_EXTENSION_BY_TYPE[sniffedType] || 'bin';
        const timestamp = Date.now();
        const fileName = `brand-logos/${user.id}/${timestamp}.${fileExt}`;
        let uploadBody: Blob | Buffer = Buffer.from(fileData);

        if (sniffedType === 'image/svg+xml') {
            const svgText = new TextDecoder().decode(fileData);
            if (!isSvgSafe(svgText)) {
                return NextResponse.json(
                    { error: 'SVG contains disallowed content.' },
                    { status: 400 }
                );
            }
            uploadBody = new Blob([svgText], { type: 'image/svg+xml' });
        }

        // Upload to Vercel Blob
        const blob = await put(fileName, uploadBody, {
            access: 'public',
            addRandomSuffix: false,
            contentType: sniffedType,
        });

        return NextResponse.json({
            url: blob.url,
            pathname: blob.pathname,
        }, { headers: getRateLimitHeaders(rateLimitResult) });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE endpoint to remove a logo
export async function DELETE(request: NextRequest) {
    try {
        const user = await stackServerApp.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimitResult = await checkRateLimit(brandingUploadRatelimit, `${user.id}:delete`, { requirePersistent: process.env.NODE_ENV === 'production' });
        if (isRateLimitUnavailable(rateLimitResult)) {
            return NextResponse.json({ error: 'Temporarily unavailable. Please try again shortly.' }, { status: 503 });
        }

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please slow down.' },
                { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
            );
        }

        const { searchParams } = new URL(request.url);
        const url = searchParams.get('url');

        if (!url) {
            return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
        }

        // Security: Only allow deleting files in user's own folder
        if (!url.includes(`/brand-logos/${user.id}/`)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        await del(url);

        return NextResponse.json({ success: true }, { headers: getRateLimitHeaders(rateLimitResult) });

    } catch (error) {
        console.error('Delete error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

