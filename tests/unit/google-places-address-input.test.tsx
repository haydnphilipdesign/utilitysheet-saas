import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { GooglePlacesAddressInput } from '@/components/address/GooglePlacesAddressInput';

function StatefulAddressInput() {
    const [value, setValue] = useState('');

    return (
        <GooglePlacesAddressInput
            id="propertyAddress"
            value={value}
            onChange={setValue}
            onAddressSelected={vi.fn()}
            data-testid="address-input"
        />
    );
}

describe('GooglePlacesAddressInput', () => {
    beforeEach(() => {
        vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'test-google-key');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('does not reopen suggestions after selecting an address', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('places:autocomplete')) {
                return Response.json({
                    suggestions: [
                        {
                            placePrediction: {
                                placeId: 'place-112',
                                text: { text: '112 Morris Place, Bushkill, PA 18324, USA' },
                                structuredFormat: {
                                    mainText: { text: '112 Morris Place' },
                                    secondaryText: { text: 'Bushkill, PA 18324, USA' },
                                },
                            },
                        },
                    ],
                });
            }

            return Response.json({
                id: 'place-112',
                formattedAddress: '112 Morris Place, Bushkill, PA 18324, USA',
                addressComponents: [
                    { longText: '112', shortText: '112', types: ['street_number'] },
                    { longText: 'Morris Place', shortText: 'Morris Pl', types: ['route'] },
                    { longText: 'Bushkill', shortText: 'Bushkill', types: ['locality', 'political'] },
                    { longText: 'Pennsylvania', shortText: 'PA', types: ['administrative_area_level_1', 'political'] },
                    { longText: '18324', shortText: '18324', types: ['postal_code'] },
                ],
            });
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<StatefulAddressInput />);

        const input = screen.getByTestId('address-input');
        fireEvent.change(input, { target: { value: '112 Morris Pla' } });

        const suggestion = await screen.findByRole('option');
        fireEvent.click(suggestion);

        await waitFor(() => {
            expect(input).toHaveValue('112 Morris Place, Bushkill, PA 18324');
        });

        await new Promise((resolve) => {
            window.setTimeout(resolve, 350);
        });

        expect(screen.queryByRole('option')).not.toBeInTheDocument();
        expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('places:autocomplete'))).toHaveLength(1);

        fireEvent.focus(input);
        expect(screen.queryByRole('option')).not.toBeInTheDocument();

        fireEvent.change(input, { target: { value: '112 Morris Place Apt' } });

        await waitFor(() => {
            expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('places:autocomplete'))).toHaveLength(2);
        });
    });
});
