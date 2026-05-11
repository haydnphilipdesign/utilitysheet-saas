'use client';

import type { KeyboardEventHandler } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { parseGooglePlaceAddress, type ParsedGooglePlaceAddress } from '@/lib/address/google-place';

declare global {
    interface Window {
        __utilitySheetGoogleMapsPromise?: Promise<void>;
    }
}

type GoogleMapsWindow = Window & {
    google?: {
        maps?: {
            importLibrary?: (name: 'places') => Promise<GooglePlacesLibrary>;
            places?: GooglePlacesLibrary;
        };
    };
};

type GooglePlaceDetails = {
    id?: string;
    formattedAddress?: string;
    addressComponents?: Array<{
        longText?: string;
        shortText?: string;
        types: string[];
    }>;
    fetchFields: (request: { fields: string[] }) => Promise<void>;
};

type GooglePlacePrediction = {
    placeId: string;
    text: { text: string };
    mainText?: { text: string };
    secondaryText?: { text: string };
    toPlace: () => GooglePlaceDetails;
};

type GoogleAutocompleteSuggestion = {
    placePrediction?: GooglePlacePrediction;
};

type GoogleAutocompleteRequest = {
    input: string;
    includedRegionCodes?: string[];
    sessionToken?: unknown;
};

type GooglePlacesLibrary = {
    AutocompleteSessionToken: new () => unknown;
    AutocompleteSuggestion: {
        fetchAutocompleteSuggestions: (request: GoogleAutocompleteRequest) => Promise<{
            suggestions: GoogleAutocompleteSuggestion[];
        }>;
    };
};

type AddressSuggestion = {
    id: string;
    label: string;
    mainText: string;
    secondaryText: string;
    prediction: GooglePlacePrediction;
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

const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-places-script';

function loadGoogleMaps(apiKey: string): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    const googleWindow = window as unknown as GoogleMapsWindow;
    if (googleWindow.google?.maps?.importLibrary) return Promise.resolve();
    if (window.__utilitySheetGoogleMapsPromise) return window.__utilitySheetGoogleMapsPromise;

    window.__utilitySheetGoogleMapsPromise = new Promise((resolve, reject) => {
        const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
        if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Google Maps script failed to load')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = GOOGLE_MAPS_SCRIPT_ID;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Google Maps script failed to load'));
        document.head.appendChild(script);
    });

    return window.__utilitySheetGoogleMapsPromise;
}

async function loadPlacesLibrary(apiKey: string): Promise<GooglePlacesLibrary | null> {
    await loadGoogleMaps(apiKey);
    const googleWindow = window as unknown as GoogleMapsWindow;
    const placesLibrary = googleWindow.google?.maps?.importLibrary
        ? await googleWindow.google.maps.importLibrary('places')
        : googleWindow.google?.maps?.places;
    return placesLibrary || null;
}

function toSuggestion(suggestion: GoogleAutocompleteSuggestion): AddressSuggestion | null {
    const prediction = suggestion.placePrediction;
    if (!prediction) return null;
    return {
        id: prediction.placeId,
        label: prediction.text.text,
        mainText: prediction.mainText?.text || prediction.text.text,
        secondaryText: prediction.secondaryText?.text || '',
        prediction,
    };
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
    const [placesLibrary, setPlacesLibrary] = useState<GooglePlacesLibrary | null>(null);
    const [sessionToken, setSessionToken] = useState<unknown | null>(null);
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [autocompleteUnavailable, setAutocompleteUnavailable] = useState(false);
    const requestIdRef = useRef(0);

    useEffect(() => {
        if (!apiKey) return;
        let cancelled = false;

        loadPlacesLibrary(apiKey)
            .then((library) => {
                if (cancelled || !library) return;
                setPlacesLibrary(library);
                setSessionToken(new library.AutocompleteSessionToken());
            })
            .catch((error) => {
                console.warn('Address autocomplete unavailable:', error);
                setAutocompleteUnavailable(true);
            });

        return () => {
            cancelled = true;
        };
    }, [apiKey]);

    useEffect(() => {
        if (!placesLibrary || !sessionToken || autocompleteUnavailable || disabled) {
            return;
        }

        const query = value.trim();
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;

        if (query.length < 3) {
            return;
        }

        const timeout = window.setTimeout(() => {
            setLoading(true);
            placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                input: query,
                includedRegionCodes: ['us'],
                sessionToken,
            })
                .then(({ suggestions: nextSuggestions }) => {
                    if (requestIdRef.current !== requestId) return;
                    const normalized = nextSuggestions
                        .map(toSuggestion)
                        .filter((suggestion): suggestion is AddressSuggestion => Boolean(suggestion))
                        .slice(0, 5);
                    setSuggestions(normalized);
                    setOpen(normalized.length > 0);
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
    }, [autocompleteUnavailable, disabled, placesLibrary, sessionToken, value]);

    const handleSelectSuggestion = async (suggestion: AddressSuggestion) => {
        setOpen(false);
        setSuggestions([]);
        onChange(suggestion.label);
        try {
            const place = suggestion.prediction.toPlace();
            await place.fetchFields({ fields: ['id', 'formattedAddress', 'addressComponents'] });
            const parsed = parseGooglePlaceAddress(place);
            if (parsed.full) onChange(parsed.full);
            onAddressSelected(parsed);
            if (placesLibrary) setSessionToken(new placesLibrary.AutocompleteSessionToken());
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
