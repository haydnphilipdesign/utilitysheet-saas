'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics/events';

export function TransactionReferralCta({ referralCode }: { referralCode: string | null }) {
    const params = new URLSearchParams({
        utm_source: 'utilitysheet_packet',
        utm_medium: 'product_referral',
        utm_campaign: 'transaction_exposure',
    });
    if (referralCode) {
        params.set('ref', referralCode);
    }

    return (
        <Link
            href={`/auth/signup?${params.toString()}`}
            className="mt-2 inline-flex text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={() => trackEvent('packet_referral_cta_clicked', {
                source: 'packet_share_page',
                has_referral_code: Boolean(referralCode),
            })}
        >
            Coordinating the other side? Create your own seller utility link.
        </Link>
    );
}
