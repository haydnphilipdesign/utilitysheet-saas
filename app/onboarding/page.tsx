'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
    Eye,
    Send,
    FileText
} from 'lucide-react';
import { toast } from 'sonner';
import UtilitySheetPdfPreview from '@/components/branding/UtilitySheetPdfPreview';
import type { Account, BrandProfile, Organization } from '@/types';

// Steps configuration
const STEPS = [
    { id: 1, title: 'Welcome', icon: Sparkles },
    { id: 2, title: 'Branding', icon: Palette },
    { id: 3, title: 'Contact Info', icon: User },
    { id: 4, title: 'Preview', icon: Eye },
    { id: 5, title: 'Get Started', icon: Send },
];

// Pre-defined colors for brand selection
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

                    // Load existing (or auto-created) default brand profile so onboarding edits it instead of creating duplicates
                    const brandRes = await fetch('/api/branding');
                    if (brandRes.ok) {
                        const brandData = await brandRes.json().catch(() => []);
                        const profiles = Array.isArray(brandData) ? (brandData as BrandProfile[]) : [];
                        const defaultProfile = profiles.find((p) => p.is_default) || profiles[0];

                        if (defaultProfile) {
                            setBrandProfileId(defaultProfile.id);
                            setBrandProfileCreated(true);
                            setBrandName(defaultProfile.name);
                            if (defaultProfile.primary_color) setPrimaryColor(defaultProfile.primary_color);
                            if (defaultProfile.logo_url) setLogoUrl(defaultProfile.logo_url);

                            // Prefer saved brand profile contact info (if present)
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
                    }

                    // Start at step 2 when an org already exists
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
                setBrandName(name); // Default brand name to org name
            }
            setStep(2);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to create organization');
        } finally {
            setLoading(false);
        }
    };

    const ensureBrandProfile = async () => {
        if (brandProfileId) return brandProfileId;

        const response = await fetch('/api/branding');
        if (!response.ok) return null;

        const brandData = await response.json().catch(() => []);
        const profiles = Array.isArray(brandData) ? (brandData as BrandProfile[]) : [];
        const defaultProfile = profiles.find((p) => p.is_default) || profiles[0];
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
            if (brandProfileId) {
                const response = await fetch(`/api/branding/${brandProfileId}`, {
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
            } else {
                const response = await fetch('/api/onboarding/brand-profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: resolvedBrandName,
                        primaryColor,
                        secondaryColor,
                    }),
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data?.error || 'Failed to create brand profile');
                }

                setBrandProfileId((data.profile as BrandProfile).id);
            }

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
        if (brandProfileCreated) {
            setStep(3);
            return;
        }

        await handleCreateBrand();
    };

    const handleSaveContactInfo = async () => {
        if (!account) {
            toast.error('Please wait for your account to load, then try again.');
            return;
        }

        setLoading(true);
        try {
            const profileId = brandProfileId || (await ensureBrandProfile());
            if (!profileId) {
                throw new Error('Unable to save branding details. Please try again.');
            }

            const normalizedWebsite = contactWebsite.trim()
                ? (contactWebsite.trim().startsWith('http://') || contactWebsite.trim().startsWith('https://')
                    ? contactWebsite.trim()
                    : `https://${contactWebsite.trim()}`)
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
        if (step > 1) {
            setStep(step - 1);
        }
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 50 : -50,
            opacity: 0
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 50 : -50,
            opacity: 0
        })
    };

    const isStepComplete = (id: number) => {
        switch (id) {
            case 1:
                return organizationCreated;
            case 2:
                return brandProfileCreated;
            case 3:
                return contactInfoSaved;
            case 4:
                return step > 4;
            default:
                return false;
        }
    };

    if (!account && step !== 1) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-slate-500/5 rounded-full blur-[150px]" />
                <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-2xl">
                {/* Header */}
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-6">
                    <Image src="/logo-sm.png" alt="UtilitySheet Logo" width={24} height={24} className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span className="text-lg sm:text-xl font-bold text-foreground">UtilitySheet</span>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-1 sm:gap-2 mb-6 sm:mb-8 px-2">
                    {STEPS.map((s, index) => (
                        <div key={s.id} className="flex items-center">
                            <button
                                type="button"
                                onClick={() => setStep(s.id)}
                                disabled={s.id > step}
                                aria-label={`Go to ${s.title}`}
                                aria-current={step === s.id ? 'step' : undefined}
                                className={`
                                    flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all duration-300
                                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background
                                    ${isStepComplete(s.id) || step === s.id
                                        ? 'bg-slate-600 text-white'
                                        : 'bg-muted text-muted-foreground'
                                    }
                                    ${step === s.id ? 'ring-2 ring-slate-400 ring-offset-2 ring-offset-background' : ''}
                                    ${s.id > step ? 'cursor-not-allowed' : 'cursor-pointer'}
                                `}
                            >
                                {isStepComplete(s.id) && step !== s.id ? (
                                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                                ) : (
                                    <s.icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                                )}
                            </button>
                            {index < STEPS.length - 1 && (
                                <div
                                    className={`w-4 sm:w-8 h-0.5 mx-0.5 sm:mx-1 transition-all duration-300 ${isStepComplete(s.id) ? 'bg-slate-600' : 'bg-muted'
                                        }`}
                                />
                            )}
                        </div>
                    ))}
                </div>

                <AnimatePresence mode="wait" custom={step}>
                    {/* Step 1: Welcome & Organization */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            custom={1}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="border-border bg-card/80 backdrop-blur-xl">
                                <CardHeader className="text-center px-4 sm:px-6 pt-4 sm:pt-6">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-slate-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                                        <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-slate-500" />
                                    </div>
                                    <CardTitle className="text-xl sm:text-2xl text-foreground">
                                        {organizationCreated ? 'Organization Details' : 'Welcome to UtilitySheet!'}
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground text-sm sm:text-base">
                                        {organizationCreated
                                            ? "Update your organization name. You can change this later in settings, too."
                                            : "Let's get you set up in just a few minutes. First, tell us about your business."
                                        }
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
                                    <div className="space-y-1.5 sm:space-y-2">
                                        <Label htmlFor="orgName" className="text-foreground text-sm">Organization or Team Name</Label>
                                        <Input
                                            id="orgName"
                                            placeholder="e.g. The Evergreen Group, Smith Realty"
                                            value={orgName}
                                            onChange={(e) => setOrgName(e.target.value)}
                                            autoComplete="organization"
                                            autoFocus
                                            className="bg-background border-input text-foreground placeholder:text-muted-foreground h-11 sm:h-12 text-base"
                                            onKeyDown={(e) => e.key === 'Enter' && orgName && handleCreateOrg()}
                                        />
                                        <p className="text-xs sm:text-sm text-muted-foreground">
                                            This is how your team will be identified in the system.
                                        </p>
                                    </div>
                                </CardContent>
                                <CardFooter className="px-4 sm:px-6 pb-4 sm:pb-6">
                                    <Button
                                        onClick={handleCreateOrg}
                                        disabled={!orgName || loading}
                                        className="w-full bg-slate-600 hover:bg-slate-700 text-white h-11 sm:h-12 text-sm sm:text-base active:scale-[0.98]"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                                                <span className="ml-2">Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                {organizationCreated ? 'Save & Continue' : 'Continue'}
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </>
                                        )}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* Step 2: Branding Basics */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            custom={1}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="border-border bg-card/80 backdrop-blur-xl">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-xl bg-slate-500/10 flex items-center justify-center mb-4">
                                        <Palette className="h-6 w-6 text-slate-600" />
                                    </div>
                                    <CardTitle className="text-2xl text-foreground">Brand Your Utility Sheets</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Your clients will see this branding when they receive utility info sheets.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="brandName" className="text-foreground">Brand Display Name</Label>
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
                                            className="bg-background border-input text-foreground h-12"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-foreground">Primary Brand Color</Label>
                                        <div className="flex flex-wrap gap-3">
                                            {BRAND_COLORS.map((color) => (
                                                <button
                                                    key={color.value}
                                                    type="button"
                                                    onClick={() => setPrimaryColor(color.value)}
                                                    aria-label={`Select ${color.name} as your brand color`}
                                                    aria-pressed={primaryColor === color.value}
                                                    className={`
                                                        w-12 h-12 rounded-xl border-2 transition-all duration-200
                                                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background
                                                        ${primaryColor === color.value
                                                            ? 'border-foreground scale-110 shadow-lg'
                                                            : 'border-transparent hover:scale-105'
                                                        }
                                                    `}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.name}
                                                />
                                            ))}
                                            <div className="relative">
                                                <input
                                                    type="color"
                                                    value={primaryColor}
                                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                                    aria-label="Choose a custom brand color"
                                                    className="peer absolute inset-0 w-12 h-12 opacity-0 cursor-pointer"
                                                />
                                                <div
                                                    className="w-12 h-12 rounded-xl border-2 border-dashed border-muted-foreground flex items-center justify-center cursor-pointer hover:border-foreground transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-slate-400/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
                                                    style={!BRAND_COLORS.find(c => c.value === primaryColor) ? { backgroundColor: primaryColor } : {}}
                                                >
                                                    {BRAND_COLORS.find(c => c.value === primaryColor) && (
                                                        <span className="text-muted-foreground text-xs">+</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Preview Card */}
                                    <div className="p-4 rounded-xl border border-border bg-muted/30">
                                        <p className="text-xs text-muted-foreground mb-2">Preview</p>
                                        <div
                                            className="h-2 w-full rounded-full mb-3"
                                            style={{ backgroundColor: primaryColor }}
                                        />
                                        <p className="font-semibold text-foreground">{brandName || 'Your Brand Name'}</p>
                                        <p className="text-sm text-muted-foreground">Utility Information Sheet</p>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col gap-3">
                                    <div className="flex flex-col sm:flex-row gap-3 w-full">
                                        <Button
                                            variant="outline"
                                            onClick={handleBack}
                                            className="w-full sm:w-auto border-border text-foreground hover:bg-muted"
                                        >
                                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                        </Button>
                                        <Button
                                            onClick={handleCreateBrand}
                                            disabled={loading}
                                            className="w-full sm:flex-1 bg-slate-600 hover:bg-slate-700 text-white h-12"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                    <span className="ml-2">Saving...</span>
                                                </>
                                            ) : (
                                                <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                                            )}
                                        </Button>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        onClick={handleSkipBranding}
                                        className="w-full text-muted-foreground hover:text-foreground"
                                        disabled={loading}
                                    >
                                        Skip for now
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* Step 3: Contact Info */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            custom={1}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="border-border bg-card/80 backdrop-blur-xl">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-xl bg-slate-500/10 flex items-center justify-center mb-4">
                                        <User className="h-6 w-6 text-slate-600" />
                                    </div>
                                    <CardTitle className="text-2xl text-foreground">Contact Information</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        This info appears on your utility sheets so buyers know how to reach you.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="contactName" className="text-foreground flex items-center gap-2">
                                                <User className="h-4 w-4" /> Name
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
                                                placeholder="John Smith"
                                                className="bg-background border-input text-foreground"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="contactPhone" className="text-foreground flex items-center gap-2">
                                                <Phone className="h-4 w-4" /> Phone
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
                                                className="bg-background border-input text-foreground"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="contactEmail" className="text-foreground flex items-center gap-2">
                                            <Mail className="h-4 w-4" /> Email
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
                                            placeholder="john@example.com"
                                            className="bg-background border-input text-foreground"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="contactWebsite" className="text-foreground flex items-center gap-2">
                                            <Globe className="h-4 w-4" /> Website (optional)
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
                                            placeholder="www.yoursite.com"
                                            className="bg-background border-input text-foreground"
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col sm:flex-row gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={handleBack}
                                        className="w-full sm:w-auto border-border text-foreground hover:bg-muted"
                                    >
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                    </Button>
                                    <Button
                                        onClick={handleSaveContactInfo}
                                        disabled={loading}
                                        className="w-full sm:flex-1 bg-slate-600 hover:bg-slate-700 text-white h-12"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                <span className="ml-2">Saving...</span>
                                            </>
                                        ) : (
                                            <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                                        )}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* Step 4: Preview */}
                    {step === 4 && (
                        <motion.div
                            key="step4"
                            custom={1}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="border-border bg-card/80 backdrop-blur-xl">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-xl bg-slate-500/10 flex items-center justify-center mb-4">
                                        <Eye className="h-6 w-6 text-slate-600" />
                                    </div>
                                    <CardTitle className="text-2xl text-foreground">Here's What Buyers Will See</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        This is a preview of your branded utility info sheet.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
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
                                </CardContent>
                                <CardFooter className="flex flex-col sm:flex-row gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={handleBack}
                                        className="w-full sm:w-auto border-border text-foreground hover:bg-muted"
                                    >
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Edit
                                    </Button>
                                    <Button
                                        onClick={() => setStep(5)}
                                        className="w-full sm:flex-1 bg-slate-600 hover:bg-slate-700 text-white h-12"
                                    >
                                        Looks Great! <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* Step 5: First Request + Finish */}
                    {step === 5 && (
                        <motion.div
                            key="step5"
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="border-border bg-card/80 backdrop-blur-xl">
                                <CardHeader className="text-center">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                                        <Send className="h-10 w-10 text-slate-600" />
                                    </div>
                                    <CardTitle className="text-3xl text-foreground">Create Your First Request</CardTitle>
                                    <CardDescription className="text-muted-foreground text-base">
                                        Walk through the exact &quot;New Request&quot; flow once. Your first request won&apos;t count against your monthly limit.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="p-4 rounded-xl border border-border bg-muted/30 mb-2">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-emerald-500/10">
                                                <FileText className="h-5 w-5 text-emerald-500" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">Guided &quot;New Request&quot;</p>
                                                <p className="text-sm text-muted-foreground">
                                                    You&apos;ll enter an address, pick utilities, optionally add seller info, and get a shareable link.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col gap-3">
                                    <Button
                                        onClick={handleStartFirstRequest}
                                        disabled={loading}
                                        className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white h-14 text-lg font-semibold shadow-lg shadow-slate-500/20"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                <span className="ml-2">Loading...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send className="mr-2 h-5 w-5" />
                                                Walk Through New Request
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={handleFinish}
                                        disabled={loading}
                                        className="w-full text-muted-foreground hover:text-foreground"
                                    >
                                        Skip and go to dashboard
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Step indicator text */}
                <p className="text-center text-xs sm:text-sm text-muted-foreground mt-4 sm:mt-6">
                    Step {step} of {STEPS.length}: {STEPS[step - 1].title}
                </p>
            </div>
        </div>
    );
}
