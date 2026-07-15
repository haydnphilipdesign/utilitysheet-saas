'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { trackEvent } from '@/lib/analytics/events';

type ReferralSummary = {
    referralLink: string;
    counts: { earned: number; applied: number };
};

type LoadedReferralSummary = {
    userId: string;
    summary: ReferralSummary;
};

const referralSummaryRequests = new Map<string, Promise<ReferralSummary | null>>();

function isReferralSummary(value: unknown): value is ReferralSummary {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<ReferralSummary>;
    return (
        typeof candidate.referralLink === 'string' &&
        typeof candidate.counts?.earned === 'number' &&
        typeof candidate.counts?.applied === 'number'
    );
}

function getReferralSummary(userId: string): Promise<ReferralSummary | null> {
    const existingRequest = referralSummaryRequests.get(userId);
    if (existingRequest) return existingRequest;

    const request = fetch('/api/referrals')
        .then(async (response) => {
            if (!response.ok) return null;
            const data: unknown = await response.json().catch(() => null);
            return isReferralSummary(data) ? data : null;
        })
        .catch((error) => {
            console.error('Error fetching referral summary:', error);
            return null;
        })
        .finally(() => {
            if (referralSummaryRequests.get(userId) === request) {
                referralSummaryRequests.delete(userId);
            }
        });

    referralSummaryRequests.set(userId, request);
    return request;
}

export function ReferralCreditCard({ userId }: { userId?: string | null }) {
    const [loadedSummary, setLoadedSummary] = useState<LoadedReferralSummary | null>(null);
    const requestSequenceRef = useRef(0);
    const viewedUserIdRef = useRef<string | null>(null);
    const referralSummary = loadedSummary && loadedSummary.userId === userId
        ? loadedSummary.summary
        : null;

    useEffect(() => {
        const requestSequence = ++requestSequenceRef.current;
        viewedUserIdRef.current = null;
        if (!userId) return;

        let active = true;
        void getReferralSummary(userId).then((summary) => {
            if (!active || requestSequenceRef.current !== requestSequence || !summary) return;
            setLoadedSummary({ userId, summary });
        });

        return () => {
            active = false;
        };
    }, [userId]);

    useEffect(() => {
        if (!userId || !referralSummary || viewedUserIdRef.current === userId) return;

        viewedUserIdRef.current = userId;
        trackEvent('referral_credit_card_viewed', {
            location: 'dashboard_settings',
            earned_count: referralSummary.counts.earned,
            applied_count: referralSummary.counts.applied,
        });
    }, [referralSummary, userId]);

    const handleCopyReferralLink = async () => {
        if (!referralSummary) return;
        try {
            await navigator.clipboard.writeText(referralSummary.referralLink);
            trackEvent('referral_credit_link_copied', {
                location: 'dashboard_settings',
            });
            toast.success('Referral link copied');
        } catch {
            toast.error('Failed to copy referral link');
        }
    };

    if (!referralSummary) return null;

    return (
        <Card className="border-primary/20 bg-card/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                    <Gift className="h-5 w-5 text-primary" />
                    Give a month of Pro, get a month of Pro
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                    Share your referral link. You earn a Pro credit after the referred user receives their first real seller submission.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                        value={referralSummary.referralLink}
                        readOnly
                        aria-label="Referral link"
                        className="bg-muted border-input text-muted-foreground"
                    />
                    <Button
                        type="button"
                        aria-label="Copy referral link"
                        onClick={handleCopyReferralLink}
                        className="shrink-0"
                    >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                    </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border bg-muted/50 p-3">
                        <p className="text-sm font-semibold text-foreground">
                            {referralSummary.counts.earned} available
                        </p>
                    </div>
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            {referralSummary.counts.applied} applied
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
