import type { PropertyAddressStructured } from '@/types';
import { sql } from '@/lib/neon/db';
import { resolveParsedLocation } from '@/lib/address/location-verifier';
import { toStructuredPropertyAddress } from '@/lib/address/location-parser';

export async function buildStructuredPropertyAddress(address: string): Promise<PropertyAddressStructured> {
    const parsed = await resolveParsedLocation(address);
    return toStructuredPropertyAddress(parsed);
}

export async function lazyBackfillRequestStructuredAddress(requestData: {
    id: string;
    property_address: string;
    property_address_structured?: unknown | null;
}): Promise<void> {
    if (!sql) return;
    if (requestData.property_address_structured) return;

    try {
        const structured = await buildStructuredPropertyAddress(requestData.property_address);
        await sql`
            UPDATE requests
            SET property_address_structured = ${JSON.stringify(structured)}::jsonb
            WHERE id = ${requestData.id}
            AND property_address_structured IS NULL
        `;
    } catch (error) {
        console.error('Structured address lazy-backfill failed:', error);
    }
}
