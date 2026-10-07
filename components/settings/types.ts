export type NotificationPreferences = {
    seller_submissions: boolean;
    seller_submission_pdf_attachment: boolean;
    collect_electric_meter_number: boolean;
    collect_hoa_questions: boolean;
    contact_resolution: boolean;
    weekly_summary: boolean;
};

export type ActiveOrganization = {
    id: string;
    name?: string;
    slug?: string;
    role?: 'admin' | 'member';
    subscription_status?: 'free' | 'team' | 'canceled' | null;
    subscription_id?: string | null;
    subscription_ends_at?: string | null;
    /** When a plan that is set to cancel ends; null or absent when it renews. */
    subscription_cancel_at?: string | null;
    seat_quantity?: number | null;
    notification_settings?: Record<string, unknown> | null;
};

export type OrganizationMemberRow = {
    account_id: string;
    email: string;
    full_name: string | null;
    member_role: 'admin' | 'member';
};

export type PendingOrganizationInvite = {
    id: string;
    email: string;
    role: 'admin' | 'member';
    expires_at: string;
    created_at?: string;
};

export type Usage = { used: number; limit: number; plan: string };

export type SeatUsage = { used: number; pendingInvites: number };

/** Nothing below a tab may be shown as real data until its source is 'ready'. */
export type LoadState = 'loading' | 'ready' | 'error';

export type SaveState = 'saving' | 'saved' | 'error';

/** The signed-in user as Settings needs it; the browser fixture passes a stand-in. */
export type SettingsUser = {
    id?: string | null;
    displayName?: string | null;
    primaryEmail?: string | null;
    signOut: () => unknown;
};

/** The latest invitation link, kept above the tabs so it survives a tab switch. */
export type InviteLink = { email: string; url: string; expiresAt: string | null };

/** A return from Stripe checkout. The plan itself is always read from the account. */
export type CheckoutReturn = {
    plan: 'pro' | 'team';
    status: 'confirming' | 'confirmed' | 'unconfirmed' | 'not_completed';
};

export const TEAM_MIN_SEATS = 3;
export const TEAM_PRICE_PER_SEAT_USD = 7;
