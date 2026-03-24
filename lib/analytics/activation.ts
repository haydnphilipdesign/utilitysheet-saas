import { trackEvent } from '@/lib/analytics/events';

type ActivationPayload = {
    accountCreated?: boolean;
    organizationCreated?: boolean;
    brandProfileCreated?: boolean;
    intakeLinkCreated?: boolean;
    defaultsProvisioned?: boolean;
};

type AccountResponseLike = {
    account?: { id?: string | null };
    activation?: ActivationPayload;
};

const PENDING_SIGNUP_VERIFICATION_KEY = 'utilitysheet.pending-signup-verification';
const DASHBOARD_FIRST_VIEW_PREFIX = 'utilitysheet.dashboard-first-view';

function isBrowser() {
    return typeof window !== 'undefined';
}

export function rememberPendingSignupVerification() {
    if (!isBrowser()) return;
    window.sessionStorage.setItem(PENDING_SIGNUP_VERIFICATION_KEY, '1');
}

export function consumePendingSignupVerification() {
    if (!isBrowser()) return false;
    const exists = window.sessionStorage.getItem(PENDING_SIGNUP_VERIFICATION_KEY) === '1';
    if (exists) {
        window.sessionStorage.removeItem(PENDING_SIGNUP_VERIFICATION_KEY);
    }
    return exists;
}

export function trackActivationResponse(data: AccountResponseLike | null | undefined, source: string) {
    if (!data?.activation) return;

    if (data.activation.accountCreated) {
        trackEvent('account_created', { source });
    }

    if (data.activation.defaultsProvisioned) {
        trackEvent('defaults_provisioned', {
            source,
            organization_created: Boolean(data.activation.organizationCreated),
            brand_profile_created: Boolean(data.activation.brandProfileCreated),
            intake_link_created: Boolean(data.activation.intakeLinkCreated),
        });
    }
}

export function trackDashboardFirstViewOnce(accountId: string | null | undefined, source: string) {
    if (!isBrowser() || !accountId) return;

    const key = `${DASHBOARD_FIRST_VIEW_PREFIX}:${accountId}`;
    if (window.sessionStorage.getItem(key) === '1') return;

    window.sessionStorage.setItem(key, '1');
    trackEvent('dashboard_first_view', { source });
}
