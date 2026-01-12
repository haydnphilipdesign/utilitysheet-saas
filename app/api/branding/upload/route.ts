import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { stackServerApp } from '@/lib/stack/server';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

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

        // Generate unique filename with user folder
        const fileExt = file.name.split('.').pop() || 'png';
        const timestamp = Date.now();
        const fileName = `brand-logos/${user.id}/${timestamp}.${fileExt}`;

        // Upload to Vercel Blob
        const blob = await put(fileName, file, {
            access: 'public',
            addRandomSuffix: false,
        });

        return NextResponse.json({
            url: blob.url,
            pathname: blob.pathname,
        });

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

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
