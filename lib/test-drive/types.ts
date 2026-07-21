export type TestDriveSource = 'onboarding' | 'dashboard';

export type TestDriveDeliveryStatus = 'pending' | 'sent' | 'failed';

export type TestDriveState =
    | {
        status: 'eligible';
    }
    | {
        status: 'ready';
        sellerUrl: string;
        invitationDelivery: 'pending' | 'sent' | 'failed';
    }
    | {
        status: 'completed';
        reviewUrl: string;
        pdfUrl: string;
        delivery: TestDriveDeliveryStatus;
    }
    | {
        status: 'ineligible';
        reason: 'live_submission';
    };
