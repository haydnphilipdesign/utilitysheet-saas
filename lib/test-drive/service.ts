import 'server-only';

import type { Request } from '@/types';
import type { TestDriveLifecycleEvent } from '@/lib/neon/queries';
import { TEST_DRIVE_STREET } from '@/lib/test-drive/area';
import type { TestDriveState } from '@/lib/test-drive/types';

// Used when the user does not enter their own area.
export const TEST_DRIVE_PROPERTY_ADDRESS = `${TEST_DRIVE_STREET}, Anytown, PA 18301`;
export const TEST_DRIVE_SELLER_NAME = 'UtilitySheet Test Seller';
// Seller tests per account, the first one included. Each test costs AI
// suggestion calls, so the number is capped.
export const TEST_DRIVE_LIMIT = 3;

function hasEvent(events: TestDriveLifecycleEvent[], eventType: string) {
    return events.some((event) => event.event_type === eventType);
}

export function buildTestDriveState(input: {
    request: Request | null;
    hasLiveSubmission: boolean;
    testCount?: number;
    events?: TestDriveLifecycleEvent[];
}): TestDriveState {
    const events = input.events || [];
    const canStartAnother = (input.testCount ?? 1) < TEST_DRIVE_LIMIT;

    if (input.hasLiveSubmission) {
        return { status: 'ineligible', reason: 'live_submission' };
    }

    if (!input.request) {
        return { status: 'eligible' };
    }

    if (input.request.status === 'submitted') {
        const delivery = hasEvent(events, 'test_drive_delivery_succeeded')
            ? 'sent'
            : hasEvent(events, 'test_drive_delivery_failed')
                ? 'failed'
                : 'pending';

        return {
            status: 'completed',
            reviewUrl: `/packet/${input.request.public_token}`,
            pdfUrl: `/api/packet/${input.request.public_token}/pdf`,
            delivery,
            canStartAnother,
        };
    }

    const invitationDelivery = hasEvent(events, 'test_drive_invitation_succeeded')
        ? 'sent'
        : hasEvent(events, 'test_drive_invitation_failed')
            ? 'failed'
            : 'pending';

    return {
        status: 'ready',
        sellerUrl: `/s/${input.request.seller_token || input.request.public_token}`,
        invitationDelivery,
        canStartAnother,
    };
}
