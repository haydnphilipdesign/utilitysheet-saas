'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Copy, Gift, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trackEvent } from '@/lib/analytics/events';

type ReferralAttribution = {
    code: string | null;
    canClaim: boolean;
    status: 'available' | 'claimed' | 'expired' | 'unavailable';
};

type ReferralSummary = {
    referralLink: string;
    counts: { earned: number; applied: number };
    isSubscribed?: boolean;
    referralAttribution: ReferralAttribution;
};

type LoadedReferralSummary = {
    userId: string;
    summary: ReferralSummary;
};

const referralSummaryRequests = new Map<string, Promise<ReferralSummary | null>>();

function isReferralAttribution(value: unknown): value is ReferralAttribution {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<ReferralAttribution>;
    return (
        (candidate.code === null || typeof candidate.code === 'string') &&
        typeof candidate.canClaim === 'boolean' &&
        ['available', 'claimed', 'expired', 'unavailable'].includes(candidate.status || '')
    );
}

function isReferralSummary(value: unknown): value is ReferralSummary {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<ReferralSummary>;
    return (
        typeof candidate.referralLink === 'string' &&
        typeof candidate.counts?.earned === 'number' &&
        typeof candidate.counts?.applied === 'number' &&
        isReferralAttribution(candidate.referralAttribution)
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

function pluralMonths(count: number): string {
    return count === 1 ? 'month' : 'months';
}

export function ReferralCreditCard({
    userId,
    location = 'dashboard_settings',
    compact = false,
}: {
    userId?: string | null;
    location?: string;
    compact?: boolean;
}) {
    const [loadedSummary, setLoadedSummary] = useState<LoadedReferralSummary | null>(null);
    const [referralCode, setReferralCode] = useState('');
    const [isClaimingReferral, setIsClaimingReferral] = useState(false);
    const requestSequenceRef = useRef(0);
    const viewedUserIdRef = useRef<string | null>(null);
    const referralSummary = loadedSummary && loadedSummary.userId === userId
        ? loadedSummary.summary
        : null;

    useEffect(() => {
        const requestSequence = ++requestSequenceRef.current;
        viewedUserIdRef.current = null;
        setReferralCode('');
        setIsClaimingReferral(false);
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
            location,
            earned_count: referralSummary.counts.earned,
            applied_count: referralSummary.counts.applied,
        });
    }, [referralSummary, userId, location]);

    const handleCopyReferralLink = async () => {
        if (!referralSummary) return;
        try {
            await navigator.clipboard.writeText(referralSummary.referralLink);
            trackEvent('referral_credit_link_copied', {
                location,
            });
            toast.success('Referral link copied');
        } catch {
            toast.error('Failed to copy referral link');
        }
    };

    const handleClaimReferralCode = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!userId || !referralSummary?.referralAttribution.canClaim) return;

        const submittedUserId = userId;
        setIsClaimingReferral(true);
        try {
            const response = await fetch('/api/referrals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: referralCode }),
            });
            const data: unknown = await response.json().catch(() => null);
            const responseBody = data && typeof data === 'object'
                ? data as { error?: unknown; referralAttribution?: unknown }
                : null;

            if (!response.ok || !isReferralAttribution(responseBody?.referralAttribution)) {
                const message = typeof responseBody?.error === 'string'
                    ? responseBody.error
                    : 'Failed to add referral code.';
                toast.error(message);
                return;
            }

            setLoadedSummary((current) => {
                if (!current || current.userId !== submittedUserId) return current;
                return {
                    ...current,
                    summary: {
                        ...current.summary,
                        referralAttribution: responseBody.referralAttribution as ReferralAttribution,
                    },
                };
            });
            setReferralCode('');
            toast.success('Referral code added');
        } catch (error) {
            console.error('Error claiming referral code:', error);
            toast.error('Failed to add referral code.');
        } finally {
            if (userId === submittedUserId) {
                setIsClaimingReferral(false);
            }
        }
    };

    if (!referralSummary) return null;

    const { earned, applied } = referralSummary.counts;
    const hasCredits = earned > 0 || applied > 0;
    const showUpgradeNudge = earned > 0 && referralSummary.isSubscribed === false;

    return (
        <Card className="border-primary/20 bg-card/50">
            <CardHeader className={compact ? 'pb-3' : undefined}>
                <CardTitle className="flex items-center gap-2 text-foreground">
                    <Gift className="h-5 w-5 text-primary" />
                    Give a month of Pro, get a month of Pro
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                    Share your referral link with another TC or agent. When they receive their first real seller submission, you earn a free month of Pro.
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
                {!compact && referralSummary.referralAttribution.status !== 'unavailable' ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                        <p className="text-sm font-semibold text-foreground">Were you referred?</p>
                        {referralSummary.referralAttribution.status === 'available' ? (
                            <form className="mt-3 space-y-3" onSubmit={handleClaimReferralCode}>
                                <div className="space-y-2">
                                    <Label htmlFor="referral-code">Referral code</Label>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <Input
                                            id="referral-code"
                                            value={referralCode}
                                            onChange={(event) => setReferralCode(event.target.value)}
                                            placeholder="your-referral-code"
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                            maxLength={60}
                                            disabled={isClaimingReferral}
                                        />
                                        <Button
                                            type="submit"
                                            variant="outline"
                                            className="shrink-0"
                                            disabled={isClaimingReferral || referralCode.trim().length === 0}
                                        >
                                            {isClaimingReferral ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : null}
                                            Add code
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Add a code within 30 days of signup. It still counts if you have already completed a seller request.
                                </p>
                            </form>
                        ) : referralSummary.referralAttribution.status === 'claimed' ? (
                            <p className="mt-2 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" />
                                Referral code {referralSummary.referralAttribution.code} applied
                            </p>
                        ) : (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Referral codes can be added within 30 days of signup.
                            </p>
                        )}
                    </div>
                ) : null}
                {hasCredits ? (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-border bg-muted/50 p-3">
                            <p className="text-sm font-semibold text-foreground">
                                {earned} {pluralMonths(earned)} of Pro earned
                            </p>
                            <p className="text-xs text-muted-foreground">Waiting to apply</p>
                        </div>
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                {applied} {pluralMonths(applied)} applied
                            </p>
                            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Credited to your bill</p>
                        </div>
                    </div>
                ) : !compact ? (
                    <p className="text-sm text-muted-foreground">
                        Credits show up here after someone you refer gets their first real seller submission.
                    </p>
                ) : null}
                {showUpgradeNudge && (
                    <p className="text-sm text-foreground">
                        You have {earned} free {pluralMonths(earned)} of Pro waiting.{' '}
                        <Link href="/dashboard/settings?tab=billing" className="font-semibold text-primary hover:underline">
                            Upgrade to Pro
                        </Link>{' '}
                        and it applies to your bill automatically.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
