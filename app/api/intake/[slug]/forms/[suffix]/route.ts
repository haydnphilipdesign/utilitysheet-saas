import { intakeMetadataResponse } from '@/lib/seller-forms/intake';

// Nested link metadata. The explicit `forms` segment keeps an ending named
// "start" from colliding with /api/intake/[slug]/start.
export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string; suffix: string }> }
) {
    const { slug, suffix } = await params;
    return intakeMetadataResponse({ slug, suffix });
}
