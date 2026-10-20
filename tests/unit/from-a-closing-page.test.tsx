import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));

vi.mock('next/navigation', () => ({
    useSearchParams: () => navigation.searchParams,
}));

import FromAClosingPage from '@/app/(marketing)/from-a-closing/page';

const fetchMock = vi.fn();

function visit(params: Record<string, string> = {}) {
    navigation.searchParams = new URLSearchParams(params);
    render(<FromAClosingPage />);
}

function brandResponse(brandName: string | null) {
    return Promise.resolve(new Response(JSON.stringify({ brandName }), { status: 200 }));
}

beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => brandResponse(null));
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('/from-a-closing recipient landing page', () => {
    it('shows the sender brand as social proof when the referral code resolves', async () => {
        fetchMock.mockImplementation(() => brandResponse('Precision Leverage Solutions'));

        visit({ ref: 'tc-team' });

        expect(screen.getByRole('heading', { name: /you just received a utilitysheet/i })).toBeInTheDocument();
        expect(
            await screen.findByText(/precision leverage solutions collected this utility sheet/i)
        ).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/growth/sender-brand?ref=tc-team',
            expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
    });

    it('preserves referral attribution through to the signup CTA', () => {
        visit({
            ref: 'tc-team',
            utm_source: 'utilitysheet_packet',
            utm_medium: 'product_referral',
            utm_campaign: 'transaction_exposure',
        });

        expect(screen.getByRole('link', { name: /create your free seller link/i })).toHaveAttribute(
            'href',
            '/auth/signup?utm_source=utilitysheet_packet&utm_medium=product_referral&utm_campaign=transaction_exposure&utm_content=from-a-closing&ref=tc-team'
        );
    });

    it('renders generically for direct visits and unsafe referral codes', () => {
        visit({ ref: '../unsafe' });

        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByText(/the utility sheet you were sent was collected automatically/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /create your free seller link/i })).toHaveAttribute(
            'href',
            '/auth/signup?utm_source=utilitysheet_packet&utm_medium=product_referral&utm_campaign=transaction_exposure&utm_content=from-a-closing'
        );
        expect(screen.getByRole('link', { name: /try the seller flow/i })).toHaveAttribute('href', '/demo');
    });

    it('keeps the generic copy when the referral code does not resolve', async () => {
        visit({ ref: 'tc-team' });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(screen.getByText(/the utility sheet you were sent was collected automatically/i)).toBeInTheDocument();
    });

    it('keeps the generic copy when the lookup fails', async () => {
        fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));

        visit({ ref: 'tc-team' });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(screen.getByText(/the utility sheet you were sent was collected automatically/i)).toBeInTheDocument();
    });
});
