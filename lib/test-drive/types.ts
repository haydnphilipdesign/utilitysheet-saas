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
        /** False once the account has used all its seller tests. */
        canStartAnother: boolean;
    }
    | {
        status: 'completed';
        reviewUrl: string;
        pdfUrl: string;
        delivery: TestDriveDeliveryStatus;
        canStartAnother: boolean;
    }
    | {
        status: 'ineligible';
        reason: 'live_submission';
    };
