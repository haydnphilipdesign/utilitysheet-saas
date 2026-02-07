'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, MapPin, ArrowRight } from 'lucide-react';
import { SellerLayout } from '@/components/seller-form/SellerLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BrandProfile {
    name?: string;
    logo_url?: string;
    primary_color?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_website?: string;
}

export default function IntakeLinkPage({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = use(params);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
    const [accepting, setAccepting] = useState(true);
    const [address, setAddress] = useState('');

    const slug = resolvedParams.slug;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/intake/${encodeURIComponent(slug)}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data?.error || 'Not found');
                }

                if (cancelled) return;
                setBrandProfile(data.brandProfile || null);
                setAccepting(Boolean(data.accepting));
                if (data.accepting === false) {
                    setError(data?.message || 'This link is temporarily unavailable.');
                }
            } catch (e: any) {
                if (cancelled) return;
                setError(typeof e?.message === 'string' ? e.message : 'This link is unavailable.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [slug]);

    const canStart = useMemo(() => accepting && address.trim().length >= 5 && !submitting, [accepting, address, submitting]);

    const handleStart = async () => {
        const propertyAddress = address.trim();
        if (propertyAddress.length < 5) return;

        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`/api/intake/${encodeURIComponent(slug)}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ propertyAddress }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.message || data?.error || 'Failed to start');
            }
            const token = String(data?.sellerToken || '');
            if (!token) {
                throw new Error('Failed to start');
            }

            window.location.href = `/s/${encodeURIComponent(token)}`;
        } catch (e: any) {
            setError(typeof e?.message === 'string' ? e.message : 'Failed to start. Please try again.');
            setSubmitting(false);
        }
    };

    return (
        <SellerLayout
            progress={0}
            stepName="Start"
            completedCount={0}
            totalCount={0}
            brandProfile={brandProfile}
        >
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading…</span>
                    </div>
                </div>
            ) : error ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-full max-w-md bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertTriangle className="h-8 w-8 text-red-400" />
                        </div>
                        <h1 className="text-xl font-bold text-white mb-2">Unavailable</h1>
                        <p className="text-zinc-400 mb-6 text-sm">{error}</p>
                        <Button
                            variant="outline"
                            className="border-input text-foreground hover:bg-muted"
                            onClick={() => window.location.reload()}
                        >
                            Try Again
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-xl mx-auto space-y-6">
                    <div className="rounded-2xl border border-border bg-card/50 p-6 sm:p-8">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-xl bg-emerald-500/10 p-2">
                                <MapPin className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div className="space-y-1">
                                <h1 className="text-xl font-semibold text-foreground">Enter the property address</h1>
                                <p className="text-sm text-muted-foreground">
                                    We’ll use this to tailor the utility questions for your home.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 space-y-2">
                            <Label htmlFor="propertyAddress" className="text-foreground">Property Address</Label>
                            <Input
                                id="propertyAddress"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="123 Main St, City, State"
                                data-testid="intake-address-input"
                                className="bg-background/50 border-input text-foreground"
                                autoComplete="street-address"
                                disabled={submitting}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && canStart) {
                                        e.preventDefault();
                                        handleStart();
                                    }
                                }}
                            />
                            <p className="text-xs text-muted-foreground">
                                Please include city and state if possible.
                            </p>
                        </div>

                        <div className="mt-6 flex items-center justify-end">
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={handleStart}
                                disabled={!canStart}
                                data-testid="intake-continue"
                            >
                                {submitting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                )}
                                Continue
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </SellerLayout>
    );
}
