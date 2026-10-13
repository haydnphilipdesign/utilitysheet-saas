import { describe, expect, it } from 'vitest';
import { beforeAnalyticsSend, beforeSpeedInsightsSend } from '@/lib/analytics/collector-policy';
import { telemetryPath } from '@/lib/analytics/route-policy';
import { capabilityRateLimitIdentifier } from '@/lib/rate-limit-identifier';

describe('capability limiter identifiers', () => {
    it('is stable, scoped, opaque and preserves token+IP grouping', () => {
        const key = capabilityRateLimitIdentifier('seller-ai', 'synthetic-secret:1.2.3.4');
        expect(key).toMatch(/^cap:v1:seller-ai:[a-f0-9]{64}$/);
        expect(key).toBe(capabilityRateLimitIdentifier('seller-ai', 'synthetic-secret:1.2.3.4'));
        expect(key).not.toBe(capabilityRateLimitIdentifier('seller-ai', 'other-secret:1.2.3.4'));
        expect(key).not.toBe(capabilityRateLimitIdentifier('seller-ai', 'synthetic-secret:1.2.3.5'));
        expect(key).not.toBe(capabilityRateLimitIdentifier('packet-pdf', 'synthetic-secret:1.2.3.4'));
        expect(key).not.toContain('synthetic-secret');
        expect(key).not.toContain('1.2.3.4');
    });
});

describe('collector boundaries', () => {
    it.each([
        ['/s/synthetic-secret?password=synthetic-password#private', '/s/[token]'],
        ['/%73/encoded%2Fsecret', '/s/[token]'],
        ['/packet/synthetic-secret', '/packet/[token]'],
        ['/i/private-slug/suffix', '/i/[slug]'],
        ['/form/private-slug/suffix', '/form/[slug]'],
        ['/invite/synthetic-secret', '/invite/[token]'],
        ['/auth/reset/synthetic-secret', '/auth'],
        ['/handler/oauth?code=synthetic-secret', '/handler'],
        ['/admin/users/private-account', '/admin'],
        ['/dashboard/requests/private-id', '/dashboard'],
        ['/123%20Sentinel%20Street', '/other'],
        ['/bad%encoding', '/other'],
        ['//foreign.example/private', '/other'],
        ['/%2573/synthetic-secret', '/other'],
        ['/pricing?password=secret', '/pricing'],
    ])('canonicalizes %s', (path, expected) => expect(telemetryPath(path)).toBe(expected));

    it.each(['pageview', 'event'] as const)('reconstructs safe %s fields, retaining coarse custom-event URLs', (type) => {
        const result = beforeAnalyticsSend({
            type, url: 'https://utilitysheet.com/s/synthetic-secret?address=123+Sentinel+Street#password',
            route: '/s/synthetic-secret', referrer: 'private-account', token: 'synthetic-secret',
        } as Parameters<typeof beforeAnalyticsSend>[0]);
        expect(result).toEqual({ type, url: 'https://utilitysheet.com/s/[token]' });
    });

    it('normalizes both Speed Insights URL and route and drops unknown fields', () => {
        expect(beforeSpeedInsightsSend({
            type: 'vital', url: 'https://utilitysheet.com/admin/users/private-account?password=secret',
            route: '/admin/users/private-account', referrer: 'synthetic-secret',
        } as Parameters<typeof beforeSpeedInsightsSend>[0])).toEqual({
            type: 'vital', url: 'https://utilitysheet.com/admin', route: '/admin',
        });
    });

    it.each(['invalid', 'javascript:secret', 'https://secret@utilitysheet.com/s/token', 'https://private-account.example/s/token'])('drops unsafe or unparseable collector URL %s', (url) => {
        expect(beforeAnalyticsSend({ type: 'event', url })).toBeNull();
        expect(beforeSpeedInsightsSend({ type: 'vital', url })).toBeNull();
    });
});
