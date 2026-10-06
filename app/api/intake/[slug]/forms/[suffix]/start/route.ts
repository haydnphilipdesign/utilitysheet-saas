import { intakeStartResponse } from '@/lib/seller-forms/intake';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ slug: string; suffix: string }> }
) {
    const { slug, suffix } = await params;
    return intakeStartResponse(request, { slug, suffix });
}
