'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Check, CheckCircle2, Copy, ExternalLink, Loader2, Palette, Phone, Mail, Globe, Sparkles, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import UtilitySheetPdfPreview from '@/components/branding/UtilitySheetPdfPreview';
import { trackEvent } from '@/lib/analytics/events';
import { cn } from '@/lib/utils';
import type { Account, BrandProfile, Organization, PacketMode } from '@/types';

const BRAND_COLORS = [
    { name: 'Emerald', value: '#10b981' },
    { name: 'Blue', value: '#2563eb' },
    { name: 'Amber', value: '#d97706' },
    { name: 'Slate', value: '#475569' },
];

function clampChannel(value: number) {
    return Math.min(255, Math.max(0, value));
}

function adjustHexColor(hex: string, amount: number) {
    const normalized = hex.replace('#', '').trim();
    if (normalized.length !== 6) return hex;

    const r = clampChannel(parseInt(normalized.slice(0, 2), 16) + amount);
    const g = clampChannel(parseInt(normalized.slice(2, 4), 16) + amount);
    const b = clampChannel(parseInt(normalized.slice(4, 6), 16) + amount);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export default function OnboardingPage() {
    const router = useRouter();
    const completedRef = useRef(false);
    const viewedRef = useRef(false);

    const [loading, setLoading] = useState(true);
    const [savingBranding, setSavingBranding] = useState(false);
    const [savingContact, setSavingContact] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const [copied, setCopied] = useState(false);

    const [account, setAccount] = useState<Account | null>(null);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [brandProfileId, setBrandProfileId] = useState<string | null>(null);
    const [brandName, setBrandName] = useState('');
    const [primaryColor, setPrimaryColor] = useState('#10b981');
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactWebsite, setContactWebsite] = useState('');
    const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
    const [intakeLink, setIntakeLink] = useState<{ slug: string; url: string; is_active: boolean; defaultPacketMode?: PacketMode } | null>(null);

    const secondaryColor = useMemo(() => adjustHexColor(primaryColor, -24), [primaryColor]);
    const displayFirstName = account?.full_name?.split(' ')[0] || organization?.name || 'there';

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const [accountResponse, brandingResponse, intakeResponse] = await Promise.all([
                    fetch('/api/account'),
                    fetch('/api/branding'),
                    fetch('/api/intake-link'),
                ]);

                if (accountResponse.status === 401) {
                    router.push('/auth/login');
                    return;
                }

                const accountData = await accountResponse.json().catch(() => ({}));
                if (!accountResponse.ok) {
                    throw new Error(accountData?.error || 'Failed to load account');
                }

                const brandData = brandingResponse.ok ? await brandingResponse.json().catch(() => []) : [];
                const intakeData = intakeResponse.ok ? await intakeResponse.json().catch(() => ({})) : {};

                if (cancelled) return;

                const nextAccount = (accountData.account || null) as Account | null;
                const nextOrganization = (accountData.activeOrganization || null) as Organization | null;
                const profiles = Array.isArray(brandData) ? (brandData as BrandProfile[]) : [];
                const defaultProfile = profiles.find((profile) => profile.is_default) || profiles[0] || null;

                setAccount(nextAccount);
                setOrganization(nextOrganization);
                setBrandProfileId(defaultProfile?.id || null);
                setBrandName(defaultProfile?.name || nextOrganization?.name || nextAccount?.full_name || 'My Workspace');
                setPrimaryColor(defaultProfile?.primary_color || '#10b981');
                setContactName(defaultProfile?.contact_name || nextAccount?.full_name || '');
                setContactEmail(defaultProfile?.contact_email || nextAccount?.email || '');
                setContactPhone(defaultProfile?.contact_phone || nextAccount?.phone || '');
                setContactWebsite(defaultProfile?.contact_website || '');
                setLogoUrl(defaultProfile?.logo_url || undefined);
                setIntakeLink(intakeData.intakeLink || null);
                completedRef.current = Boolean(nextAccount?.onboarding_completed_at);

                if (!viewedRef.current) {
                    viewedRef.current = true;
                    trackEvent('progressive_setup_viewed', { source: 'onboarding_page' });
                }
            } catch (error) {
                console.error(error);
                toast.error('Failed to load setup. Please try again.');
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [router]);

    const completeOnboarding = async () => {
        if (completedRef.current) return;

        const response = await fetch('/api/onboarding/complete', { method: 'POST' });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || 'Failed to save setup progress');
        }

        completedRef.current = true;
        setAccount((prev) => prev ? { ...prev, onboarding_completed_at: new Date().toISOString() } : prev);
    };

    const persistBrandProfile = async (body: Record<string, unknown>) => {
        if (!brandProfileId) {
            throw new Error('Brand profile not available');
        }

        const response = await fetch(`/api/branding/${brandProfileId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to update brand profile');
        }
        return data as BrandProfile;
    };

    const handleCopyLink = async () => {
        if (!intakeLink?.url) return;

        try {
            await navigator.clipboard.writeText(intakeLink.url);
            await completeOnboarding();
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            trackEvent('seller_link_copied', { source: 'progressive_setup' });
            trackEvent('progressive_setup_task_completed', {
                source: 'onboarding_page',
                task: 'seller_link',
                method: 'copied',
            });
            toast.success('Seller link copied');
        } catch (error) {
            console.error(error);
            toast.error('Failed to copy seller link');
        }
    };

    const handleSaveBranding = async () => {
        setSavingBranding(true);
        try {
            await persistBrandProfile({
                name: brandName.trim() || organization?.name || account?.full_name || 'My Workspace',
                primary_color: primaryColor,
                secondary_color: secondaryColor,
            });
            trackEvent('progressive_setup_task_completed', {
                source: 'onboarding_page',
                task: 'branding',
                method: 'saved',
            });
            toast.success('Branding updated');
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to update branding');
        } finally {
            setSavingBranding(false);
        }
    };

    const handleSaveContact = async () => {
        setSavingContact(true);
        try {
            const normalizedWebsite = contactWebsite.trim()
                ? contactWebsite.trim().startsWith('http://') || contactWebsite.trim().startsWith('https://')
                    ? contactWebsite.trim()
                    : `https://${contactWebsite.trim()}`
                : undefined;

            await persistBrandProfile({
                name: brandName.trim() || organization?.name || account?.full_name || 'My Workspace',
                primary_color: primaryColor,
                secondary_color: secondaryColor,
                contact_name: contactName.trim() || undefined,
                contact_email: contactEmail.trim() || undefined,
                contact_phone: contactPhone.trim() || undefined,
                contact_website: normalizedWebsite,
            });
            trackEvent('progressive_setup_task_completed', {
                source: 'onboarding_page',
                task: 'contact_details',
                method: 'saved',
            });
            toast.success('Contact details updated');
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to update contact details');
        } finally {
            setSavingContact(false);
        }
    };

    const handleGoToDashboard = async () => {
        setFinishing(true);
        try {
            await completeOnboarding();
            trackEvent('setup_dismissed', {
                source: 'onboarding_page',
                destination: 'dashboard',
            });
            router.push('/dashboard');
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to save setup progress');
        } finally {
            setFinishing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-background px-4 py-8 sm:px-6">
            <div className="mx-auto max-w-5xl space-y-6">
                <div className="flex items-center justify-center gap-2 pt-2">
                    <Image src="/logo-sm.png" alt="UtilitySheet" width={28} height={28} className="h-7 w-7" />
                    <span className="text-xl font-bold text-foreground">UtilitySheet</span>
                </div>

                <Card className="overflow-hidden border-primary/25 bg-card/85 shadow-xl backdrop-blur">
                    <CardHeader className="relative pb-4">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.16),transparent_50%)]" />
                        <div className="relative">
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                <Sparkles className="h-3.5 w-3.5" />
                                Primary workflow
                            </div>
                            <CardTitle className="text-3xl text-foreground">Your seller link is ready, {displayFirstName}.</CardTitle>
                            <CardDescription className="mt-2 max-w-2xl text-sm text-muted-foreground">
                                Share one reusable link with sellers and let them start from any property address. Setup is optional now, so you can copy the link and use UtilitySheet immediately.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <LinkIcon className="h-4 w-4 text-primary" />
                                Reusable seller link
                            </div>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <Input
                                    value={intakeLink?.url || ''}
                                    readOnly
                                    className="font-mono text-sm"
                                />
                                <Button
                                    type="button"
                                    onClick={handleCopyLink}
                                    disabled={!intakeLink?.url}
                                    className="sm:min-w-[132px]"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="mr-2 h-4 w-4" />
                                            Copied
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="mr-2 h-4 w-4" />
                                            Copy Link
                                        </>
                                    )}
                                </Button>
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">Add it to your email signature</div>
                                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">Share it in texts or listing docs</div>
                                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">Use the same link across transactions</div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleGoToDashboard}
                            disabled={finishing}
                            className="w-full sm:w-auto"
                        >
                            {finishing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving…
                                </>
                            ) : (
                                <>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                Go to Dashboard
                            </>
                        )}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            Optional setup continues in the dashboard anytime you want to refine your branding or contact details.
                        </p>
                    </CardFooter>
                </Card>

                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <Card className="border-border/70 bg-card/80">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-foreground">
                                <Palette className="h-5 w-5 text-primary" />
                                Optional setup
                            </CardTitle>
                            <CardDescription>
                                Add your brand name, colors, and contact details. You can also change all of this later from the dashboard.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <Label htmlFor="brandName">Brand Display Name</Label>
                                <Input
                                    id="brandName"
                                    value={brandName}
                                    onChange={(event) => setBrandName(event.target.value)}
                                    placeholder="My Workspace"
                                />
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {BRAND_COLORS.map((color) => (
                                        <button
                                            key={color.value}
                                            type="button"
                                            onClick={() => setPrimaryColor(color.value)}
                                            className={cn(
                                                'rounded-xl border px-3 py-3 text-left transition-colors',
                                                primaryColor === color.value ? 'border-foreground bg-muted' : 'border-border hover:border-input'
                                            )}
                                        >
                                            <span className="mb-2 block h-6 w-full rounded-md" style={{ backgroundColor: color.value }} />
                                            <span className="text-xs font-medium text-foreground">{color.name}</span>
                                        </button>
                                    ))}
                                </div>
                                <Button
                                    type="button"
                                    onClick={handleSaveBranding}
                                    disabled={savingBranding || !brandProfileId}
                                >
                                    {savingBranding ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving…
                                        </>
                                    ) : (
                                        'Save Branding'
                                    )}
                                </Button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="contactName" className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-primary" />
                                        Your Name
                                    </Label>
                                    <Input id="contactName" value={contactName} onChange={(event) => setContactName(event.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contactEmail" className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        Email
                                    </Label>
                                    <Input id="contactEmail" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contactPhone" className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        Phone
                                    </Label>
                                    <Input id="contactPhone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contactWebsite" className="flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-muted-foreground" />
                                        Website
                                    </Label>
                                    <Input id="contactWebsite" value={contactWebsite} onChange={(event) => setContactWebsite(event.target.value)} placeholder="yourwebsite.com" />
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleSaveContact}
                                disabled={savingContact || !brandProfileId}
                            >
                                {savingContact ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving…
                                    </>
                                ) : (
                                    'Save Contact Details'
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-border/70 bg-card/80">
                        <CardHeader>
                            <CardTitle className="text-foreground">Preview</CardTitle>
                            <CardDescription>
                                This is how your branding appears when UtilitySheet generates the utility sheet.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <UtilitySheetPdfPreview
                                branding={{
                                    name: brandName || organization?.name || 'Your Brand',
                                    primary_color: primaryColor,
                                    secondary_color: secondaryColor,
                                    contact_name: contactName,
                                    contact_phone: contactPhone,
                                    contact_email: contactEmail,
                                    contact_website: contactWebsite,
                                    logo_url: logoUrl,
                                    disclaimer_text: '',
                                    is_default: true,
                                    show_powered_by: true,
                                    show_generation_date: true,
                                }}
                                isPro={account?.subscription_status === 'pro' || organization?.subscription_status === 'team'}
                                defaultMode={intakeLink?.defaultPacketMode}
                            />
                            <div className="rounded-xl border border-border/70 bg-muted/25 px-4 py-3 text-xs text-muted-foreground">
                                Everything here is optional. The fastest path is still to copy your reusable link and start sharing it.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
