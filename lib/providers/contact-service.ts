import { ProviderContact } from '@/types';
import { MOCK_PROVIDERS } from './mock-data';

// Contact cache
const contactCache = new Map<string, { contact: ProviderContact | null; timestamp: number }>();
const CACHE_TTL = 90 * 24 * 60 * 60 * 1000; // 90 days in ms

/**
 * Resolve contact information for a provider
 * Returns phone number and service URLs when available
 */
export async function resolveContact(
    providerNameOrId: string
): Promise<ProviderContact | null> {
    // Check cache
    const cached = contactCache.get(providerNameOrId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.contact;
    }

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

    // Try to find by ID first, then by name
    const provider = MOCK_PROVIDERS.find(
        (p) =>
            p.id === providerNameOrId ||
            p.normalized_name.toLowerCase() === providerNameOrId.toLowerCase() ||
            p.aliases.some((a) => a.toLowerCase() === providerNameOrId.toLowerCase())
    );

    if (!provider) {
        contactCache.set(providerNameOrId, { contact: null, timestamp: Date.now() });
        return null;
    }

    const contact: ProviderContact = {
        customer_service_phone: provider.contact_phone || undefined,
        start_stop_service_url: provider.contact_urls[0] || undefined,
        main_website: provider.contact_urls[0]?.split('/').slice(0, 3).join('/') || undefined,
    };

    contactCache.set(providerNameOrId, { contact, timestamp: Date.now() });

    return contact;
}

/**
 * Resolve contacts for multiple providers at once
 */
export async function resolveContacts(
    providerNames: string[]
): Promise<Record<string, ProviderContact | null>> {
    const results = await Promise.all(
        providerNames.map(async (name) => ({
            name,
            contact: await resolveContact(name),
        }))
    );

    return results.reduce(
        (acc, { name, contact }) => {
            acc[name] = contact;
            return acc;
        },
        {} as Record<string, ProviderContact | null>
    );
}

/**
 * Check if contact resolution succeeded
 */
export function hasValidContact(contact: ProviderContact | null): boolean {
    if (!contact) return false;
    return !!(contact.customer_service_phone || contact.start_stop_service_url);
}
