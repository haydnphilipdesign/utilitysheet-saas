import 'server-only';

import type { Request } from '@/types';
import type { TestDriveLifecycleEvent } from '@/lib/neon/queries';
import type { TestDriveState } from '@/lib/test-drive/types';

export const TEST_DRIVE_PROPERTY_ADDRESS = '[TEST] 123 Maple Street, Anytown, PA 18301';
export const TEST_DRIVE_SELLER_NAME = 'UtilitySheet Test Seller';

function hasEvent(events: TestDriveLifecycleEvent[], eventType: string) {
    return events.some((event) => event.event_type === eventType);
}

export function buildTestDriveState(input: {
    request: Request | null;
    hasLiveSubmission: boolean;
    events?: TestDriveLifecycleEvent[];
}): TestDriveState {
    const events = input.events || [];

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
    };
}
