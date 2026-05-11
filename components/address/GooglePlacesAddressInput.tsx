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

type GooglePlacesWindow = Window & {
    google?: {
        maps?: {
            places?: {
                Autocomplete: new (
                    input: HTMLInputElement,
                    options: {
                        componentRestrictions?: { country: string | string[] };
                        fields?: string[];
                        types?: string[];
                    }
                ) => {
                    addListener: (eventName: 'place_changed', handler: () => void) => {
                        remove: () => void;
                    };
                    getPlace: () => {
                        address_components?: Array<{
                            long_name: string;
                            short_name: string;
                            types: string[];
                        }>;
                        formatted_address?: string;
                        place_id?: string;
                    };
                };
            };
        };
    };
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

function loadGooglePlaces(apiKey: string): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    const googleWindow = window as unknown as GooglePlacesWindow;
    if (googleWindow.google?.maps?.places?.Autocomplete) return Promise.resolve();
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
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Google Maps script failed to load'));
        document.head.appendChild(script);
    });

    return window.__utilitySheetGoogleMapsPromise;
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
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [autocompleteUnavailable, setAutocompleteUnavailable] = useState(false);
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

    useEffect(() => {
        if (!apiKey || !inputRef.current || disabled) return;

        let cancelled = false;
        let listener: { remove: () => void } | null = null;

        loadGooglePlaces(apiKey)
            .then(() => {
                const googleWindow = window as unknown as GooglePlacesWindow;
                if (cancelled || !inputRef.current || !googleWindow.google?.maps?.places?.Autocomplete) return;

                const autocomplete = new googleWindow.google.maps.places.Autocomplete(inputRef.current, {
                    componentRestrictions: { country: 'us' },
                    fields: ['address_components', 'formatted_address', 'place_id'],
                    types: ['address'],
                });

                listener = autocomplete.addListener('place_changed', () => {
                    const parsed = parseGooglePlaceAddress(autocomplete.getPlace());
                    if (parsed.full) {
                        onChange(parsed.full);
                    }
                    onAddressSelected(parsed);
                });
            })
            .catch((error) => {
                console.warn('Address autocomplete unavailable:', error);
                setAutocompleteUnavailable(true);
            });

        return () => {
            cancelled = true;
            listener?.remove();
        };
    }, [apiKey, disabled, onAddressSelected, onChange]);

    return (
        <Input
            ref={inputRef}
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            data-testid={dataTestId}
            className={className}
            autoComplete={apiKey && !autocompleteUnavailable ? 'off' : 'street-address'}
            disabled={disabled}
            onKeyDown={onKeyDown}
        />
    );
}
