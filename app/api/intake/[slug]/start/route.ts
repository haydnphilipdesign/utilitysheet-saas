import { intakeStartResponse } from '@/lib/seller-forms/intake';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    return intakeStartResponse(request, { slug: (await params).slug });
}
