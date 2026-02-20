'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
    Palette,
    CheckCircle2,
    Loader2,
    ArrowRight,
    ArrowLeft,
    Sparkles,
    User,
    Phone,
    Mail,
    Globe,
    Send,
    FileText,
    Link as LinkIcon,
    Copy,
    Check,
    Building2,
    Zap,
    ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import UtilitySheetPdfPreview from '@/components/branding/UtilitySheetPdfPreview';
import type { Account, BrandProfile, Organization } from '@/types';

// Steps configuration
const STEPS = [
    { id: 1, title: 'Welcome', description: 'Set up your workspace' },
    { id: 2, title: 'Branding', description: 'Your brand identity' },
    { id: 3, title: 'Contact', description: 'Your contact info' },
    { id: 4, title: 'Preview', description: 'See it in action' },
    { id: 5, title: 'Launch', description: "You're ready!" },
];

// Pre-defined brand colors with labels
const BRAND_COLORS = [
    { name: 'Emerald', value: '#10b981' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Slate', value: '#64748b' },
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
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [account, setAccount] = useState<Account | null>(null);
    const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
    const [organizationCreated, setOrganizationCreated] = useState(false);
    const [brandProfileId, setBrandProfileId] = useState<string | null>(null);
    const [brandProfileCreated, setBrandProfileCreated] = useState(false);
    const [contactInfoSaved, setContactInfoSaved] = useState(false);

    // Form states
    const [orgName, setOrgName] = useState('');
    const [brandName, setBrandName] = useState('');
    const [brandNameTouched, setBrandNameTouched] = useState(false);
    const [primaryColor, setPrimaryColor] = useState('#10b981');
    const secondaryColor = useMemo(() => adjustHexColor(primaryColor, -24), [primaryColor]);
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactWebsite, setContactWebsite] = useState('');
    const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);

    // Intake link state
    const [intakeLink, setIntakeLink] = useState<{ slug: string; url: string; is_active: boolean } | null>(null);
    const [intakeLinkLoading, setIntakeLinkLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Fetch intake link when reaching step 5
    useEffect(() => {
        if (step !== 5 || intakeLink || intakeLinkLoading) return;

        setIntakeLinkLoading(true);
        fetch('/api/intake-link')
            .then((r) => r.json())
            .then((data) => {
                if (data.intakeLink) setIntakeLink(data.intakeLink);
            })
            .catch(console.error)
            .finally(() => setIntakeLinkLoading(false));
    }, [step, intakeLink, intakeLinkLoading]);

    const handleCopyLink = async () => {
        if (!intakeLink?.url) return;
        try {
            await navigator.clipboard.writeText(intakeLink.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            toast.error('Failed to copy link');
        }
    };

    const fetchDefaultBrandProfile = async (): Promise<BrandProfile | null> => {
        const response = await fetch('/api/branding');
        if (!response.ok) return null;

        const brandData = await response.json().catch(() => []);
        const profiles = Array.isArray(brandData) ? (brandData as BrandProfile[]) : [];
        return profiles.find((p) => p.is_default) || profiles[0] || null;
    };

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const response = await fetch('/api/account');
                if (response.status === 401) {
                    router.push('/auth/login');
                    return;
                }

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data?.error || 'Failed to load account');
                }

                if (cancelled) return;
                setAccount(data.account as Account);

                const nextActiveOrg = (data.activeOrganization || null) as Organization | null;
                setActiveOrganization(nextActiveOrg);

                // Pre-fill contact info from account
                if (data.account?.full_name) setContactName(data.account.full_name);
                if (data.account?.email) setContactEmail(data.account.email);
                if (data.account?.phone) setContactPhone(data.account.phone);

                // If already has organization, skip to step 2 or redirect
                if (data.activeOrganization || data.account?.active_organization_id) {
                    setOrganizationCreated(true);
                    if (nextActiveOrg?.name) {
                        setOrgName(nextActiveOrg.name);
                        setBrandName(nextActiveOrg.name);
                    }

                    const defaultProfile = await fetchDefaultBrandProfile();
                    if (defaultProfile) {
                        setBrandProfileId(defaultProfile.id);
                        setBrandProfileCreated(true);
                        setBrandName(defaultProfile.name);
                        if (defaultProfile.primary_color) setPrimaryColor(defaultProfile.primary_color);
                        if (defaultProfile.logo_url) setLogoUrl(defaultProfile.logo_url);

                        if (defaultProfile.contact_name) setContactName(defaultProfile.contact_name);
                        if (defaultProfile.contact_email) setContactEmail(defaultProfile.contact_email);
                        if (defaultProfile.contact_phone) setContactPhone(defaultProfile.contact_phone);
                        if (defaultProfile.contact_website) setContactWebsite(defaultProfile.contact_website);

                        if (
                            defaultProfile.contact_name ||
                            defaultProfile.contact_email ||
                            defaultProfile.contact_phone ||
                            defaultProfile.contact_website
                        ) {
                            setContactInfoSaved(true);
                        }
                    }

                    setStep(2);
                }
            } catch (error) {
                console.error(error);
                toast.error('Failed to load your account. Please try again.');
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [router]);

    const handleCreateOrg = async () => {
        const name = orgName.trim();
        if (!name) return;
        if (!account) {
            toast.error('Please wait for your account to load, then try again.');
            return;
        }

        setLoading(true);
        try {
            const isUpdate = Boolean(activeOrganization?.id);
            const response = await fetch('/api/onboarding/organization', {
                method: isUpdate ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to create organization');
            }

            setActiveOrganization(data.organization as Organization);
            setOrganizationCreated(true);
            if (!brandNameTouched || brandName.trim().length === 0) {
                setBrandName(name);
            }
            setStep(2);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to create organization');
        } finally {
            setLoading(false);
        }
    };

    const ensureBrandProfileId = async (): Promise<string | null> => {
        if (brandProfileId) return brandProfileId;

        const defaultProfile = await fetchDefaultBrandProfile();
        if (!defaultProfile) return null;

        setBrandProfileId(defaultProfile.id);
        setBrandProfileCreated(true);
        return defaultProfile.id;
    };

    const handleCreateBrand = async () => {
        if (!account) {
            toast.error('Please wait for your account to load, then try again.');
            return;
        }

        const resolvedBrandName = (brandName || orgName).trim();
        if (resolvedBrandName.length < 2) {
            toast.error('Please enter a brand name');
            return;
        }

        setLoading(true);
        try {
            const profileId = await ensureBrandProfileId();
            if (!profileId) {
                throw new Error('Unable to save branding details. Please try again.');
            }

            const response = await fetch(`/api/branding/${profileId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: resolvedBrandName,
                    primary_color: primaryColor,
                    secondary_color: secondaryColor,
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to update brand profile');
            }

            setBrandProfileId((data as BrandProfile).id);
            setBrandProfileCreated(true);
            setStep(3);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to create brand profile');
        } finally {
            setLoading(false);
        }
    };

    const handleSkipBranding = async () => {
        setLoading(true);
        try {
            const defaultProfile = await fetchDefaultBrandProfile();
            if (!defaultProfile) {
                throw new Error('Unable to continue. Please try again.');
            }

            setBrandProfileId(defaultProfile.id);
            setBrandProfileCreated(true);
            setBrandName(defaultProfile.name || '');
            if (defaultProfile.primary_color) setPrimaryColor(defaultProfile.primary_color);
            if (defaultProfile.logo_url) setLogoUrl(defaultProfile.logo_url);

            if (defaultProfile.contact_name) setContactName(defaultProfile.contact_name);
            if (defaultProfile.contact_email) setContactEmail(defaultProfile.contact_email);
            if (defaultProfile.contact_phone) setContactPhone(defaultProfile.contact_phone);
            if (defaultProfile.contact_website) setContactWebsite(defaultProfile.contact_website);

            setStep(3);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to continue');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveContactInfo = async () => {
        if (!account) {
            toast.error('Please wait for your account to load, then try again.');
            return;
        }

        setLoading(true);
        try {
            const profileId = brandProfileId || (await ensureBrandProfileId());
            if (!profileId) {
                throw new Error('Unable to save branding details. Please try again.');
            }

            const normalizedWebsite = contactWebsite.trim()
                ? contactWebsite.trim().startsWith('http://') || contactWebsite.trim().startsWith('https://')
                    ? contactWebsite.trim()
                    : `https://${contactWebsite.trim()}`
                : undefined;

            const response = await fetch(`/api/branding/${profileId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: (brandName || orgName).trim() || undefined,
                    primary_color: primaryColor,
                    secondary_color: secondaryColor,
                    contact_name: contactName.trim() || undefined,
                    contact_phone: contactPhone.trim() || undefined,
                    contact_email: contactEmail.trim() || undefined,
                    contact_website: normalizedWebsite,
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to save contact information');
            }

            setContactInfoSaved(true);
            setStep(4);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to save contact information');
        } finally {
            setLoading(false);
        }
    };

    const completeOnboarding = async () => {
        const response = await fetch('/api/onboarding/complete', { method: 'POST' });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error || 'Failed to mark onboarding complete');
        }
    };

    const handleStartFirstRequest = async () => {
        setLoading(true);
        try {
            await completeOnboarding();
            router.push('/dashboard/requests/new?onboarding=1');
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to continue');
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = async () => {
        setLoading(true);
        try {
            await completeOnboarding();
            router.push('/dashboard');
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to finish onboarding');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const isStepComplete = (id: number) => {
        switch (id) {
            case 1: return organizationCreated;
            case 2: return brandProfileCreated;
            case 3: return contactInfoSaved;
            case 4: return step > 4;
            default: return false;
        }
    };

    const stepVariants = {
        enter: { x: 40, opacity: 0 },
        center: { x: 0, opacity: 1 },
        exit: { x: -40, opacity: 0 },
    };

    const displayName = account?.full_name?.split(' ')[0] || '';

    if (!account && step !== 1) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 sm:p-6 relative overflow-hidden">
            {/* Ambient background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-slate-500/4 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-emerald-500/4 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 w-full max-w-lg">
                {/* Logo header */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <Image src="/logo-sm.png" alt="UtilitySheet" width={28} height={28} className="h-7 w-7" />
                    <span className="text-xl font-bold text-foreground tracking-tight">UtilitySheet</span>
                </div>

                {/* Step progress */}
                <div className="mb-8">
                    <div className="flex items-center justify-center gap-0 mb-4">
                        {STEPS.map((s, index) => (
                            <div key={s.id} className="flex items-center">
                                <button
                                    type="button"
                                    onClick={() => s.id <= step && setStep(s.id)}
                                    disabled={s.id > step}
                                    aria-label={`Go to ${s.title}`}
                                    aria-current={step === s.id ? 'step' : undefined}
                                    className={cn(
                                        'relative flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold transition-all duration-300',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                        step === s.id
                                            ? 'bg-slate-700 text-white shadow-lg shadow-slate-500/25 scale-110'
                                            : isStepComplete(s.id)
                                            ? 'bg-slate-600 text-white'
                                            : 'bg-muted text-muted-foreground',
                                        s.id > step ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-90',
                                    )}
                                >
                                    {isStepComplete(s.id) && step !== s.id ? (
                                        <Check className="h-4 w-4" />
                                    ) : (
                                        s.id
                                    )}
                                </button>
                                {index < STEPS.length - 1 && (
                                    <div
                                        className={cn(
                                            'w-10 h-px transition-all duration-500',
                                            isStepComplete(s.id) ? 'bg-slate-600' : 'bg-border',
                                        )}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-foreground">{STEPS[step - 1].title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Step {step} of {STEPS.length} — {STEPS[step - 1].description}
                        </p>
                    </div>
                </div>

                {/* Step content */}
                <AnimatePresence mode="wait">

                    {/* ─── STEP 1: Welcome & Workspace Setup ─── */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            variants={stepVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                        >
                            <Card className="border-border bg-card/90 backdrop-blur-xl shadow-xl">
                                <CardHeader className="text-center pb-4 pt-6 px-6">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4 shadow-inner">
                                        <Sparkles className="h-7 w-7 text-slate-500" />
                                    </div>
                                    <h1 className="text-2xl font-bold text-foreground leading-tight">
                                        {displayName ? `Welcome, ${displayName}!` : 'Welcome to UtilitySheet!'}
                                    </h1>
                                    <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
                                        Let&apos;s get your workspace set up. Here&apos;s how the whole thing works:
                                    </p>
                                </CardHeader>

                                <CardContent className="px-6 pb-4 space-y-5">
                                    {/* How it works */}
                                    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                                        <div className="px-4 py-2.5 border-b border-border">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">How It Works</p>
                                        </div>
                                        <div className="divide-y divide-border/60">
                                            <div className="flex items-start gap-3 px-4 py-3">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">You create a request</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">Enter an address and select which utilities to include.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 px-4 py-3">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">Seller fills it in — no account needed</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">Share a link; they answer questions on any device in minutes.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 px-4 py-3">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">Your branded PDF is ready to share</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">A professional utility info sheet for buyers — with your name on it.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Org name */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="orgName" className="text-sm font-medium text-foreground">
                                            {organizationCreated ? 'Organization Name' : 'What\'s your organization or team name?'}
                                        </Label>
                                        <Input
                                            id="orgName"
                                            placeholder="e.g. Smith Realty, The Evergreen Group"
                                            value={orgName}
                                            onChange={(e) => setOrgName(e.target.value)}
                                            autoComplete="organization"
                                            autoFocus
                                            className="h-11 text-base bg-background border-input"
                                            onKeyDown={(e) => e.key === 'Enter' && orgName.trim() && handleCreateOrg()}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            This is how your team is identified in the system. You can change it later.
                                        </p>
                                    </div>
                                </CardContent>

                                <CardFooter className="px-6 pb-6 flex flex-col gap-3">
                                    <Button
                                        onClick={handleCreateOrg}
                                        disabled={!orgName.trim() || loading}
                                        className="w-full h-11 bg-slate-700 hover:bg-slate-800 text-white font-medium text-sm active:scale-[0.98] transition-transform"
                                    >
                                        {loading ? (
                                            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
                                        ) : (
                                            <>{organizationCreated ? 'Save & Continue' : 'Get Started'} <ArrowRight className="ml-2 h-4 w-4" /></>
                                        )}
                                    </Button>
                                    <button
                                        type="button"
                                        onClick={handleFinish}
                                        disabled={loading}
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 disabled:opacity-50"
                                    >
                                        Skip setup and go straight to dashboard
                                    </button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* ─── STEP 2: Branding ─── */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            variants={stepVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                        >
                            <Card className="border-border bg-card/90 backdrop-blur-xl shadow-xl">
                                <CardHeader className="pb-4 pt-6 px-6">
                                    <div className="w-11 h-11 rounded-xl bg-slate-500/10 flex items-center justify-center mb-3">
                                        <Palette className="h-5 w-5 text-slate-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-foreground">Make It Yours</h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Your brand appears on every utility sheet you send to clients. A consistent look builds trust.
                                    </p>
                                </CardHeader>

                                <CardContent className="px-6 pb-4 space-y-5">
                                    {/* Brand name */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="brandName" className="text-sm font-medium text-foreground">Brand Display Name</Label>
                                        <Input
                                            id="brandName"
                                            value={brandName}
                                            onChange={(e) => {
                                                setBrandNameTouched(true);
                                                setBrandName(e.target.value);
                                            }}
                                            placeholder="e.g. The Evergreen Group"
                                            autoComplete="organization"
                                            autoFocus
                                            className="h-11 bg-background border-input text-foreground"
                                        />
                                        <p className="text-xs text-muted-foreground">This name appears on your PDF sheets and correspondence.</p>
                                    </div>

                                    {/* Color picker */}
                                    <div className="space-y-2.5">
                                        <Label className="text-sm font-medium text-foreground">Primary Brand Color</Label>
                                        <div className="flex flex-wrap gap-2.5">
                                            {BRAND_COLORS.map((color) => (
                                                <button
                                                    key={color.value}
                                                    type="button"
                                                    onClick={() => setPrimaryColor(color.value)}
                                                    aria-label={`Select ${color.name}`}
                                                    aria-pressed={primaryColor === color.value}
                                                    className={cn(
                                                        'flex flex-col items-center gap-1 group focus-visible:outline-none',
                                                        'focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md',
                                                    )}
                                                >
                                                    <div
                                                        className={cn(
                                                            'w-10 h-10 rounded-lg border-2 transition-all duration-200',
                                                            primaryColor === color.value
                                                                ? 'border-foreground scale-110 shadow-md'
                                                                : 'border-transparent hover:scale-105 hover:border-border',
                                                        )}
                                                        style={{ backgroundColor: color.value }}
                                                    />
                                                    <span className={cn(
                                                        'text-[10px] font-medium transition-colors',
                                                        primaryColor === color.value ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
                                                    )}>
                                                        {color.name}
                                                    </span>
                                                </button>
                                            ))}
                                            {/* Custom color */}
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="relative">
                                                    <input
                                                        type="color"
                                                        value={primaryColor}
                                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                                        aria-label="Custom brand color"
                                                        className="peer absolute inset-0 w-10 h-10 opacity-0 cursor-pointer"
                                                    />
                                                    <div
                                                        className={cn(
                                                            'w-10 h-10 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-all duration-200',
                                                            !BRAND_COLORS.find((c) => c.value === primaryColor)
                                                                ? 'border-foreground scale-110 shadow-md'
                                                                : 'border-muted-foreground hover:border-foreground',
                                                        )}
                                                        style={
                                                            !BRAND_COLORS.find((c) => c.value === primaryColor)
                                                                ? { backgroundColor: primaryColor }
                                                                : {}
                                                        }
                                                    >
                                                        {BRAND_COLORS.find((c) => c.value === primaryColor) && (
                                                            <span className="text-muted-foreground text-sm font-medium">+</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-medium text-muted-foreground">Custom</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Live preview */}
                                    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                                        <div className="px-3 py-2 border-b border-border/60">
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</p>
                                        </div>
                                        <div className="p-4">
                                            <div className="h-1.5 w-full rounded-full mb-3" style={{ backgroundColor: primaryColor }} />
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold text-foreground text-sm">{brandName || 'Your Brand Name'}</p>
                                                    <p className="text-xs text-muted-foreground">Utility Information Sheet</p>
                                                </div>
                                                <div
                                                    className="w-8 h-8 rounded-lg opacity-20"
                                                    style={{ backgroundColor: primaryColor }}
                                                />
                                            </div>
                                            <div className="mt-3 grid grid-cols-3 gap-1.5">
                                                {[40, 65, 55].map((w, i) => (
                                                    <div key={i} className="h-1.5 rounded-full bg-muted" style={{ width: `${w}%` }} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>

                                <CardFooter className="px-6 pb-6 flex flex-col gap-2.5">
                                    <div className="flex gap-2.5 w-full">
                                        <Button
                                            variant="outline"
                                            onClick={handleBack}
                                            className="border-border text-foreground hover:bg-muted h-11 px-4"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            onClick={handleCreateBrand}
                                            disabled={loading}
                                            className="flex-1 bg-slate-700 hover:bg-slate-800 text-white h-11 font-medium active:scale-[0.98] transition-transform"
                                        >
                                            {loading ? (
                                                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
                                            ) : (
                                                <>Save & Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                                            )}
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 justify-center">
                                        <button
                                            type="button"
                                            onClick={handleSkipBranding}
                                            disabled={loading}
                                            className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 disabled:opacity-50"
                                        >
                                            Skip for now
                                        </button>
                                        <span className="text-xs text-muted-foreground">·</span>
                                        <button
                                            type="button"
                                            onClick={handleFinish}
                                            disabled={loading}
                                            className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 disabled:opacity-50"
                                        >
                                            Exit setup
                                        </button>
                                    </div>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* ─── STEP 3: Contact Info ─── */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            variants={stepVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                        >
                            <Card className="border-border bg-card/90 backdrop-blur-xl shadow-xl">
                                <CardHeader className="pb-4 pt-6 px-6">
                                    <div className="w-11 h-11 rounded-xl bg-slate-500/10 flex items-center justify-center mb-3">
                                        <User className="h-5 w-5 text-slate-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-foreground">Your Contact Details</h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        This information appears on every utility sheet so buyers and sellers can reach you directly.
                                    </p>
                                </CardHeader>

                                <CardContent className="px-6 pb-4 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="contactName" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                                <User className="h-3.5 w-3.5 text-muted-foreground" /> Your Name
                                            </Label>
                                            <Input
                                                id="contactName"
                                                value={contactName}
                                                onChange={(e) => {
                                                    setContactInfoSaved(false);
                                                    setContactName(e.target.value);
                                                }}
                                                autoComplete="name"
                                                autoFocus
                                                placeholder="Jane Smith"
                                                className="h-11 bg-background border-input text-foreground"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="contactPhone" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                                <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Phone
                                            </Label>
                                            <Input
                                                id="contactPhone"
                                                type="tel"
                                                value={contactPhone}
                                                onChange={(e) => {
                                                    setContactInfoSaved(false);
                                                    setContactPhone(e.target.value);
                                                }}
                                                autoComplete="tel"
                                                placeholder="(555) 123-4567"
                                                className="h-11 bg-background border-input text-foreground"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="contactEmail" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                            <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email
                                        </Label>
                                        <Input
                                            id="contactEmail"
                                            type="email"
                                            value={contactEmail}
                                            onChange={(e) => {
                                                setContactInfoSaved(false);
                                                setContactEmail(e.target.value);
                                            }}
                                            autoComplete="email"
                                            placeholder="jane@yourrealty.com"
                                            className="h-11 bg-background border-input text-foreground"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="contactWebsite" className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                                            Website <span className="text-muted-foreground font-normal">(optional)</span>
                                        </Label>
                                        <Input
                                            id="contactWebsite"
                                            type="url"
                                            value={contactWebsite}
                                            onChange={(e) => {
                                                setContactInfoSaved(false);
                                                setContactWebsite(e.target.value);
                                            }}
                                            autoComplete="url"
                                            placeholder="www.yourrealty.com"
                                            className="h-11 bg-background border-input text-foreground"
                                        />
                                    </div>

                                    {/* Tip */}
                                    <div className="flex items-start gap-2.5 rounded-lg bg-muted/40 border border-border/60 px-3.5 py-3">
                                        <FileText className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            <strong className="text-foreground">All of this can be changed anytime</strong> from your Settings page. You can also create multiple brand profiles for different teams or use cases.
                                        </p>
                                    </div>
                                </CardContent>

                                <CardFooter className="px-6 pb-6 flex flex-col gap-2.5">
                                    <div className="flex gap-2.5 w-full">
                                        <Button
                                            variant="outline"
                                            onClick={handleBack}
                                            className="border-border text-foreground hover:bg-muted h-11 px-4"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            onClick={handleSaveContactInfo}
                                            disabled={loading}
                                            className="flex-1 bg-slate-700 hover:bg-slate-800 text-white h-11 font-medium active:scale-[0.98] transition-transform"
                                        >
                                            {loading ? (
                                                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
                                            ) : (
                                                <>Save & Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                                            )}
                                        </Button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleFinish}
                                        disabled={loading}
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 disabled:opacity-50"
                                    >
                                        Exit setup and go to dashboard
                                    </button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* ─── STEP 4: Preview ─── */}
                    {step === 4 && (
                        <motion.div
                            key="step4"
                            variants={stepVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                        >
                            <Card className="border-border bg-card/90 backdrop-blur-xl shadow-xl">
                                <CardHeader className="pb-4 pt-6 px-6">
                                    <div className="w-11 h-11 rounded-xl bg-slate-500/10 flex items-center justify-center mb-3">
                                        <FileText className="h-5 w-5 text-slate-500" />
                                    </div>
                                    <h2 className="text-xl font-bold text-foreground">Here&apos;s What Buyers Will See</h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        This is a preview of your branded utility sheet — the document buyers receive after a seller submits their utility info.
                                    </p>
                                </CardHeader>

                                <CardContent className="px-6 pb-4">
                                    <UtilitySheetPdfPreview
                                        branding={{
                                            name: brandName || orgName || 'Your Brand',
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
                                    />
                                    <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-muted/40 border border-border/60 px-3.5 py-3">
                                        <Zap className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            <strong className="text-foreground">Looking good?</strong> You can refine your branding anytime from Settings. Upgrades to Pro unlock logo uploads and custom colors.
                                        </p>
                                    </div>
                                </CardContent>

                                <CardFooter className="px-6 pb-6 flex flex-col gap-2.5">
                                    <div className="flex gap-2.5 w-full">
                                        <Button
                                            variant="outline"
                                            onClick={handleBack}
                                            className="border-border text-foreground hover:bg-muted h-11 px-4"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            onClick={() => setStep(5)}
                                            className="flex-1 bg-slate-700 hover:bg-slate-800 text-white h-11 font-medium active:scale-[0.98] transition-transform"
                                        >
                                            Looks great! <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleFinish}
                                        disabled={loading}
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 disabled:opacity-50"
                                    >
                                        Exit setup and go to dashboard
                                    </button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* ─── STEP 5: Launch ─── */}
                    {step === 5 && (
                        <motion.div
                            key="step5"
                            variants={stepVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                        >
                            <Card className="border-border bg-card/90 backdrop-blur-xl shadow-xl">
                                <CardHeader className="text-center pb-4 pt-6 px-6">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-slate-500/20 flex items-center justify-center mx-auto mb-4 shadow-inner">
                                        <motion.div
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                                        >
                                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                        </motion.div>
                                    </div>
                                    <h2 className="text-2xl font-bold text-foreground">You&apos;re all set!</h2>
                                    <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
                                        Your workspace is ready. Here&apos;s a quick look at what you&apos;ve got and how to make the most of it.
                                    </p>
                                </CardHeader>

                                <CardContent className="px-6 pb-4 space-y-4">
                                    {/* Setup summary */}
                                    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                                        <div className="px-4 py-2.5 border-b border-border">
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Setup Complete</p>
                                        </div>
                                        <div className="divide-y divide-border/60">
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.15 }}
                                                className="flex items-center gap-3 px-4 py-2.5"
                                            >
                                                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="text-sm text-foreground flex-1">{orgName || 'Organization'}</span>
                                                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                                            </motion.div>
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.25 }}
                                                className="flex items-center gap-3 px-4 py-2.5"
                                            >
                                                <Palette className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="text-sm text-foreground flex-1">Brand profile</span>
                                                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                                            </motion.div>
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.35 }}
                                                className="flex items-center gap-3 px-4 py-2.5"
                                            >
                                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="text-sm text-foreground flex-1">Contact information</span>
                                                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                                            </motion.div>
                                        </div>
                                    </div>

                                    {/* Reusable intake link — the star feature */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.4 }}
                                        className="rounded-xl border border-border bg-muted/20 overflow-hidden"
                                    >
                                        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                                            <LinkIcon className="h-3.5 w-3.5 text-slate-500" />
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Your Reusable Intake Link</p>
                                        </div>
                                        <div className="px-4 py-3.5 space-y-3">
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                This is a <strong className="text-foreground">permanent link</strong> you can share anywhere — email signatures, websites, listing descriptions. Sellers use it to submit utility info for any property, at any time, without you needing to create a request first.
                                            </p>

                                            {intakeLinkLoading ? (
                                                <div className="flex items-center gap-2 h-10">
                                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                    <span className="text-sm text-muted-foreground">Loading your link...</span>
                                                </div>
                                            ) : intakeLink?.url ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2">
                                                        <p className="text-xs font-mono text-foreground truncate">{intakeLink.url}</p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={handleCopyLink}
                                                        className={cn(
                                                            'shrink-0 border-border h-9 px-3 transition-colors',
                                                            copied && 'border-emerald-500/50 text-emerald-500',
                                                        )}
                                                    >
                                                        {copied ? (
                                                            <><Check className="h-3.5 w-3.5 mr-1.5" />Copied!</>
                                                        ) : (
                                                            <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</>
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">Your intake link will be available in Settings once your account is fully activated.</p>
                                            )}

                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { label: 'Email signature', icon: Mail },
                                                    { label: 'Listing sheets', icon: FileText },
                                                    { label: 'Your website', icon: Globe },
                                                ].map(({ label, icon: Icon }) => (
                                                    <div key={label} className="flex flex-col items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-2.5 text-center">
                                                        <Icon className="h-4 w-4 text-slate-500" />
                                                        <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                </CardContent>

                                <CardFooter className="px-6 pb-6 flex flex-col gap-2.5">
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5 }}
                                        className="w-full flex flex-col gap-2.5"
                                    >
                                        <Button
                                            onClick={handleStartFirstRequest}
                                            disabled={loading}
                                            className="w-full h-12 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-semibold text-sm shadow-lg shadow-slate-500/20 active:scale-[0.98] transition-transform"
                                        >
                                            {loading ? (
                                                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading...</>
                                            ) : (
                                                <><Send className="mr-2 h-4 w-4" />Create My First Request</>
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={handleFinish}
                                            disabled={loading}
                                            className="w-full h-10 border-border text-foreground hover:bg-muted font-medium"
                                        >
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Go to Dashboard
                                        </Button>
                                    </motion.div>
                                    <p className="text-center text-xs text-muted-foreground pt-1">
                                        Your first request won&apos;t count against your monthly limit.
                                    </p>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                </AnimatePresence>

                {/* Bottom escape hatch (steps 2–4 only, very subtle) */}
                {step >= 2 && step <= 4 && (
                    <p className="text-center text-xs text-muted-foreground/60 mt-5">
                        All settings can be changed later from your{' '}
                        <button
                            type="button"
                            onClick={handleFinish}
                            className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
                        >
                            dashboard
                        </button>
                        .
                    </p>
                )}
            </div>
        </div>
    );
}
