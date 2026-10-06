import { intakeMetadataResponse } from '@/lib/seller-forms/intake';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    return intakeMetadataResponse({ slug: (await params).slug });
}
