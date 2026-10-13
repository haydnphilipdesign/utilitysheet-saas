export type SellerProgressStage = {
    label: string;
    description: string;
};

const REQUEST_TIMELINE_EVENT_LABELS = {
    request_reopened: 'Reopened for seller',
    request_reopen_cancelled: 'Reopen closed without changes',
} as const;

/** Readable name for a request timeline event, or null when the raw type is all there is. */
export function requestTimelineEventLabel(eventType: string): string | null {
    return Object.prototype.hasOwnProperty.call(REQUEST_TIMELINE_EVENT_LABELS, eventType)
        ? REQUEST_TIMELINE_EVENT_LABELS[eventType as keyof typeof REQUEST_TIMELINE_EVENT_LABELS]
        : null;
}

function formatCategory(value: string) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

const SELLER_STEP_LABELS: Record<string, string> = {
    welcome: 'Welcome',
    home_basics: 'Home Basics',
    utility: 'a provider step',
    advanced: 'Additional Home Details',
    review: 'Review',
    success: 'the confirmation screen',
};

const SELLER_FAILURE_LABELS: Record<string, string> = {
    validation: 'answers were not accepted',
    already_submitted: 'already submitted',
    stale_session: 'form was reopened after the page loaded',
    conflict: 'conflicting request state',
    rate_limited: 'too many attempts',
    unavailable: 'service unavailable',
    not_found: 'link not found',
    forbidden: 'link not allowed to submit',
    server_error: 'server error',
    offline: 'seller was offline',
    network: 'connection interrupted',
    unknown: 'unclassified',
};

/** Readable name for a browser-reported step, or null for a value outside the contract. */
export function describeSellerStep(step: string | null, category: string | null): string | null {
    if (!step || !Object.prototype.hasOwnProperty.call(SELLER_STEP_LABELS, step)) return null;
    if (step === 'utility' && category) return `${formatCategory(category)} provider`;
    return SELLER_STEP_LABELS[step];
}

/** Readable reason for a browser-reported submission failure code, or null for a value outside the contract. */
export function describeSellerFailure(code: string | null): string | null {
    return code && Object.prototype.hasOwnProperty.call(SELLER_FAILURE_LABELS, code) ? SELLER_FAILURE_LABELS[code] : null;
}

export function describeSellerProgressEvent(
    eventType: string | null,
    eventData: Record<string, unknown> | null
): SellerProgressStage {
    if (!eventType || eventType === 'unknown') {
        return {
            label: 'No tracked seller activity',
            description: 'The request is in progress, but no seller event has been recorded.',
        };
    }

    if (eventType === 'seller_opened') {
        return {
            label: 'Seller form requested',
            description: 'The seller endpoint was requested; no browser view or later step is confirmed.',
        };
    }

    if (eventType === 'suggestions_fetched') {
        const categories = Array.isArray(eventData?.categories)
            ? (eventData.categories as unknown[]).filter((value): value is string => typeof value === 'string')
            : [];
        return {
            label: categories.length > 0
                ? `Suggestions served for ${categories.map(formatCategory).join(', ')}`
                : 'Suggestions served',
            description: 'A suggestion result was generated/served; browser rendering and step completion are unconfirmed.',
        };
    }

    if (eventType === 'suggestions_search') {
        const category = typeof eventData?.category === 'string' ? formatCategory(eventData.category) : null;
        return {
            label: category ? `Searched for a ${category} provider` : 'Searched for a provider',
            description: 'The provider search endpoint recorded a query; browser rendering is unconfirmed.',
        };
    }

    if (eventType === 'seller_self_send_link') {
        return { label: 'Return link requested', description: 'The self-link endpoint accepted a send; receipt and form viewing are unconfirmed.' };
    }

    if (eventType === 'seller_step_viewed' || eventType === 'seller_step_completed') {
        const step = describeSellerStep(
            typeof eventData?.step === 'string' ? eventData.step : null,
            typeof eventData?.category === 'string' ? eventData.category : null
        );
        return eventType === 'seller_step_viewed'
            ? { label: step ? `Viewed ${step}` : 'Viewed a form step', description: 'The seller browser reported showing this step. Advisory: it can be missing, blocked or repeated.' }
            : { label: step ? `Continued past ${step}` : 'Continued past a form step', description: 'The seller browser reported moving on from this step. Nothing is stored until the form is submitted.' };
    }

    if (eventType === 'seller_submission_attempted') {
        return { label: 'Submission attempted', description: 'The seller browser reported pressing submit. An accepted submission is recorded separately by the server.' };
    }

    if (eventType === 'seller_submission_failed') {
        const reason = describeSellerFailure(typeof eventData?.error_code === 'string' ? eventData.error_code : null);
        return { label: reason ? `Submission failed: ${reason}` : 'Submission failed', description: 'The seller browser reported that a submit attempt did not succeed. The seller may have retried since.' };
    }

    if (eventType === 'seller_suggestions_rendered') {
        return { label: 'Provider list shown', description: 'The seller browser reported showing a provider list or its empty state.' };
    }

    if (eventType === 'seller_suggestions_failed') {
        return { label: 'Provider list failed to load', description: 'The seller browser reported that provider suggestions or a search did not load.' };
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

    if (eventType === 'request_reopened') {
        return {
            label: REQUEST_TIMELINE_EVENT_LABELS.request_reopened,
            description: 'A coordinator reopened this submitted request so the seller can correct it. No seller activity is recorded since.',
        };
    }

    if (eventType === 'request_reopen_cancelled') {
        return {
            label: REQUEST_TIMELINE_EVENT_LABELS.request_reopen_cancelled,
            description: 'A coordinator closed the reopened request, restoring the submitted sheet as it was.',
        };
    }

    return {
        label: 'Other tracked activity',
        description: 'A technical event was recorded. Expand the event detail to inspect it.',
    };
}
