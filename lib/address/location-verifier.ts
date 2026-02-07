import {
    ParsedLocation,
    parseAddressWithConfidence,
    resolveStateAbbreviation,
} from '@/lib/address/location-parser';

export interface VerifiedLocation {
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    confidence?: 'high' | 'medium' | 'low';
}

export function isLocationVerifierConfigured(): boolean {
    return Boolean(process.env.LOCATION_VERIFIER_ENDPOINT);
}

function sanitizeVerifiedString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function sanitizeVerifiedPayload(payload: unknown): VerifiedLocation | null {
    if (!payload || typeof payload !== 'object') return null;

    const row = payload as Record<string, unknown>;
    const city = sanitizeVerifiedString(row.city);
    const stateRaw = sanitizeVerifiedString(row.state);
    const state = stateRaw ? resolveStateAbbreviation(stateRaw) : null;
    const zipRaw = sanitizeVerifiedString(row.zip);
    const zip = zipRaw ? (zipRaw.match(/\b(\d{5})/)?.[1] || null) : null;
    const confidenceRaw = sanitizeVerifiedString(row.confidence);
    const confidence = confidenceRaw && ['high', 'medium', 'low'].includes(confidenceRaw.toLowerCase())
        ? confidenceRaw.toLowerCase() as 'high' | 'medium' | 'low'
        : undefined;

    if (!city && !state && !zip) {
        return null;
    }

    return {
        city,
        state,
        zip,
        confidence,
    };
}

export async function verifyLocation(parsed: ParsedLocation): Promise<VerifiedLocation | null> {
    const endpoint = process.env.LOCATION_VERIFIER_ENDPOINT;
    if (!endpoint) {
        return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (process.env.LOCATION_VERIFIER_API_KEY) {
            headers.Authorization = `Bearer ${process.env.LOCATION_VERIFIER_API_KEY}`;
        }

        const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                address: parsed.raw,
                parsed: {
                    city: parsed.city,
                    state: parsed.state,
                    zip: parsed.zip,
                    confidence: parsed.confidence,
                },
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            return null;
        }

        const data = await res.json().catch(() => null);
        return sanitizeVerifiedPayload(data);
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

export async function resolveParsedLocation(address: string): Promise<ParsedLocation> {
    const parsed = parseAddressWithConfidence(address);

    if (parsed.confidence === 'high' || !isLocationVerifierConfigured()) {
        return parsed;
    }

    const verified = await verifyLocation(parsed);
    if (!verified) {
        return parsed;
    }

    const merged: ParsedLocation = {
        ...parsed,
        city: verified.city ?? parsed.city,
        state: verified.state ?? parsed.state,
        zip: verified.zip ?? parsed.zip,
        confidence: verified.confidence || (verified.state && (verified.city || verified.zip) ? 'high' : parsed.confidence),
        source: 'verified',
        issues: parsed.issues.filter((issue) => {
            if (issue.startsWith('city_') && (verified.city || parsed.city)) return false;
            if (issue.startsWith('state_') && (verified.state || parsed.state)) return false;
            if (issue.startsWith('zip_') && (verified.zip || parsed.zip)) return false;
            return true;
        }),
    };

    return merged;
}
