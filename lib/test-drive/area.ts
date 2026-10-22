import { parseAddressWithConfidence } from '@/lib/address/location-parser';

// The street stays fictional: only the area is real, so a client's home
// address never ends up on a test request, packet or email.
export const TEST_DRIVE_STREET = '[TEST] 123 Maple Street';
export const TEST_DRIVE_AREA_MAX_LENGTH = 60;

const AREA_CHARACTERS = /^[A-Za-z0-9 .,'-]+$/;
const TRAILING_ZIP = /\s*\b\d{5}(?:-\d{4})?\s*$/;

export const TEST_DRIVE_AREA_HINT = 'Enter a city and state, like Austin, TX 78704.';
export const TEST_DRIVE_AREA_STREET_ERROR = 'Enter only a city, state and ZIP, not a street address.';

export type TestDriveAreaResult =
    | { ok: true; propertyAddress: string }
    | { ok: false; error: string };

/**
 * Turns what the user typed as their area ("Austin, TX 78704") into the test
 * request's address. The suggestion prompt only uses city, state and ZIP, so
 * that is all we ask for.
 */
export function testDriveAddressForArea(input: string): TestDriveAreaResult {
    const area = input.replace(/\s+/g, ' ').trim().replace(/^,+|,+$/g, '').trim();
    if (!area || area.length > TEST_DRIVE_AREA_MAX_LENGTH || !AREA_CHARACTERS.test(area)) {
        return { ok: false, error: TEST_DRIVE_AREA_HINT };
    }
    // A number anywhere but a trailing ZIP means a street address was typed.
    if (/\d/.test(area.replace(TRAILING_ZIP, ''))) {
        return { ok: false, error: TEST_DRIVE_AREA_STREET_ERROR };
    }

    const propertyAddress = `${TEST_DRIVE_STREET}, ${area}`;
    const parsed = parseAddressWithConfidence(propertyAddress);
    if (!parsed.city || !parsed.state) {
        return { ok: false, error: TEST_DRIVE_AREA_HINT };
    }
    return { ok: true, propertyAddress };
}
