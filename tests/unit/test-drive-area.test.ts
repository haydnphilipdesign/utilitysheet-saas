import { describe, expect, it } from 'vitest';

import { parseAddressWithConfidence } from '@/lib/address/location-parser';
import {
    TEST_DRIVE_AREA_HINT,
    TEST_DRIVE_AREA_STREET_ERROR,
    testDriveAddressForArea,
} from '@/lib/test-drive/area';

describe('testDriveAddressForArea', () => {
    it.each([
        ['Austin, TX 78704', '[TEST] 123 Maple Street, Austin, TX 78704'],
        ['  austin   tx ', '[TEST] 123 Maple Street, austin tx'],
        ['Fort Lauderdale, Florida', '[TEST] 123 Maple Street, Fort Lauderdale, Florida'],
        ["Coeur d'Alene, ID 83814-1234", "[TEST] 123 Maple Street, Coeur d'Alene, ID 83814-1234"],
        ['Winston-Salem, NC,', '[TEST] 123 Maple Street, Winston-Salem, NC'],
    ])('keeps the made-up street and the area typed: %s', (input, expected) => {
        expect(testDriveAddressForArea(input)).toEqual({ ok: true, propertyAddress: expected });
    });

    it('gives the suggestion pipeline the area it needs', () => {
        const result = testDriveAddressForArea('Austin, TX 78704');
        if (!result.ok) throw new Error(result.error);
        expect(parseAddressWithConfidence(result.propertyAddress)).toMatchObject({
            city: 'Austin',
            state: 'TX',
            zip: '78704',
        });
    });

    it.each([
        '456 Oak Ave, Austin, TX 78704',
        '12 Main St Austin TX',
        'Apt 4, Austin, TX',
    ])('refuses a street address: %s', (input) => {
        expect(testDriveAddressForArea(input)).toEqual({ ok: false, error: TEST_DRIVE_AREA_STREET_ERROR });
    });

    it.each([
        '',
        '   ',
        '78704',
        'Austin',
        'Texas',
        '<script>alert(1)</script>',
        'Austin; TX',
        `${'A'.repeat(60)}, TX`,
    ])('asks for a city and state: %j', (input) => {
        expect(testDriveAddressForArea(input)).toEqual({ ok: false, error: TEST_DRIVE_AREA_HINT });
    });
});
