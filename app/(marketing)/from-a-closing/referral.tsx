'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

import { buildFromAClosingSignupHref, parseReferralCode } from '@/lib/growth/from-a-closing';

// The page is prerendered, so these components read the query string on the
// client. The Suspense fallbacks in page.tsx are the generic, indexable copy.

const GENERIC_INTRO =
    'The utility sheet you were sent was collected automatically with UtilitySheet instead of texts, emails, and blank forms. If you coordinate closings too, you can use the same workflow on your next file.';

function brandedIntro(brandName: string) {
    return `${brandName} collected this utility sheet automatically with UtilitySheet instead of chasing the seller through texts, emails, and blank forms. If you coordinate closings too, you can use the same workflow on your next file.`;
}

export function GenericSenderIntro() {
    return <>{GENERIC_INTRO}</>;
}

export function SenderIntro() {
    const referralCode = parseReferralCode(useSearchParams().get('ref'));
    const [brand, setBrand] = useState<{ code: string; name: string } | null>(null);

    useEffect(() => {
        if (!referralCode) return;
        const controller = new AbortController();
        fetch(`/api/growth/sender-brand?ref=${encodeURIComponent(referralCode)}`, {
            signal: controller.signal,
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((data: { brandName?: unknown } | null) => {
                if (typeof data?.brandName === 'string' && data.brandName) {
                    setBrand({ code: referralCode, name: data.brandName });
                }
            })
            // Social proof is optional; the generic copy stays on any failure.
            .catch(() => undefined);
        return () => controller.abort();
    }, [referralCode]);

    if (!brand || brand.code !== referralCode) return <GenericSenderIntro />;
    return <>{brandedIntro(brand.name)}</>;
}

export function SignupCta({ href }: { href?: string }) {
    return (
        <Link href={href ?? buildFromAClosingSignupHref()} className="marketing-button">
            Create your free seller link
            <ArrowRight size={17} aria-hidden="true" />
        </Link>
    );
}

export function ReferralSignupCta() {
    const searchParams = useSearchParams();
    return (
        <SignupCta
            href={buildFromAClosingSignupHref({
                ref: searchParams.get('ref'),
                utm_source: searchParams.get('utm_source'),
                utm_medium: searchParams.get('utm_medium'),
                utm_campaign: searchParams.get('utm_campaign'),
            })}
        />
    );
}
