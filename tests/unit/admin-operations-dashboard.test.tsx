import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

import { RecentRequestsList } from '@/components/admin/RecentRequestsList';
import { RecentSignupsList } from '@/components/admin/RecentSignupsList';
import { RequestLifecycleBar } from '@/components/admin/RequestLifecycleBar';
import type { RecentRequestSummary, RecentSignupSummary } from '@/lib/admin/operations-overview';

function buildRequest(overrides: Partial<RecentRequestSummary> = {}): RecentRequestSummary {
    return {
        id: 'a4e2b0a4-2f4d-4f7c-9d0e-2f4bb1d7c001',
        accountId: 'bd9f2c11-4f30-4bd7-9a6f-1c22d4f0a900',
        propertyAddress: '5575 Horseshoe Bend Road, Hamilton, OH',
        status: 'in_progress',
        createdAt: '2026-08-23T14:02:00.000Z',
        userName: 'Agatha Aquilia',
        userEmail: 'agatha@example.com',
        ...overrides,
    };
}

function buildSignup(overrides: Partial<RecentSignupSummary> = {}): RecentSignupSummary {
    return {
        id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
        name: 'Dolores Marchetti',
        email: 'dolores@example.com',
        createdAt: '2026-08-22T09:15:00.000Z',
        plan: 'free',
        requestCount: 0,
        submittedCount: 0,
        ...overrides,
    };
}

describe('RecentRequestsList', () => {
    it('renders every recent request with its account, status, and destination', () => {
        render(<RecentRequestsList requests={[buildRequest(), buildRequest({ id: 'second', propertyAddress: '12 Alder Court, Dayton, OH' })]} />);

        expect(screen.getByRole('link', { name: /5575 Horseshoe Bend Road/i })).toHaveAttribute(
            'href',
            '/admin/requests/a4e2b0a4-2f4d-4f7c-9d0e-2f4bb1d7c001'
        );
        expect(screen.getByRole('link', { name: /12 Alder Court/i })).toHaveAttribute('href', '/admin/requests/second');
        expect(screen.getAllByText('Agatha Aquilia')).toHaveLength(2);
        expect(screen.getAllByText('In Progress')).toHaveLength(2);
    });

    it('renders an account without a profile as plain text rather than a broken preview', () => {
        render(<RecentRequestsList requests={[buildRequest({ accountId: null, userName: null, userEmail: null })]} />);

        expect(screen.getByText('Unknown user')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /unknown user/i })).not.toBeInTheDocument();
    });

    it('explains an empty list instead of rendering nothing', () => {
        render(<RecentRequestsList requests={[]} />);

        expect(screen.getByText(/no requests yet/i)).toBeInTheDocument();
    });
});

describe('RecentSignupsList', () => {
    it('says when a new account has not started yet', () => {
        render(<RecentSignupsList signups={[buildSignup()]} />);

        expect(screen.getByRole('link', { name: 'Dolores Marchetti' })).toHaveAttribute(
            'href',
            '/admin/users/c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
        );
        expect(screen.getByText('No request yet')).toBeInTheDocument();
    });

    it('distinguishes a started account from an activated one', () => {
        render(
            <RecentSignupsList
                signups={[
                    buildSignup({ id: 'started', name: 'Started Account', requestCount: 1 }),
                    buildSignup({ id: 'live', name: 'Live Account', requestCount: 4, submittedCount: 2 }),
                ]}
            />
        );

        expect(screen.getByText('1 request')).toBeInTheDocument();
        expect(screen.getByText('2 submitted')).toBeInTheDocument();
    });

    it('surfaces a paid plan but stays quiet about free', () => {
        render(
            <RecentSignupsList
                signups={[
                    buildSignup({ id: 'paid', name: 'Paid Account', plan: 'pro' }),
                    buildSignup({ id: 'free', name: 'Free Account', plan: 'free' }),
                ]}
            />
        );

        expect(screen.getByText('pro')).toBeInTheDocument();
        expect(screen.queryByText('free')).not.toBeInTheDocument();
    });

    it('falls back to the email when an account has no name', () => {
        render(<RecentSignupsList signups={[buildSignup({ name: null })]} />);

        expect(screen.getByRole('link', { name: 'dolores@example.com' })).toBeInTheDocument();
    });
});

describe('RequestLifecycleBar', () => {
    const rows = [
        { status: 'submitted', count: 120 },
        { status: 'draft', count: 400 },
        { status: 'in_progress', count: 200 },
        { status: 'sent', count: 80 },
    ];

    it('orders segments by lifecycle rather than by the order the rows arrive', () => {
        const { container } = render(<RequestLifecycleBar rows={rows} total={800} />);

        const labels = within(container.querySelector('ul') as HTMLElement)
            .getAllByRole('link')
            .map((link) => link.textContent);

        expect(labels).toEqual(['Draft400', 'Sent80', 'In Progress200', 'Submitted120']);
    });

    it('links each status to its filtered request list', () => {
        render(<RequestLifecycleBar rows={rows} total={800} />);

        expect(screen.getByRole('link', { name: /submitted/i })).toHaveAttribute(
            'href',
            '/admin/requests?status=submitted'
        );
    });

    it('describes the whole bar for assistive technology', () => {
        render(<RequestLifecycleBar rows={rows} total={800} />);

        expect(screen.getByRole('img')).toHaveAttribute(
            'aria-label',
            'Draft: 400, Sent: 80, In Progress: 200, Submitted: 120'
        );
    });

    it('drops empty statuses so the legend only lists real states', () => {
        render(<RequestLifecycleBar rows={[{ status: 'draft', count: 5 }, { status: 'sent', count: 0 }]} total={5} />);

        expect(screen.getByRole('link', { name: /draft/i })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /sent/i })).not.toBeInTheDocument();
    });

    it('renders a message rather than an empty bar when there are no requests', () => {
        render(<RequestLifecycleBar rows={[]} total={0} />);

        expect(screen.getByText(/no requests recorded yet/i)).toBeInTheDocument();
    });
});
