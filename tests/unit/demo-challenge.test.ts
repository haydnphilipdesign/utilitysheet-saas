import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { clearDemoChallengeCookie, createDemoChallenge, verifyDemoChallenge } from '@/lib/security/demo-challenge';

function requestCookieFromSetCookie(setCookie: string): string {
    return setCookie.split(';')[0] || '';
}

describe('demo challenge', () => {
    const previousSecret = process.env.DEMO_CHALLENGE_SECRET;

    beforeEach(() => {
        process.env.DEMO_CHALLENGE_SECRET = 'test-demo-secret';
    });

    afterEach(() => {
        process.env.DEMO_CHALLENGE_SECRET = previousSecret;
    });

    it('creates and verifies a valid challenge', () => {
        const challenge = createDemoChallenge('unit-test-agent');
        const request = new Request('http://localhost/api/demo/suggestions', {
            method: 'POST',
            headers: {
                cookie: requestCookieFromSetCookie(challenge.cookie),
                'user-agent': 'unit-test-agent',
            },
        });

        const verification = verifyDemoChallenge(request, challenge.nonce);
        expect(verification.valid).toBe(true);
    });

    it('fails verification when nonce does not match', () => {
        const challenge = createDemoChallenge('unit-test-agent');
        const request = new Request('http://localhost/api/demo/suggestions', {
            method: 'POST',
            headers: {
                cookie: requestCookieFromSetCookie(challenge.cookie),
                'user-agent': 'unit-test-agent',
            },
        });

        const verification = verifyDemoChallenge(request, 'mismatched-token');
        expect(verification.valid).toBe(false);
    });

    it('returns a clearing cookie', () => {
        const cookie = clearDemoChallengeCookie();
        expect(cookie).toContain('Max-Age=0');
    });
});
