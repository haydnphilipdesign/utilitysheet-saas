'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ArrowRight, Link2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';

const SURFACE = 'packet_share_page' as const;

function reportReferralEvent(eventType: 'impression' | 'click', referralCode: string | null) {
    try {
        void fetch('/api/growth/referral-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventType, surface: SURFACE, referralCode }),
            keepalive: true,
        }).catch(() => undefined);
    } catch {
        // Counting must never break the packet page.
    }
}

export function TransactionReferralCta({ referralCode }: { referralCode: string | null }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const impressionSentRef = useRef(false);

    useEffect(() => {
        const sendImpression = () => {
            if (impressionSentRef.current) return;
            impressionSentRef.current = true;
            trackEvent('packet_referral_cta_viewed', {
                source: SURFACE,
                has_referral_code: Boolean(referralCode),
            });
            reportReferralEvent('impression', referralCode);
        };

        const node = containerRef.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            sendImpression();
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    sendImpression();
                    observer.disconnect();
                }
            },
            { threshold: 0.4 }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [referralCode]);

    const params = new URLSearchParams({
        utm_source: 'utilitysheet_packet',
        utm_medium: 'product_referral',
        utm_campaign: 'transaction_exposure',
    });
    if (referralCode) {
        params.set('ref', referralCode);
    }

    const handleClick = () => {
        trackEvent('packet_referral_cta_clicked', {
            source: SURFACE,
            has_referral_code: Boolean(referralCode),
        });
        reportReferralEvent('click', referralCode);
    };

    return (
        <div
            ref={containerRef}
            className="mx-auto mt-5 max-w-xl rounded-xl border border-border bg-muted/30 p-4 text-left sm:p-5"
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Link2 className="h-4 w-4 text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                        Coordinating a closing like this one?
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                        This utility sheet was collected automatically with UtilitySheet. Send sellers one
                        reusable link and get a clean, buyer-ready sheet back. Free to start.
                    </p>
                    <Link
                        href={`/from-a-closing?${params.toString()}`}
                        onClick={handleClick}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                        Create your own seller utility link
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
