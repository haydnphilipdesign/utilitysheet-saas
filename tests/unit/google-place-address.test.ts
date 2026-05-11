import { describe, expect, it } from 'vitest';
import { parseGooglePlaceAddress } from '@/lib/address/google-place';

describe('parseGooglePlaceAddress', () => {
    it('builds a canonical full address from Google address components', () => {
        const parsed = parseGooglePlaceAddress({
            place_id: 'place-123',
            formatted_address: '5439 Bluepine Dr, Cincinnati, OH 45247, USA',
            address_components: [
                { long_name: '5439', short_name: '5439', types: ['street_number'] },
                { long_name: 'Bluepine Drive', short_name: 'Bluepine Dr', types: ['route'] },
                { long_name: 'Cincinnati', short_name: 'Cincinnati', types: ['locality', 'political'] },
                { long_name: 'Ohio', short_name: 'OH', types: ['administrative_area_level_1', 'political'] },
                { long_name: '45247', short_name: '45247', types: ['postal_code'] },
            ],
        });

        expect(parsed).toEqual({
            street: '5439 Bluepine Drive',
            unit: '',
            city: 'Cincinnati',
            state: 'OH',
            zip: '45247',
            full: '5439 Bluepine Drive, Cincinnati, OH 45247',
            placeId: 'place-123',
            isComplete: true,
        });
    });

    it('returns incomplete parsed fields when Google omits required address parts', () => {
        const parsed = parseGooglePlaceAddress({
            formatted_address: 'Bluepine, Cincinnati, OH, USA',
            address_components: [
                { long_name: 'Bluepine Drive', short_name: 'Bluepine Dr', types: ['route'] },
                { long_name: 'Cincinnati', short_name: 'Cincinnati', types: ['locality', 'political'] },
                { long_name: 'Ohio', short_name: 'OH', types: ['administrative_area_level_1', 'political'] },
            ],
        });

        expect(parsed.isComplete).toBe(false);
        expect(parsed.street).toBe('Bluepine Drive');
        expect(parsed.city).toBe('Cincinnati');
        expect(parsed.state).toBe('OH');
        expect(parsed.zip).toBe('');
        expect(parsed.full).toBe('Bluepine, Cincinnati, OH, USA');
    });

    it('supports Places API New address component shape', () => {
        const parsed = parseGooglePlaceAddress({
            id: 'new-place-123',
            formattedAddress: '5439 Bluepine Dr, Cincinnati, OH 45247, USA',
            addressComponents: [
                { longText: '5439', shortText: '5439', types: ['street_number'] },
                { longText: 'Bluepine Drive', shortText: 'Bluepine Dr', types: ['route'] },
                { longText: 'Cincinnati', shortText: 'Cincinnati', types: ['locality', 'political'] },
                { longText: 'Ohio', shortText: 'OH', types: ['administrative_area_level_1', 'political'] },
                { longText: '45247', shortText: '45247', types: ['postal_code'] },
            ],
        });

        expect(parsed).toEqual({
            street: '5439 Bluepine Drive',
            unit: '',
            city: 'Cincinnati',
            state: 'OH',
            zip: '45247',
            full: '5439 Bluepine Drive, Cincinnati, OH 45247',
            placeId: 'new-place-123',
            isComplete: true,
        });
    });
});
