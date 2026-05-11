import {
    formatCanonicalIntakeAddress,
    getMissingIntakeFields,
    normalizeIntakeAddressParts,
    type IntakeAddressParts,
} from '@/lib/address/intake-validation';

export interface GooglePlaceAddressComponent {
    long_name: string;
    short_name: string;
    types: string[];
}

export interface GooglePlaceNewAddressComponent {
    longText?: string;
    shortText?: string;
    types: string[];
}

export interface GooglePlaceAddressInput {
    address_components?: GooglePlaceAddressComponent[];
    addressComponents?: GooglePlaceNewAddressComponent[];
    formatted_address?: string;
    formattedAddress?: string;
    place_id?: string;
    id?: string;
}

export interface ParsedGooglePlaceAddress extends IntakeAddressParts {
    unit: string;
    full: string;
    placeId: string | null;
    isComplete: boolean;
}

function getComponent(
    components: Array<GooglePlaceAddressComponent | GooglePlaceNewAddressComponent>,
    type: string,
    name: 'long_name' | 'short_name' = 'long_name'
): string {
    const component = components.find((item) => item.types.includes(type));
    if (!component) return '';
    if ('long_name' in component) return component[name] || '';
    return name === 'short_name'
        ? component.shortText || component.longText || ''
        : component.longText || component.shortText || '';
}

export function parseGooglePlaceAddress(place: GooglePlaceAddressInput): ParsedGooglePlaceAddress {
    const components = place.address_components || place.addressComponents || [];
    const streetNumber = getComponent(components, 'street_number');
    const route = getComponent(components, 'route');
    const unit = getComponent(components, 'subpremise');
    const city =
        getComponent(components, 'locality') ||
        getComponent(components, 'postal_town') ||
        getComponent(components, 'sublocality') ||
        getComponent(components, 'administrative_area_level_3');
    const state = getComponent(components, 'administrative_area_level_1', 'short_name');
    const zip = getComponent(components, 'postal_code');
    const street = [streetNumber, route].filter(Boolean).join(' ');
    const normalized = normalizeIntakeAddressParts({ street, city, state, zip });
    const normalizedUnit = unit.trim().replace(/\s+/g, ' ');
    const isComplete = getMissingIntakeFields(normalized).length === 0;
    const full = isComplete
        ? formatCanonicalIntakeAddress({ ...normalized, unit: normalizedUnit })
        : (place.formatted_address || place.formattedAddress || '').trim();

    return {
        ...normalized,
        unit: normalizedUnit,
        full,
        placeId: place.place_id || place.id || null,
        isComplete,
    };
}
