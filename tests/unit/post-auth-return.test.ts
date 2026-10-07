import { beforeEach, describe, expect, it } from 'vitest';

import {
    consumePostAuthReturnTo,
    getSignupPlanDestination,
    normalizePostAuthReturnTo,
    rememberPostAuthReturnTo,
} from '@/lib/auth/post-auth-return';

describe('post-auth return destinations', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
    });

    it('accepts only same-origin relative paths', () => {
        expect(normalizePostAuthReturnTo('/invite/tok_1?source=email')).toBe('/invite/tok_1?source=email');
        expect(normalizePostAuthReturnTo('https://evil.example/invite')).toBeNull();
        expect(normalizePostAuthReturnTo('//evil.example/invite')).toBeNull();
        expect(normalizePostAuthReturnTo('invite/tok_1')).toBeNull();
    });

    it('stores and consumes a destination exactly once', () => {
        expect(rememberPostAuthReturnTo('/invite/tok_1')).toBe('/invite/tok_1');
        expect(consumePostAuthReturnTo()).toBe('/invite/tok_1');
        expect(consumePostAuthReturnTo()).toBeNull();
    });

    it('sends a paid-plan sign-up to Billing with its plan, and nothing else anywhere', () => {
        expect(getSignupPlanDestination('teams')).toBe('/dashboard/settings?tab=billing&plan=teams');
        expect(normalizePostAuthReturnTo(getSignupPlanDestination('teams'))).toBe('/dashboard/settings?tab=billing&plan=teams');
        expect(getSignupPlanDestination('pro')).toBe('/dashboard/settings?tab=billing&plan=pro');
        expect(getSignupPlanDestination('enterprise')).toBeNull();
        expect(getSignupPlanDestination('https://evil.example')).toBeNull();
        expect(getSignupPlanDestination(null)).toBeNull();
    });

    it('clears stale storage when asked to remember an unsafe destination', () => {
        rememberPostAuthReturnTo('/invite/tok_1');
        rememberPostAuthReturnTo('https://evil.example');
        expect(consumePostAuthReturnTo()).toBeNull();
    });
});
