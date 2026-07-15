import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getIntakeLinkBySlugMock, getAccountByIdMock, getDefaultBrandProfileMock } = vi.hoisted(() => ({
    getIntakeLinkBySlugMock: vi.fn(),
    getAccountByIdMock: vi.fn(),
    getDefaultBrandProfileMock: vi.fn(),
}));

vi.mock('@/lib/neon/queries', () => ({
    getIntakeLinkBySlug: getIntakeLinkBySlugMock,
    getAccountById: getAccountByIdMock,
    getDefaultBrandProfile: getDefaultBrandProfileMock,
}));

import FromAClosingPage from '@/app/(marketing)/from-a-closing/page';

function makeSearchParams(params: Record<string, string>) {
    return Promise.resolve(params as Record<string, string | string[] | undefined>);
}

beforeEach(() => {
    vi.clearAllMocks();
    getIntakeLinkBySlugMock.mockResolvedValue(null);
});

describe('/from-a-closing recipient landing page', () => {
    it('shows the sender brand as social proof when the referral code resolves', async () => {
        getIntakeLinkBySlugMock.mockResolvedValue({ account_id: 'acct_1', is_active: true, slug: 'tc-team' });
        getAccountByIdMock.mockResolvedValue({ id: 'acct_1', role: 'user', active_organization_id: null });
        getDefaultBrandProfileMock.mockResolvedValue({ name: 'Precision Leverage Solutions' });

        render(await FromAClosingPage({ searchParams: makeSearchParams({ ref: 'tc-team' }) }));

        expect(screen.getByRole('heading', { name: /you just received a utilitysheet/i })).toBeInTheDocument();
        expect(screen.getByText(/precision leverage solutions collected this utility sheet/i)).toBeInTheDocument();
    });

    it('preserves referral attribution through to the signup CTA', async () => {
        getIntakeLinkBySlugMock.mockResolvedValue({ account_id: 'acct_1', is_active: true, slug: 'tc-team' });
        getAccountByIdMock.mockResolvedValue({ id: 'acct_1', role: 'user', active_organization_id: null });
        getDefaultBrandProfileMock.mockResolvedValue({ name: 'Precision Leverage Solutions' });

        render(await FromAClosingPage({
            searchParams: makeSearchParams({
                ref: 'tc-team',
                utm_source: 'utilitysheet_packet',
                utm_medium: 'product_referral',
                utm_campaign: 'transaction_exposure',
            }),
        }));

        expect(screen.getByRole('link', { name: /create your free seller link/i })).toHaveAttribute(
            'href',
            '/auth/signup?utm_source=utilitysheet_packet&utm_medium=product_referral&utm_campaign=transaction_exposure&utm_content=from-a-closing&ref=tc-team'
        );
    });

    it('renders generically for direct visits and unsafe referral codes', async () => {
        render(await FromAClosingPage({ searchParams: makeSearchParams({ ref: '../unsafe' }) }));

        expect(getIntakeLinkBySlugMock).not.toHaveBeenCalled();
        expect(screen.getByText(/the utility sheet you were sent was collected automatically/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /create your free seller link/i })).toHaveAttribute(
            'href',
            '/auth/signup?utm_source=utilitysheet_packet&utm_medium=product_referral&utm_campaign=transaction_exposure&utm_content=from-a-closing'
        );
        expect(screen.getByRole('link', { name: /try the seller flow/i })).toHaveAttribute('href', '/demo');
    });

    it('falls back to generic copy when the intake link is inactive', async () => {
        getIntakeLinkBySlugMock.mockResolvedValue({ account_id: 'acct_1', is_active: false, slug: 'tc-team' });

        render(await FromAClosingPage({ searchParams: makeSearchParams({ ref: 'tc-team' }) }));

        expect(screen.getByText(/the utility sheet you were sent was collected automatically/i)).toBeInTheDocument();
        expect(getDefaultBrandProfileMock).not.toHaveBeenCalled();
    });
});
