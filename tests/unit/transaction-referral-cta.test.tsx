import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { trackEventMock } = vi.hoisted(() => ({ trackEventMock: vi.fn() }));

vi.mock('@/lib/analytics/events', () => ({ trackEvent: trackEventMock }));

import { TransactionReferralCta } from '@/components/packet/transaction-referral-cta';

beforeEach(() => vi.clearAllMocks());

describe('TransactionReferralCta', () => {
    it('builds a trackable signup link and reports clicks', () => {
        render(<TransactionReferralCta referralCode="tc-team" />);

        const link = screen.getByRole('link', { name: /coordinating the other side/i });
        expect(link).toHaveAttribute(
            'href',
            '/auth/signup?utm_source=utilitysheet_packet&utm_medium=product_referral&utm_campaign=transaction_exposure&ref=tc-team'
        );

        fireEvent.click(link);
        expect(trackEventMock).toHaveBeenCalledWith('packet_referral_cta_clicked', {
            source: 'packet_share_page',
            has_referral_code: true,
        });
    });

    it('still provides campaign attribution without an advocate code', () => {
        render(<TransactionReferralCta referralCode={null} />);

        expect(screen.getByRole('link', { name: /coordinating the other side/i })).toHaveAttribute(
            'href',
            '/auth/signup?utm_source=utilitysheet_packet&utm_medium=product_referral&utm_campaign=transaction_exposure'
        );
    });
});
