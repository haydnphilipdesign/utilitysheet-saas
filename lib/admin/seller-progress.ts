export type SellerProgressStage = {
    label: string;
    description: string;
};

function formatCategory(value: string) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export function describeSellerProgressEvent(
    eventType: string | null,
    eventData: Record<string, unknown> | null
): SellerProgressStage {
    if (!eventType) {
        return {
            label: 'No tracked seller activity',
            description: 'The request is in progress, but no seller event has been recorded.',
        };
    }

    if (eventType === 'seller_opened') {
        return {
            label: 'Opened seller form',
            description: 'The seller loaded the form; no later tracked step is available.',
        };
    }

    if (eventType === 'suggestions_fetched') {
        const categories = Array.isArray(eventData?.categories)
            ? (eventData.categories as unknown[]).filter((value): value is string => typeof value === 'string')
            : [];
        return {
            label: categories.length > 0
                ? `Reached ${categories.map(formatCategory).join(', ')}`
                : 'Reached utility details',
            description: 'Provider suggestions were loaded for a utility step.',
        };
    }

    if (eventType === 'suggestions_search') {
        const category = typeof eventData?.category === 'string' ? formatCategory(eventData.category) : null;
        return {
            label: category ? `Searched for a ${category} provider` : 'Searched for a provider',
            description: 'The seller used provider search within the form.',
        };
    }

    if (eventType === 'request_created') {
        return {
            label: 'Request created',
            description: 'The request exists, but no seller form activity is recorded yet.',
        };
    }

    if (eventType === 'reminder_sent') {
        return {
            label: 'Reminder sent',
            description: 'A reminder was recorded; no later seller activity is available.',
        };
    }

    return {
        label: 'Other tracked activity',
        description: 'A technical event was recorded. Expand the event detail to inspect it.',
    };
}
