'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Globe, ImagePlus, Loader2, Mail, Phone, Trash2, User, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import UtilitySheetPdfPreview from '@/components/branding/UtilitySheetPdfPreview';
import { trackEvent } from '@/lib/analytics/events';
import { cn } from '@/lib/utils';
import { DEFAULT_BRAND_COLOR } from '@/lib/branding/deliverable';
import type { Account, BrandProfile, Organization, PacketMode } from '@/types';

const BRAND_COLORS = [
    { name: 'Slate blue', value: DEFAULT_BRAND_COLOR },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Amber', value: '#d97706' },
    { name: 'Slate', value: '#475569' },
];

const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

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

function normalizeWebsite(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
}

/**
 * Optional branding step reached from the dashboard guide and the welcome
 * email: name, logo, color, and contact details for the default Branding
 * Profile, with a live preview. The seller link and seller test live on the
 * dashboard guide. Saving also marks onboarding complete for this account.
 */
export default function OnboardingPage() {
    const router = useRouter();
    const completedRef = useRef(false);
    const viewedRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [account, setAccount] = useState<Account | null>(null);
    const [organization, setOrganization] = useState<(Organization & { role?: string | null }) | null>(null);
    const [brandProfileId, setBrandProfileId] = useState<string | null>(null);
    const [brandName, setBrandName] = useState('');
    const [primaryColor, setPrimaryColor] = useState(DEFAULT_BRAND_COLOR);
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactWebsite, setContactWebsite] = useState('');
    // null means "clear the stored logo" when saving.
    const [logoUrl, setLogoUrl] = useState<string | null | undefined>(undefined);
    const [defaultPacketMode, setDefaultPacketMode] = useState<PacketMode | undefined>(undefined);

    const secondaryColor = useMemo(() => adjustHexColor(primaryColor, -24), [primaryColor]);
    const sharedWorkspace = organization?.subscription_status === 'team' ? organization : null;

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
                const nextOrganization = (accountData.activeOrganization || null) as (Organization & { role?: string | null }) | null;
                const profiles = Array.isArray(brandData) ? (brandData as BrandProfile[]) : [];
                const defaultProfile = profiles.find((profile) => profile.is_default) || profiles[0] || null;

                setAccount(nextAccount);
                setOrganization(nextOrganization);
                setBrandProfileId(defaultProfile?.id || null);
                setBrandName(defaultProfile?.name || nextOrganization?.name || nextAccount?.full_name || 'My Workspace');
                setPrimaryColor(defaultProfile?.primary_color || DEFAULT_BRAND_COLOR);
                setContactName(defaultProfile?.contact_name || nextAccount?.full_name || '');
                setContactEmail(defaultProfile?.contact_email || nextAccount?.email || '');
                setContactPhone(defaultProfile?.contact_phone || nextAccount?.phone || '');
                setContactWebsite(defaultProfile?.contact_website || '');
                setLogoUrl(defaultProfile?.logo_url || undefined);
                setDefaultPacketMode(intakeData.intakeLink?.defaultPacketMode);
                completedRef.current = Boolean(nextAccount?.onboarding_completed_at);

                if (!viewedRef.current) {
                    viewedRef.current = true;
                    trackEvent('progressive_setup_viewed', { source: 'onboarding_page' });
                }
            } catch (error) {
                console.error(error);
                toast.error('We couldn’t load your branding. Reload the page to try again.');
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
            throw new Error(data?.error || 'We couldn’t save that. Try again.');
        }

        completedRef.current = true;
    };

    const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!LOGO_TYPES.includes(file.type)) {
            toast.error('That file type isn’t supported. Use a JPEG, PNG, WebP or SVG.');
            return;
        }
        if (file.size > LOGO_MAX_BYTES) {
            toast.error('That file is too large. The limit is 2 MB.');
            return;
        }

        setUploading(true);
        try {
            const body = new FormData();
            body.append('file', file);
            const response = await fetch('/api/branding/upload', { method: 'POST', body });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || 'We couldn’t upload the logo. Try again.');
            }
            setLogoUrl(data.url);
            toast.success('Logo uploaded. Save to keep it.');
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'We couldn’t upload the logo. Try again.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSave = async () => {
        if (!brandProfileId) {
            toast.error('Your Branding Profile isn’t ready yet. Reload the page and try again.');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`/api/branding/${brandProfileId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: brandName.trim() || organization?.name || account?.full_name || 'My Workspace',
                    primary_color: primaryColor,
                    secondary_color: secondaryColor,
                    contact_name: contactName.trim() || undefined,
                    contact_email: contactEmail.trim() || undefined,
                    contact_phone: contactPhone.trim() || undefined,
                    contact_website: normalizeWebsite(contactWebsite),
                    ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'We couldn’t save your branding. Try again.');
            }
            await completeOnboarding();
            trackEvent('progressive_setup_task_completed', {
                source: 'onboarding_page',
                task: 'branding',
                method: 'saved',
            });
            toast.success('Branding saved');
            router.push('/dashboard');
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'We couldn’t save your branding. Try again.');
        } finally {
            setSaving(false);
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
                <div className="flex items-center justify-between gap-4 pt-2">
                    <Link
                        href="/dashboard"
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Dashboard
                    </Link>
                    <div className="flex items-center gap-2">
                        <Image src="/logo-sm.png" alt="UtilitySheet" width={28} height={28} className="h-7 w-7" />
                        <span className="text-xl font-bold text-foreground">UtilitySheet</span>
                    </div>
                </div>

                <div>
                    <h1 className="text-3xl font-semibold text-foreground">Put your brand on every sheet</h1>
                    <p className="mt-2 max-w-2xl text-muted-foreground">
                        Your name, logo, color, and contact details appear on the seller form, the utility sheet, and its PDF.
                        This is optional. You can change it any time.
                    </p>
                </div>

                {sharedWorkspace ? (
                    <p role="status" className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                        <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        Everyone in {sharedWorkspace.name || 'your team’s workspace'} shares these branding settings, so changes apply to the whole team.
                    </p>
                ) : null}

                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <Card className="border-border/70 bg-card/80">
                        <CardHeader>
                            <CardTitle>
                                <h2 className="text-lg font-semibold text-foreground">Your branding</h2>
                            </CardTitle>
                            <CardDescription>The preview updates as you type.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="brandName">Brand name</Label>
                                <Input
                                    id="brandName"
                                    value={brandName}
                                    onChange={(event) => setBrandName(event.target.value)}
                                    placeholder="My Workspace"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="logo-upload">Logo</Label>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                                        {logoUrl ? (
                                            <Image src={logoUrl} alt="Current brand logo" fill className="object-contain" />
                                        ) : (
                                            <ImagePlus className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        id="logo-upload"
                                        type="file"
                                        accept={LOGO_TYPES.join(',')}
                                        className="sr-only"
                                        onChange={handleLogoChange}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="min-h-11 sm:min-h-8"
                                    >
                                        {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                                        {logoUrl ? 'Replace logo' : 'Upload logo'}
                                    </Button>
                                    {logoUrl ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setLogoUrl(null)}
                                            className="min-h-11 text-muted-foreground sm:min-h-8"
                                        >
                                            <Trash2 />
                                            Remove
                                        </Button>
                                    ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    JPEG, PNG, WebP, or SVG, up to 2 MB. Without a logo, your initials are shown.
                                </p>
                            </div>

                            <fieldset className="space-y-2">
                                <legend className="text-sm font-medium text-foreground">Color</legend>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {BRAND_COLORS.map((color) => (
                                        <button
                                            key={color.value}
                                            type="button"
                                            aria-pressed={primaryColor === color.value}
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
                            </fieldset>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="contactName" className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                        Your name
                                    </Label>
                                    <Input id="contactName" autoComplete="name" value={contactName} onChange={(event) => setContactName(event.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contactEmail" className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                        Email
                                    </Label>
                                    <Input id="contactEmail" type="email" autoComplete="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contactPhone" className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                        Phone
                                    </Label>
                                    <Input id="contactPhone" type="tel" autoComplete="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contactWebsite" className="flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                        Website
                                    </Label>
                                    <Input id="contactWebsite" value={contactWebsite} onChange={(event) => setContactWebsite(event.target.value)} placeholder="yourwebsite.com" />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={saving || uploading || !brandProfileId}
                                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="animate-spin" />
                                        Saving…
                                    </>
                                ) : (
                                    'Save and go to dashboard'
                                )}
                            </Button>
                            {brandProfileId ? (
                                <Link
                                    href={`/dashboard/branding/${brandProfileId}`}
                                    className="text-sm font-medium text-primary hover:underline"
                                >
                                    More branding options
                                </Link>
                            ) : null}
                        </CardFooter>
                    </Card>

                    <Card className="border-border/70 bg-card/80">
                        <CardHeader>
                            <CardTitle>
                                <h2 className="text-lg font-semibold text-foreground">Preview</h2>
                            </CardTitle>
                            <CardDescription>
                                How your branding appears on the utility sheet.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <UtilitySheetPdfPreview
                                branding={{
                                    name: brandName || organization?.name || 'Your Brand',
                                    primary_color: primaryColor,
                                    secondary_color: secondaryColor,
                                    contact_name: contactName,
                                    contact_phone: contactPhone,
                                    contact_email: contactEmail,
                                    contact_website: contactWebsite,
                                    logo_url: logoUrl || undefined,
                                    disclaimer_text: '',
                                    is_default: true,
                                    show_powered_by: true,
                                    show_generation_date: true,
                                }}
                                isPro={account?.subscription_status === 'pro' || organization?.subscription_status === 'team'}
                                defaultMode={defaultPacketMode}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
