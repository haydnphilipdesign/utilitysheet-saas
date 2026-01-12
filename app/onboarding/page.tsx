'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Zap,
    Building2,
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
    Upload,
    Eye,
    Send,
    FileText,
    PartyPopper
} from 'lucide-react';
import { toast } from 'sonner';
import UtilitySheetPdfPreview from '@/components/branding/UtilitySheetPdfPreview';

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

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [account, setAccount] = useState<any>(null);
    const [organizationCreated, setOrganizationCreated] = useState(false);
    const [brandProfileCreated, setBrandProfileCreated] = useState(false);
    const [demoRequestCreated, setDemoRequestCreated] = useState(false);

    // Form states
    const [orgName, setOrgName] = useState('');
    const [brandName, setBrandName] = useState('');
    const [primaryColor, setPrimaryColor] = useState('#10b981');
    const [secondaryColor, setSecondaryColor] = useState('#059669');
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactWebsite, setContactWebsite] = useState('');
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                setAccount(data.account);

                // Pre-fill contact info from account
                if (data.account?.full_name) setContactName(data.account.full_name);
                if (data.account?.email) setContactEmail(data.account.email);
                if (data.account?.phone) setContactPhone(data.account.phone);

                // If already has organization, skip to step 2 or redirect
                if (data.activeOrganization || data.account?.active_organization_id) {
                    setOrganizationCreated(true);
                    // Check if they have a brand profile - if so, redirect to dashboard
                    const brandRes = await fetch('/api/branding');
                    if (brandRes.ok) {
                        const brandData = await brandRes.json();
                        if (brandData.profiles?.length > 0) {
                            router.push('/dashboard');
                            return;
                        }
                    }
                    // No brand profile, start at step 2
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
            const response = await fetch('/api/onboarding/organization', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to create organization');
            }

            setOrganizationCreated(true);
            setBrandName(name); // Default brand name to org name
            setStep(2);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to create organization');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBrand = async () => {
        if (!account) {
            toast.error('Please wait for your account to load, then try again.');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/onboarding/brand-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: (brandName || orgName).trim(),
                    primaryColor,
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to create brand profile');
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

    const handleSaveContactInfo = async () => {
        // Save contact info to the brand profile
        setLoading(true);
        try {
            // For now, we'll skip this API call since we're in onboarding
            // The user can update this later in settings
            setStep(4);
        } catch (error) {
            console.error(error);
            toast.error('Failed to save contact information');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDemoRequest = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/onboarding/demo-request', {
                method: 'POST',
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to create demo request');
            }

            setDemoRequestCreated(true);
            toast.success('Demo request created! Check your dashboard to see it.');
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to create demo request');
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = () => {
        router.push('/dashboard');
    };

    const handleBack = () => {
        if (step > 1) {
            // Skip step 1 if org already created
            if (step === 2 && organizationCreated) return;
            setStep(step - 1);
        }
    };

    const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error('File size must be less than 2MB');
            return;
        }

        setLogoFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            setLogoPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
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
                <div className="flex items-center justify-center gap-2 mb-6">
                    <img src="/logo-sm.png" alt="UtilitySheet Logo" className="h-6 w-6" />
                    <span className="text-xl font-bold text-foreground">UtilitySheet</span>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {STEPS.map((s, index) => (
                        <div key={s.id} className="flex items-center">
                            <div
                                className={`
                                    flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300
                                    ${step >= s.id
                                        ? 'bg-slate-600 text-white'
                                        : 'bg-muted text-muted-foreground'
                                    }
                                    ${step === s.id ? 'ring-2 ring-slate-400 ring-offset-2 ring-offset-background' : ''}
                                `}
                            >
                                {step > s.id ? (
                                    <CheckCircle2 className="h-5 w-5" />
                                ) : (
                                    <s.icon className="h-5 w-5" />
                                )}
                            </div>
                            {index < STEPS.length - 1 && (
                                <div
                                    className={`w-8 h-0.5 mx-1 transition-all duration-300 ${step > s.id ? 'bg-slate-600' : 'bg-muted'
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
                                <CardHeader className="text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                                        <Sparkles className="h-8 w-8 text-slate-500" />
                                    </div>
                                    <CardTitle className="text-2xl text-foreground">Welcome to UtilitySheet!</CardTitle>
                                    <CardDescription className="text-muted-foreground text-base">
                                        Let's get you set up in just a few minutes. First, tell us about your business.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="orgName" className="text-foreground">Organization or Team Name</Label>
                                        <Input
                                            id="orgName"
                                            placeholder="e.g. The Evergreen Group, Smith Realty"
                                            value={orgName}
                                            onChange={(e) => setOrgName(e.target.value)}
                                            className="bg-background border-input text-foreground placeholder:text-muted-foreground h-12"
                                            onKeyDown={(e) => e.key === 'Enter' && orgName && handleCreateOrg()}
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            This is how your team will be identified in the system.
                                        </p>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        onClick={handleCreateOrg}
                                        disabled={!orgName || loading}
                                        className="w-full bg-slate-600 hover:bg-slate-700 text-white h-12"
                                    >
                                        {loading ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
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
                                            onChange={(e) => setBrandName(e.target.value)}
                                            placeholder="e.g. The Evergreen Group"
                                            className="bg-background border-input text-foreground h-12"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-foreground">Primary Brand Color</Label>
                                        <div className="flex flex-wrap gap-3">
                                            {BRAND_COLORS.map((color) => (
                                                <button
                                                    key={color.value}
                                                    onClick={() => setPrimaryColor(color.value)}
                                                    className={`
                                                        w-12 h-12 rounded-xl border-2 transition-all duration-200
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
                                                    className="absolute inset-0 w-12 h-12 opacity-0 cursor-pointer"
                                                />
                                                <div
                                                    className="w-12 h-12 rounded-xl border-2 border-dashed border-muted-foreground flex items-center justify-center cursor-pointer hover:border-foreground transition-colors"
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
                                <CardFooter className="flex gap-3">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setStep(3)}
                                        className="flex-1 text-muted-foreground hover:text-foreground"
                                    >
                                        Skip for now
                                    </Button>
                                    <Button
                                        onClick={handleCreateBrand}
                                        disabled={loading}
                                        className="flex-[2] bg-slate-600 hover:bg-slate-700 text-white h-12"
                                    >
                                        {loading ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                                        )}
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
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="contactName" className="text-foreground flex items-center gap-2">
                                                <User className="h-4 w-4" /> Name
                                            </Label>
                                            <Input
                                                id="contactName"
                                                value={contactName}
                                                onChange={(e) => setContactName(e.target.value)}
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
                                                value={contactPhone}
                                                onChange={(e) => setContactPhone(e.target.value)}
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
                                            onChange={(e) => setContactEmail(e.target.value)}
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
                                            value={contactWebsite}
                                            onChange={(e) => setContactWebsite(e.target.value)}
                                            placeholder="www.yoursite.com"
                                            className="bg-background border-input text-foreground"
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={handleBack}
                                        className="border-border text-foreground hover:bg-muted"
                                    >
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                    </Button>
                                    <Button
                                        onClick={handleSaveContactInfo}
                                        disabled={loading}
                                        className="flex-1 bg-slate-600 hover:bg-slate-700 text-white h-12"
                                    >
                                        {loading ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
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
                                            logo_url: logoPreview || undefined,
                                            disclaimer_text: '',
                                            is_default: true,
                                            show_powered_by: true,
                                            show_generation_date: true,
                                        }}
                                    />
                                </CardContent>
                                <CardFooter className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={handleBack}
                                        className="border-border text-foreground hover:bg-muted"
                                    >
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Edit
                                    </Button>
                                    <Button
                                        onClick={() => setStep(5)}
                                        className="flex-1 bg-slate-600 hover:bg-slate-700 text-white h-12"
                                    >
                                        Looks Great! <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* Step 5: Demo Request + Finish */}
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
                                        {demoRequestCreated ? (
                                            <PartyPopper className="h-10 w-10 text-emerald-500" />
                                        ) : (
                                            <Send className="h-10 w-10 text-slate-600" />
                                        )}
                                    </div>
                                    <CardTitle className="text-3xl text-foreground">
                                        {demoRequestCreated ? "You're All Set!" : "Try It Out!"}
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground text-base">
                                        {demoRequestCreated
                                            ? "Your demo request is ready. Head to your dashboard to explore!"
                                            : "Want to see how UtilitySheet works? Create a demo request to experience the full flow."
                                        }
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {!demoRequestCreated && (
                                        <div className="p-4 rounded-xl border border-border bg-muted/30 mb-6">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 rounded-lg bg-emerald-500/10">
                                                    <FileText className="h-5 w-5 text-emerald-500" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-foreground">Demo Request</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        We'll create a sample request with a fictional property and seller.
                                                        This won't count against your monthly limit!
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {demoRequestCreated && (
                                        <div className="flex flex-col items-center gap-4 py-4">
                                            <div className="flex items-center gap-2 text-emerald-500">
                                                <CheckCircle2 className="h-5 w-5" />
                                                <span className="font-medium">Demo request created</span>
                                            </div>
                                            <p className="text-center text-muted-foreground">
                                                Check your dashboard to view the demo utility info sheet and explore all features.
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="flex flex-col gap-3">
                                    {!demoRequestCreated ? (
                                        <>
                                            <Button
                                                onClick={handleCreateDemoRequest}
                                                disabled={loading}
                                                className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white h-14 text-lg font-semibold shadow-lg shadow-slate-500/20"
                                            >
                                                {loading ? (
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Send className="mr-2 h-5 w-5" />
                                                        Create Demo Request
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                onClick={handleFinish}
                                                className="w-full text-muted-foreground hover:text-foreground"
                                            >
                                                Skip and go to dashboard
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            onClick={handleFinish}
                                            className="w-full bg-gradient-to-r from-slate-600 to-emerald-600 hover:from-slate-700 hover:to-emerald-700 text-white h-14 text-lg font-semibold shadow-lg shadow-emerald-500/20"
                                        >
                                            Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Step indicator text */}
                <p className="text-center text-sm text-muted-foreground mt-6">
                    Step {step} of {STEPS.length}: {STEPS[step - 1].title}
                </p>
            </div>
        </div>
    );
}
