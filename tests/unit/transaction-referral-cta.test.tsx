import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { trackEventMock } = vi.hoisted(() => ({ trackEventMock: vi.fn() }));

vi.mock('@/lib/analytics/events', () => ({ trackEvent: trackEventMock }));

import { TransactionReferralCta } from '@/components/packet/transaction-referral-cta';

const fetchMock = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    // jsdom has no IntersectionObserver; the component falls back to reporting
    // the impression on mount, which keeps this test deterministic.
    vi.stubGlobal('IntersectionObserver', undefined);
});

describe('TransactionReferralCta', () => {
    it('reports an impression to Vercel analytics and the DB counter on view', () => {
        render(<TransactionReferralCta referralCode="tc-team" />);

        expect(trackEventMock).toHaveBeenCalledWith('packet_referral_cta_viewed', {
            source: 'packet_share_page',
            has_referral_code: true,
        });
        expect(fetchMock).toHaveBeenCalledWith('/api/growth/referral-event', expect.objectContaining({
            method: 'POST',
            keepalive: true,
            body: JSON.stringify({
                eventType: 'impression',
                surface: 'packet_share_page',
                referralCode: 'tc-team',
            }),
        }));
    });

    it('links to the recipient landing page with referral attribution and reports clicks', () => {
        render(<TransactionReferralCta referralCode="tc-team" />);

        const link = screen.getByRole('link', { name: /create your own seller utility link/i });
        expect(link).toHaveAttribute(
            'href',
            '/from-a-closing?utm_source=utilitysheet_packet&utm_medium=product_referral&utm_campaign=transaction_exposure&ref=tc-team'
        );

        fireEvent.click(link);
        expect(trackEventMock).toHaveBeenCalledWith('packet_referral_cta_clicked', {
            source: 'packet_share_page',
            has_referral_code: true,
        });
        expect(fetchMock).toHaveBeenCalledWith('/api/growth/referral-event', expect.objectContaining({
            body: JSON.stringify({
                eventType: 'click',
                surface: 'packet_share_page',
                referralCode: 'tc-team',
            }),
        }));
    });

    it('still provides campaign attribution without an advocate code', () => {
        render(<TransactionReferralCta referralCode={null} />);

        expect(screen.getByRole('link', { name: /create your own seller utility link/i })).toHaveAttribute(
            'href',
            '/from-a-closing?utm_source=utilitysheet_packet&utm_medium=product_referral&utm_campaign=transaction_exposure'
        );
        expect(trackEventMock).toHaveBeenCalledWith('packet_referral_cta_viewed', {
            source: 'packet_share_page',
            has_referral_code: false,
        });
    });

    it('reports one impression per mount even when effects re-run', () => {
        const { rerender } = render(<TransactionReferralCta referralCode="tc-team" />);
        rerender(<TransactionReferralCta referralCode="tc-team" />);

        const impressionTracks = trackEventMock.mock.calls.filter(
            ([eventName]) => eventName === 'packet_referral_cta_viewed'
        );
        expect(impressionTracks).toHaveLength(1);
    });
});
