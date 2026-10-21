import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockTrackEvent = vi.fn();

vi.mock('next/navigation', () => ({
    usePathname: () => '/',
}));

vi.mock('@/lib/analytics/events', () => ({
    trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import { hasStackSessionCookie } from '@/lib/stack/session-hint';
import { MarketingHeader } from '@/components/marketing/marketing-header';

function clearCookies() {
    for (const pair of document.cookie.split(';')) {
        const name = pair.split('=')[0].trim();
        if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
}

describe('hasStackSessionCookie', () => {
    it('recognizes each refresh-token cookie name Stack Auth uses', () => {
        expect(hasStackSessionCookie('stack-refresh=abc')).toBe(true);
        expect(hasStackSessionCookie('theme=dark; stack-refresh-proj_123=abc')).toBe(true);
        expect(hasStackSessionCookie('stack-refresh-proj_123--default={"refresh_token":"x"}')).toBe(true);
        expect(hasStackSessionCookie('__Host-stack-refresh-proj_123--default=x')).toBe(true);
        expect(hasStackSessionCookie('stack-refresh-proj_123--custom-ABC=x')).toBe(true);
    });

    it('ignores empty values and unrelated cookies', () => {
        expect(hasStackSessionCookie('')).toBe(false);
        expect(hasStackSessionCookie('stack-refresh-proj_123=')).toBe(false);
        expect(hasStackSessionCookie('stack-is-https=true; stack-oauth-outer-1=x')).toBe(false);
        expect(hasStackSessionCookie('my-stack-refresh=x')).toBe(false);
    });
});

describe('MarketingHeader signed-in hint', () => {
    afterEach(() => {
        clearCookies();
        mockTrackEvent.mockClear();
    });

    it('shows sign-in links and tracks the header CTA for signed-out visitors', () => {
        render(<MarketingHeader />);

        expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
        expect(mockTrackEvent).toHaveBeenCalledWith('landing_primary_cta_viewed', expect.objectContaining({
            cta_id: 'primary_header_start_free',
        }));
    });

    it('shows a Dashboard link, and does not count a CTA view, when a session cookie exists', () => {
        document.cookie = 'stack-refresh-proj_123--default=x; path=/';

        render(<MarketingHeader />);

        expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
        expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
        expect(mockTrackEvent).not.toHaveBeenCalled();
    });
});

describe('Stack Auth stays off public pages', () => {
    const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

    it('is not provided by the root layout or imported by the marketing header', () => {
        expect(read('app/layout.tsx')).not.toMatch(/stack-auth-provider|@stackframe/);
        expect(read('components/marketing/marketing-header.tsx')).not.toMatch(/@stackframe|lib\/stack\/client/);
    });

    it('is provided by every signed-in area', () => {
        for (const layout of [
            'app/auth/layout.tsx',
            'app/dashboard/layout.tsx',
            'app/(admin)/layout.tsx',
            'app/onboarding/layout.tsx',
            'app/account-closed/layout.tsx',
            'app/handler/[...stack]/layout.tsx',
            'app/invite/[token]/layout.tsx',
        ]) {
            expect(read(layout), layout).toMatch(/<StackAuthProvider>/);
        }
    });
});
