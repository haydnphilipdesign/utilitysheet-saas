import { describe, expect, it } from 'vitest';
import {
    buildAdminHref,
    parseAdminActivationFilter,
    parseAdminPlanFilter,
    parseOrgBillingFilter,
    parseRequestActivityFilter,
    parseRequestStatus,
} from '@/lib/admin/list-query';

describe('admin list filter parsing', () => {
    it('accepts only supported entitlement filters', () => {
        expect(parseAdminPlanFilter('paying')).toBe('paying');
        expect(parseAdminPlanFilter('team')).toBe('team');
        expect(parseAdminPlanFilter('pro')).toBe('pro');
        expect(parseAdminPlanFilter('free')).toBe('free');
        expect(parseAdminPlanFilter('canceled')).toBe('canceled');

        expect(parseAdminPlanFilter('enterprise')).toBeUndefined();
        expect(parseAdminPlanFilter('')).toBeUndefined();
        expect(parseAdminPlanFilter(undefined)).toBeUndefined();
    });

    it('accepts only supported activation segments', () => {
        expect(parseAdminActivationFilter('no-setup')).toBe('no-setup');
        expect(parseAdminActivationFilter('missing-defaults')).toBe('missing-defaults');
        expect(parseAdminActivationFilter('activated-7d')).toBe('activated-7d');
        expect(parseAdminActivationFilter('habitual')).toBe('habitual');

        expect(parseAdminActivationFilter('churned')).toBeUndefined();
        expect(parseAdminActivationFilter("' OR 1=1 --")).toBeUndefined();
    });

    it('accepts only supported request activity windows', () => {
        expect(parseRequestActivityFilter('7d')).toBe('7d');
        expect(parseRequestActivityFilter('30d')).toBe('30d');
        expect(parseRequestActivityFilter('stale7d')).toBe('stale7d');
        expect(parseRequestActivityFilter('stale30d')).toBe('stale30d');

        expect(parseRequestActivityFilter('90d')).toBeUndefined();
        expect(parseRequestActivityFilter('stale')).toBeUndefined();
    });

    it('accepts only supported workspace billing filters and request statuses', () => {
        expect(parseOrgBillingFilter('team')).toBe('team');
        expect(parseOrgBillingFilter('non-team')).toBe('non-team');
        expect(parseOrgBillingFilter('personal')).toBeUndefined();

        expect(parseRequestStatus('submitted')).toBe('submitted');
        expect(parseRequestStatus('in_progress')).toBe('in_progress');
        expect(parseRequestStatus('archived')).toBeUndefined();
    });
});

describe('operations overview drill-down targets', () => {
    // Each overview metric must link to a list that resolves to the same rows the metric counted.
    // These assertions pin the URL contract; the SQL predicates behind them mirror
    // lib/admin/activation-funnel.ts.
    it('round-trips every account-segment link through the users list parsers', () => {
        const links = [
            { href: '/admin/users?activation=no-setup&role=user', activation: 'no-setup' },
            { href: '/admin/users?activation=missing-defaults&role=user', activation: 'missing-defaults' },
            { href: '/admin/users?activation=activated-7d&role=user', activation: 'activated-7d' },
            { href: '/admin/users?activation=habitual&role=user', activation: 'habitual' },
        ];

        for (const link of links) {
            const params = new URL(link.href, 'https://example.test').searchParams;
            expect(parseAdminActivationFilter(params.get('activation') ?? undefined)).toBe(link.activation);
            // The funnel counts only `role = 'user'`, so the destination must carry that restriction.
            expect(params.get('role')).toBe('user');
        }
    });

    it('round-trips the paying-accounts link, which must not narrow to Pro alone', () => {
        const params = new URL('/admin/users?plan=paying&role=user', 'https://example.test').searchParams;

        expect(parseAdminPlanFilter(params.get('plan') ?? undefined)).toBe('paying');
        expect(parseAdminPlanFilter(params.get('plan') ?? undefined)).not.toBe('pro');
        expect(params.get('role')).toBe('user');
    });

    it('round-trips the seller-submission link with its 7 day window intact', () => {
        const params = new URL('/admin/requests?activity=7d&status=submitted', 'https://example.test').searchParams;

        expect(parseRequestStatus(params.get('status') ?? undefined)).toBe('submitted');
        expect(parseRequestActivityFilter(params.get('activity') ?? undefined)).toBe('7d');
    });

    it('round-trips both workspace links to distinct billing sets', () => {
        const team = new URL('/admin/organizations?billing=team', 'https://example.test').searchParams;
        const personal = new URL('/admin/organizations?billing=non-team', 'https://example.test').searchParams;

        expect(parseOrgBillingFilter(team.get('billing') ?? undefined)).toBe('team');
        expect(parseOrgBillingFilter(personal.get('billing') ?? undefined)).toBe('non-team');
    });

    it('preserves filters when building pagination and sort hrefs', () => {
        const href = buildAdminHref('/admin/users', {
            activation: 'missing-defaults',
            role: 'user',
            plan: undefined,
            page: 3,
            pageSize: 50,
            sort: 'created',
            dir: 'desc',
        });

        expect(href).toContain('activation=missing-defaults');
        expect(href).toContain('role=user');
        expect(href).toContain('page=3');
        expect(href).not.toContain('plan=');
    });
});
