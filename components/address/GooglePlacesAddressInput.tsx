'use client';

import type { KeyboardEventHandler } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { parseGooglePlaceAddress, type ParsedGooglePlaceAddress } from '@/lib/address/google-place';

type PlacesAutocompleteResponse = {
    suggestions?: Array<{
        placePrediction?: {
            placeId: string;
            text?: { text?: string };
            structuredFormat?: {
                mainText?: { text?: string };
                secondaryText?: { text?: string };
            };
        };
    }>;
};

type PlacesDetailsResponse = {
    id?: string;
    formattedAddress?: string;
    addressComponents?: Array<{
        longText?: string;
        shortText?: string;
        types: string[];
    }>;
};

type AddressSuggestion = {
    id: string;
    label: string;
    mainText: string;
    secondaryText: string;
};

interface GooglePlacesAddressInputProps {
    id: string;
    value: string;
    onChange: (value: string) => void;
    onAddressSelected: (address: ParsedGooglePlaceAddress) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    'data-testid'?: string;
    onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}

function createSessionToken() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toSuggestion(item: NonNullable<PlacesAutocompleteResponse['suggestions']>[number]): AddressSuggestion | null {
    const prediction = item.placePrediction;
    if (!prediction?.placeId) return null;
    const label = prediction.text?.text || prediction.structuredFormat?.mainText?.text || '';
    if (!label) return null;
    return {
        id: prediction.placeId,
        label,
        mainText: prediction.structuredFormat?.mainText?.text || label,
        secondaryText: prediction.structuredFormat?.secondaryText?.text || '',
    };
}

async function fetchAddressSuggestions(input: string, apiKey: string, sessionToken: string): Promise<AddressSuggestion[]> {
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': [
                'suggestions.placePrediction.placeId',
                'suggestions.placePrediction.text.text',
                'suggestions.placePrediction.structuredFormat.mainText.text',
                'suggestions.placePrediction.structuredFormat.secondaryText.text',
            ].join(','),
        },
        body: JSON.stringify({
            input,
            includedRegionCodes: ['us'],
            sessionToken,
        }),
    });

    if (!response.ok) {
        throw new Error(`Places autocomplete failed: ${response.status}`);
    }

    const data = await response.json() as PlacesAutocompleteResponse;
    return (data.suggestions || [])
        .map(toSuggestion)
        .filter((suggestion): suggestion is AddressSuggestion => Boolean(suggestion))
        .slice(0, 5);
}

async function fetchPlaceDetails(placeId: string, apiKey: string, sessionToken: string): Promise<ParsedGooglePlaceAddress> {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    url.searchParams.set('sessionToken', sessionToken);

    const response = await fetch(url.toString(), {
        headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'id,formattedAddress,addressComponents',
        },
    });

    if (!response.ok) {
        throw new Error(`Place details failed: ${response.status}`);
    }

    const place = await response.json() as PlacesDetailsResponse;
    return parseGooglePlaceAddress(place);
}

export function GooglePlacesAddressInput({
    id,
    value,
    onChange,
    onAddressSelected,
    disabled,
    placeholder,
    className,
    'data-testid': dataTestId,
    onKeyDown,
}: GooglePlacesAddressInputProps) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    const [sessionToken, setSessionToken] = useState(createSessionToken);
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [autocompleteUnavailable, setAutocompleteUnavailable] = useState(false);
    const requestIdRef = useRef(0);

    useEffect(() => {
        if (!apiKey || autocompleteUnavailable || disabled) return;

        const query = value.trim();
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;

        if (query.length < 3) return;

        const timeout = window.setTimeout(() => {
            setLoading(true);
            fetchAddressSuggestions(query, apiKey, sessionToken)
                .then((nextSuggestions) => {
                    if (requestIdRef.current !== requestId) return;
                    setSuggestions(nextSuggestions);
                    setOpen(nextSuggestions.length > 0);
                })
                .catch((error) => {
                    console.warn('Address autocomplete suggestions failed:', error);
                    if (requestIdRef.current === requestId) {
                        setSuggestions([]);
                        setOpen(false);
                    }
                })
                .finally(() => {
                    if (requestIdRef.current === requestId) setLoading(false);
                });
        }, 250);

        return () => window.clearTimeout(timeout);
    }, [apiKey, autocompleteUnavailable, disabled, sessionToken, value]);

    const handleSelectSuggestion = async (suggestion: AddressSuggestion) => {
        setOpen(false);
        setSuggestions([]);
        onChange(suggestion.label);
        try {
            const parsed = await fetchPlaceDetails(suggestion.id, apiKey, sessionToken);
            if (parsed.full) onChange(parsed.full);
            onAddressSelected(parsed);
            setSessionToken(createSessionToken());
        } catch (error) {
            console.warn('Address autocomplete details failed:', error);
        }
    };

    return (
        <div className="relative">
            <Input
                id={id}
                value={value}
                onChange={(event) => {
                    onChange(event.target.value);
                    setAutocompleteUnavailable(false);
                    if (event.target.value.trim().length < 3) {
                        setSuggestions([]);
                        setOpen(false);
                    }
                }}
                onFocus={() => {
                    if (suggestions.length > 0) setOpen(true);
                }}
                onBlur={() => {
                    window.setTimeout(() => setOpen(false), 150);
                }}
                placeholder={placeholder}
                data-testid={dataTestId}
                className={className}
                autoComplete={apiKey && !autocompleteUnavailable ? 'off' : 'street-address'}
                disabled={disabled}
                onKeyDown={onKeyDown}
                aria-autocomplete={apiKey && !autocompleteUnavailable ? 'list' : undefined}
                aria-expanded={open}
                aria-controls={`${id}-suggestions`}
            />

            {open && (
                <div
                    id={`${id}-suggestions`}
                    role="listbox"
                    className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
                >
                    {suggestions.map((suggestion) => (
                        <button
                            key={suggestion.id}
                            type="button"
                            role="option"
                            aria-selected="false"
                            className="block w-full px-3 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSelectSuggestion(suggestion)}
                        >
                            <span className="block text-sm font-medium text-foreground">{suggestion.mainText}</span>
                            {suggestion.secondaryText && (
                                <span className="block text-xs text-muted-foreground">{suggestion.secondaryText}</span>
                            )}
                        </button>
                    ))}
                    {loading && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">Searching addresses...</div>
                    )}
                </div>
            )}
        </div>
    );
}
