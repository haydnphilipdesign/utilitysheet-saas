export const AI_REQUEST_FORMAT_VERSION = 'structured-json-v2';

const nullableString = {
    anyOf: [
        { type: 'string' },
        { type: 'null' },
    ],
} as const;

export const PROVIDER_SUGGESTION_RESPONSE_SCHEMA = {
    type: 'array',
    maxItems: 12,
    items: {
        type: 'object',
        additionalProperties: false,
        properties: {
            display_name: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            rationale_short: nullableString,
            contact_phone: nullableString,
            contact_website: nullableString,
        },
        required: [
            'display_name',
            'confidence',
            'rationale_short',
            'contact_phone',
            'contact_website',
        ],
    },
} as const;

export const PROVIDER_CONTACT_RESPONSE_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        customer_service_phone: nullableString,
        start_stop_service_url: nullableString,
        main_website: nullableString,
        hours: nullableString,
    },
    required: [
        'customer_service_phone',
        'start_stop_service_url',
        'main_website',
        'hours',
    ],
} as const;
