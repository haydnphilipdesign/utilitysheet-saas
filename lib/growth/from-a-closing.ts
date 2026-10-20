/**
 * Shared by the static /from-a-closing page (client island) and the
 * sender-brand API route, so keep this free of server-only imports.
 */
const REFERRAL_CODE_PATTERN = /^[a-z0-9-]{1,60}$/;

/** A referral code is an intake-link slug; anything else is ignored. */
export function parseReferralCode(value: string | null | undefined): string | null {
    return value && REFERRAL_CODE_PATTERN.test(value) ? value : null;
}

export interface FromAClosingParams {
    ref?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
}

export function buildFromAClosingSignupHref(params: FromAClosingParams = {}): string {
    const signupParams = new URLSearchParams({
        utm_source: params.utm_source || 'utilitysheet_packet',
        utm_medium: params.utm_medium || 'product_referral',
        utm_campaign: params.utm_campaign || 'transaction_exposure',
        utm_content: 'from-a-closing',
    });
    const referralCode = parseReferralCode(params.ref);
    if (referralCode) signupParams.set('ref', referralCode);
    return `/auth/signup?${signupParams.toString()}`;
}
