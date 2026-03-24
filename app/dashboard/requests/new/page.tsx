'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdvancedModuleConfigurator } from '@/components/advanced-modules/AdvancedModuleConfigurator';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Copy,
    Link as LinkIcon,
    MessageSquare,
    Mail,
    Loader2,
    MapPin,
    Sparkles,
    AlertTriangle,
    Plus,
    CheckCircle2,
} from 'lucide-react';
import type {
    AdvancedModuleExclusions,
    AdvancedModuleKey,
    BrandProfile,
    PacketMode,
    UtilityCategory,
} from '@/types';
import { UTILITY_CATEGORIES, UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import {
    ADVANCED_MODULE_DEFAULTS,
    ADVANCED_MODULE_KEYS,
    getAdvancedModuleIncludedFieldCount,
    normalizeAdvancedModuleExclusions,
    normalizeAdvancedModules,
} from '@/lib/packet/modules';
import Link from 'next/link';
import { toast } from 'sonner';
import { DEFAULT_MESSAGE_TEMPLATES, firstNameFromFullName, renderTemplate } from '@/lib/message-templates';
import { trackEvent } from '@/lib/analytics/events';

interface FormData {
    property_address: string;
    seller_name: string;
    seller_email: string;
    seller_phone: string;
    closing_date: string;
    utility_categories: UtilityCategory[];
    packet_mode: PacketMode;
    advanced_modules: AdvancedModuleKey[];
    advanced_module_exclusions: AdvancedModuleExclusions;
    brand_profile_id: string;
    send_seller_email: boolean;
}

const initialFormData: FormData = {
    property_address: '',
    seller_name: '',
    seller_email: '',
    seller_phone: '',
    closing_date: '',
    utility_categories: UTILITY_CATEGORY_KEYS,
    packet_mode: 'simple',
    advanced_modules: [...ADVANCED_MODULE_DEFAULTS],
    advanced_module_exclusions: {},
    brand_profile_id: '',
    send_seller_email: true,
};

const ONBOARDING_SAMPLE_ADDRESS = '123 Maple Street, Anytown, PA 18301';

export default function NewRequestPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isOnboarding = searchParams.get('onboarding') === '1' || searchParams.get('onboarding') === 'true';

    // Mode: show reusable link first; toggle to expose one-off form
    const [showOneOffForm, setShowOneOffForm] = useState(false);

    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [loading, setLoading] = useState(false);
    const [brands, setBrands] = useState<BrandProfile[]>([]);
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
    const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number; plan: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const [isPro, setIsPro] = useState(false);
    const [intakeLink, setIntakeLink] = useState<{ url: string; slug: string } | null>(null);
    const [intakeCanCustomize, setIntakeCanCustomize] = useState(false);
    const [copiedIntake, setCopiedIntake] = useState(false);
    const [intakeLinkLoading, setIntakeLinkLoading] = useState(true);

    useEffect(() => {
        if (!isOnboarding) return;
        setFormData((prev) => ({
            ...prev,
            property_address: prev.property_address.trim() ? prev.property_address : ONBOARDING_SAMPLE_ADDRESS,
        }));
        // Onboarding flow always shows the one-off form
        setShowOneOffForm(true);
    }, [isOnboarding]);

    useEffect(() => {
        async function fetchData() {
            try {
                const [brandsResponse, accountResponse, intakeResponse] = await Promise.all([
                    fetch('/api/branding'),
                    fetch('/api/account'),
                    fetch('/api/intake-link'),
                ]);
                let paidAccount = false;

                if (brandsResponse.ok) {
                    const data = await brandsResponse.json();
                    setBrands(data);
                    const defaultBrand = data.find((b: BrandProfile) => b.is_default) || data[0];
                    if (defaultBrand) {
                        setFormData(prev => ({ ...prev, brand_profile_id: defaultBrand.id }));
                    }
                }

                if (accountResponse.ok) {
                    const accountData = await accountResponse.json();
                    paidAccount = accountData.account?.subscription_status === 'pro' || accountData.activeOrganization?.subscription_status === 'team';
                    setIsPro(paidAccount);
                }

                if (intakeResponse.ok) {
                    const data = await intakeResponse.json().catch(() => ({}));
                    if (data.intakeLink?.url && data.intakeLink?.slug) {
                        setIntakeLink({ url: data.intakeLink.url, slug: data.intakeLink.slug });
                    }
                    setIntakeCanCustomize(Boolean(data.canCustomize));
                    const intakeDefaultModeRaw = data.intakeLink?.defaultPacketMode === 'advanced' ? 'advanced' : 'simple';
                    const nextPacketMode: PacketMode = intakeDefaultModeRaw === 'advanced' && paidAccount ? 'advanced' : 'simple';
                    const nextModules = nextPacketMode === 'advanced'
                        ? (Array.isArray(data.intakeLink?.advancedModules) && data.intakeLink.advancedModules.length > 0
                            ? normalizeAdvancedModules(data.intakeLink.advancedModules)
                            : [...ADVANCED_MODULE_DEFAULTS])
                        : [...ADVANCED_MODULE_DEFAULTS];
                    const nextExclusions = nextPacketMode === 'advanced'
                        ? normalizeAdvancedModuleExclusions(data.intakeLink?.advancedModuleExclusions || {}, nextModules)
                        : {};
                    setFormData((prev) => ({
                        ...prev,
                        packet_mode: nextPacketMode,
                        advanced_modules: nextModules,
                        advanced_module_exclusions: nextExclusions,
                    }));
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setIntakeLinkLoading(false);
            }
        }
        fetchData();
    }, []);

    useEffect(() => {
        trackEvent('new_request_started', {
            source: isOnboarding ? 'onboarding_new_request_page' : 'new_request_page',
        });
        if (isOnboarding) {
            trackEvent('first_request_started', {
                source: 'onboarding_new_request_page',
            });
        }
    }, [isOnboarding]);

    // ─── Reusable link copy + share ───────────────────────────────────────────

    const handleCopyIntakeLink = async () => {
        if (!intakeLink?.url) return;
        try {
            await navigator.clipboard.writeText(intakeLink.url);
            setCopiedIntake(true);
            setTimeout(() => setCopiedIntake(false), 2500);
            trackEvent('seller_link_copied', {
                source: 'new_request_reusable_link',
            });
        } catch {
            toast.error('Failed to copy link');
        }
    };

    const getDefaultBrand = () => brands.find((b) => b.is_default) || brands[0] || null;

    const getIntakeSmsText = () => {
        const brand = getDefaultBrand();
        const agentName = brand?.contact_name?.trim() || '';
        const link = intakeLink?.url || '';
        return `Hi, please use this link to fill in the utility providers for your property. It takes about 2 minutes — no account needed: ${link}${agentName ? `\n\nThank you,\n${agentName}` : ''}`;
    };

    const handleCopyIntakeSms = async () => {
        try {
            await navigator.clipboard.writeText(getIntakeSmsText());
            toast.success('SMS text copied');
        } catch {
            toast.error('Failed to copy SMS text');
        }
    };

    const handleOpenIntakeEmail = () => {
        const brand = getDefaultBrand();
        const agentName = brand?.contact_name?.trim() || '';
        const link = intakeLink?.url || '';
        const subject = encodeURIComponent('Utility Information Request');
        const body = encodeURIComponent(
            `Hi,\n\nPlease use the link below to fill in the utility providers for your property. It takes about 2 minutes and no account is needed.\n\n${link}\n\nThank you${agentName ? `,\n${agentName}` : '.'}`
        );
        window.open(`mailto:?subject=${subject}&body=${body}`);
    };

    // ─── One-off request handlers ─────────────────────────────────────────────

    const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const toggleCategory = (category: UtilityCategory) => {
        setFormData((prev) => ({
            ...prev,
            utility_categories: prev.utility_categories.includes(category)
                ? prev.utility_categories.filter((c) => c !== category)
                : [...prev.utility_categories, category],
        }));
    };

    const toggleAllCategories = () => {
        const allSelected = formData.utility_categories.length === UTILITY_CATEGORIES.length;
        setFormData((prev) => ({
            ...prev,
            utility_categories: allSelected ? [] : UTILITY_CATEGORY_KEYS,
        }));
    };

    const toggleAdvancedModule = (moduleKey: AdvancedModuleKey) => {
        setFormData((prev) => ({
            ...prev,
            advanced_modules: prev.advanced_modules.includes(moduleKey)
                ? prev.advanced_modules.filter((m) => m !== moduleKey)
                : ADVANCED_MODULE_KEYS.filter((candidate) => candidate === moduleKey || prev.advanced_modules.includes(candidate)),
            advanced_module_exclusions: normalizeAdvancedModuleExclusions(
                prev.advanced_module_exclusions,
                prev.advanced_modules.includes(moduleKey)
                    ? prev.advanced_modules.filter((m) => m !== moduleKey)
                    : ADVANCED_MODULE_KEYS.filter((candidate) => candidate === moduleKey || prev.advanced_modules.includes(candidate))
            ),
        }));
    };

    const toggleAdvancedModuleField = (moduleKey: AdvancedModuleKey, fieldKey: string) => {
        setFormData((prev) => {
            const currentExcluded = new Set(prev.advanced_module_exclusions[moduleKey] || []);
            if (currentExcluded.has(fieldKey)) {
                currentExcluded.delete(fieldKey);
            } else {
                currentExcluded.add(fieldKey);
            }

            const nextExclusions: AdvancedModuleExclusions = { ...prev.advanced_module_exclusions };
            if (currentExcluded.size === 0) {
                delete nextExclusions[moduleKey];
            } else {
                nextExclusions[moduleKey] = Array.from(currentExcluded);
            }

            return {
                ...prev,
                advanced_module_exclusions: normalizeAdvancedModuleExclusions(nextExclusions, prev.advanced_modules),
            };
        });
    };

    const handleCreate = async () => {
        setLoading(true);
        try {
            const requestBody: Record<string, unknown> = {
                propertyAddress: formData.property_address,
                sellerName: formData.seller_name || undefined,
                sellerEmail: formData.seller_email || undefined,
                sellerPhone: formData.seller_phone || undefined,
                closingDate: formData.closing_date || undefined,
                utilityCategories: formData.utility_categories,
                packetMode: formData.packet_mode,
                advancedModules: formData.packet_mode === 'advanced' ? formData.advanced_modules : [],
                advancedModuleExclusions: formData.packet_mode === 'advanced'
                    ? normalizeAdvancedModuleExclusions(formData.advanced_module_exclusions, formData.advanced_modules)
                    : {},
                brandProfileId: formData.brand_profile_id || undefined,
                sendSellerEmail: formData.send_seller_email,
            };

            if (isOnboarding) {
                requestBody.isDemo = true;
            }

            const response = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 403 && errorData.usage) {
                    setUsageInfo(errorData.usage);
                    setShowUpgradeDialog(true);
                    return;
                }
                throw new Error(errorData.message || 'Failed to create request');
            }

            const newRequest = await response.json();
            trackEvent('new_request_created', {
                source: isOnboarding ? 'onboarding_new_request_page' : 'new_request_page',
                utility_count: formData.utility_categories.length,
            });
            if (isOnboarding) {
                trackEvent('first_request_created', {
                    source: 'onboarding_new_request_page',
                    utility_count: formData.utility_categories.length,
                });
            }
            setGeneratedToken(newRequest.seller_token || newRequest.public_token);
            setShowShareDialog(true);
        } catch (error) {
            console.error('Error creating request:', error);
            toast.error('Failed to create request. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    const getShareLink = () => {
        if (!generatedToken) return '';
        return `${window.location.origin}/s/${generatedToken}`;
    };

    const copyLink = () => {
        navigator.clipboard.writeText(getShareLink());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getSmsTemplate = () => {
        const brand = brands.find((b) => b.id === formData.brand_profile_id);
        const firstName = firstNameFromFullName(formData.seller_name);
        const closingDate = formData.closing_date
            ? new Date(formData.closing_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            : '';
        const variables = {
            seller_name: formData.seller_name,
            seller_first_name_with_space: firstName ? ` ${firstName}` : '',
            agent_name: brand?.contact_name || '',
            property_address: formData.property_address,
            closing_date: closingDate,
            link: getShareLink(),
        };
        const template =
            brand?.message_templates?.seller_request?.sms?.trim()
                ? brand.message_templates.seller_request!.sms!
                : (DEFAULT_MESSAGE_TEMPLATES.seller_request?.sms || '');
        return renderTemplate(template, variables);
    };

    const getEmailTemplate = () => {
        const brand = brands.find((b) => b.id === formData.brand_profile_id);
        const firstName = firstNameFromFullName(formData.seller_name);
        const closingDate = formData.closing_date
            ? new Date(formData.closing_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            : '';
        const variables = {
            seller_name: formData.seller_name,
            seller_first_name_with_space: firstName ? ` ${firstName}` : '',
            agent_name: brand?.contact_name || '',
            property_address: formData.property_address,
            closing_date: closingDate,
            link: getShareLink(),
        };
        const subjectTemplate =
            brand?.message_templates?.seller_request?.mailto?.subject?.trim()
                ? brand.message_templates.seller_request!.mailto!.subject!
                : (DEFAULT_MESSAGE_TEMPLATES.seller_request?.mailto?.subject || '');
        const bodyTemplate =
            brand?.message_templates?.seller_request?.mailto?.body?.trim()
                ? brand.message_templates.seller_request!.mailto!.body!
                : (DEFAULT_MESSAGE_TEMPLATES.seller_request?.mailto?.body || '');
        return {
            subject: renderTemplate(subjectTemplate, variables),
            body: renderTemplate(bodyTemplate, variables),
        };
    };

    const isStep1Valid = formData.property_address.length >= 5;
    const hasAdvancedModuleWithNoFields = formData.packet_mode === 'advanced'
        && formData.advanced_modules.some((moduleKey) => (
            getAdvancedModuleIncludedFieldCount(moduleKey, formData.advanced_module_exclusions) === 0
        ));
    const isStep3Valid = formData.utility_categories.length > 0
        && (formData.packet_mode === 'simple' || (formData.advanced_modules.length > 0 && !hasAdvancedModuleWithNoFields));

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* Onboarding banner */}
            {isOnboarding && (
                <div className="mb-6 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <Sparkles className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-medium text-foreground">Guided first request</p>
                            <p className="text-sm text-muted-foreground">
                                Complete the &quot;New Request&quot; flow once. This request won&apos;t count against your monthly limit.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Page header */}
            <div className="mb-8">
                <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground mb-4"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {showOneOffForm && !isOnboarding ? 'New Request' : 'Send a Seller Link'}
                </h1>
                <p className="text-muted-foreground mt-1">
                    {showOneOffForm && !isOnboarding
                        ? 'Create a one-off request for a specific property'
                        : 'Choose how to send utility collection to your seller'}
                </p>
            </div>

            {/* ── DEFAULT VIEW: Reusable link ─────────────────────────────────── */}
            {!showOneOffForm && (
                <>
                    {/* Recommended: Reusable Link card */}
                    <Card className="border-emerald-500/30 bg-card/60 mb-4 relative overflow-hidden">
                        <div className="absolute top-3 right-3 z-10">
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] font-bold tracking-wide uppercase px-2 py-0.5">
                                Recommended
                            </Badge>
                        </div>

                        <CardHeader className="pb-4 pr-24">
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <LinkIcon className="h-5 w-5 text-emerald-400 shrink-0" />
                                Your Reusable Link
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                One permanent link for every property — sellers enter the address themselves.
                                No new request to create each time.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {/* URL + copy */}
                            {intakeLinkLoading ? (
                                <div className="flex items-center gap-2 h-10 text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm">Loading your link...</span>
                                </div>
                            ) : intakeLink?.url ? (
                                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                    <Input
                                        value={intakeLink.url}
                                        readOnly
                                        className="bg-muted border-input text-foreground font-mono text-sm"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleCopyIntakeLink}
                                        className={`shrink-0 border-input transition-colors ${copiedIntake ? 'border-emerald-500/50 text-emerald-500' : 'text-foreground hover:bg-muted'}`}
                                    >
                                        {copiedIntake ? (
                                            <><Check className="mr-2 h-4 w-4" />Copied!</>
                                        ) : (
                                            <><Copy className="mr-2 h-4 w-4" />Copy</>
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Unable to load your link. Try refreshing.</p>
                            )}

                            {/* Quick share buttons */}
                            {intakeLink?.url && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick share</p>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Button
                                            variant="outline"
                                            className="flex-1 border-input text-foreground hover:bg-muted h-auto py-2.5 text-sm active:scale-[0.98]"
                                            onClick={handleCopyIntakeSms}
                                        >
                                            <MessageSquare className="mr-2 h-4 w-4" />
                                            Copy SMS text
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1 border-input text-foreground hover:bg-muted h-auto py-2.5 text-sm active:scale-[0.98]"
                                            onClick={handleOpenIntakeEmail}
                                        >
                                            <Mail className="mr-2 h-4 w-4" />
                                            Open email
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* What happens next */}
                            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-2">
                                <p className="text-xs font-semibold text-foreground">What happens next</p>
                                {[
                                    'Seller taps the link, enters the property address, confirms utilities in ~2 min',
                                    'PDF automatically attaches to your notification email when they submit',
                                    'No login required for you — the result arrives in your inbox',
                                ].map((item) => (
                                    <div key={item} className="flex items-start gap-2">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                        <span className="text-xs text-muted-foreground">{item}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Slug customization note */}
                            <div className="flex items-center justify-between pt-0.5">
                                <p className="text-xs text-muted-foreground">
                                    {intakeCanCustomize
                                        ? 'Customize your link in Settings.'
                                        : 'Upgrade to Pro/Teams for a custom branded link.'}
                                </p>
                                <Link href="/dashboard/settings" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                                    {intakeCanCustomize ? 'Open Settings' : 'Upgrade'}
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Or divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-3 text-muted-foreground tracking-wider">Or</span>
                        </div>
                    </div>

                    {/* One-off request toggle */}
                    <button
                        type="button"
                        onClick={() => setShowOneOffForm(true)}
                        className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card/30 hover:bg-card/60 hover:border-input transition-all text-left group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="font-medium text-foreground text-sm">Create a request for a specific address</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Enter the property address and optionally customize utilities and add seller info
                                </p>
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </button>
                </>
            )}

            {/* ── ONE-OFF FORM ────────────────────────────────────────────────── */}
            {showOneOffForm && (
                <>
                    {/* Back to reusable link (hidden during onboarding) */}
                    {!isOnboarding && (
                        <button
                            type="button"
                            onClick={() => { setShowOneOffForm(false); setStep(1); }}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Use reusable link instead
                        </button>
                    )}

                    {/* Progress steps */}
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-8">
                        {[1, 2, 3, 4].map((s) => (
                            <div key={s} className="flex items-center gap-2 flex-1">
                                <div
                                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors ${
                                        s < step
                                            ? 'bg-emerald-500 text-white'
                                            : s === step
                                            ? 'bg-muted text-foreground border-2 border-emerald-500'
                                            : 'bg-muted text-muted-foreground'
                                    }`}
                                >
                                    {s < step ? <Check className="h-4 w-4" /> : s}
                                </div>
                                {s < 4 && (
                                    <div className={`flex-1 h-0.5 ${s < step ? 'bg-emerald-500' : 'bg-muted'}`} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Step 1: Property Address */}
                    {step === 1 && (
                        <Card className="border-border bg-card/50">
                            <CardHeader>
                                <CardTitle className="text-foreground flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-emerald-400" />
                                    Property Address
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    Enter the property address for this utility sheet
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="address" className="text-foreground">Full Address *</Label>
                                    <Input
                                        id="address"
                                        placeholder="123 Main Street, City, State, ZIP"
                                        value={formData.property_address}
                                        onChange={(e) => updateField('property_address', e.target.value)}
                                        data-testid="new-request-address-input"
                                        className="bg-background/50 border-input text-foreground placeholder:text-muted-foreground"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        onClick={() => setStep(2)}
                                        disabled={!isStep1Valid}
                                        data-testid="new-request-step-1-continue"
                                        className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white"
                                    >
                                        Continue
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Step 2: Branding Profile */}
                    {step === 2 && (
                        <Card className="border-border bg-card/50">
                            <CardHeader>
                                <CardTitle className="text-foreground flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-emerald-400" />
                                    Branding Profile
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    Choose which branding to display on the utility sheet
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {brands.length === 0 ? (
                                    <div className="rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
                                        {isPro ? (
                                            <div className="text-center space-y-3">
                                                <p className="text-sm text-muted-foreground">You don&apos;t have any brand profiles yet.</p>
                                                <Link href="/dashboard/branding/new?returnTo=/dashboard/requests/new">
                                                    <Button variant="outline" className="border-dashed border-2 border-emerald-500/40 hover:border-emerald-500/70 hover:bg-emerald-500/5 text-emerald-400">
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        Create a brand profile
                                                    </Button>
                                                </Link>
                                                <p className="text-xs text-muted-foreground">or continue without one — you can add branding later.</p>
                                            </div>
                                        ) : (
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 rounded-lg bg-muted shrink-0">
                                                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">No brand profiles yet</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        This request will use default UtilitySheet branding. Upgrade to Pro to add your own logo and contact info.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {brands.map((brand) => (
                                            <button
                                                key={brand.id}
                                                onClick={() => updateField('brand_profile_id', brand.id)}
                                                className={`text-left p-4 rounded-xl border transition-all ${
                                                    formData.brand_profile_id === brand.id
                                                        ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-slate-500/5'
                                                        : 'bg-muted/50 border-border hover:border-input'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="font-semibold text-foreground">{brand.name}</p>
                                                    {formData.brand_profile_id === brand.id && (
                                                        <div className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                                                            <Check className="h-3 w-3 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground line-clamp-1">{brand.contact_name || 'No contact name'}</p>
                                                <div className="flex gap-1.5 mt-3">
                                                    <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: brand.primary_color }} />
                                                    <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: brand.secondary_color }} />
                                                </div>
                                            </button>
                                        ))}

                                        {isPro ? (
                                            <Link href="/dashboard/branding/new?returnTo=/dashboard/requests/new">
                                                <Button variant="outline" className="w-full h-full min-h-[100px] border-dashed border-2 border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 text-muted-foreground hover:text-emerald-400 group">
                                                    <div className="flex flex-col items-center">
                                                        <Plus className="h-5 w-5 mb-1 group-hover:scale-110 transition-transform" />
                                                        <span>New Profile</span>
                                                    </div>
                                                </Button>
                                            </Link>
                                        ) : (
                                            <div className="relative">
                                                <Button
                                                    variant="outline"
                                                    disabled
                                                    className="w-full h-full min-h-[100px] border-dashed border-2 border-border text-muted-foreground/50 cursor-not-allowed"
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <Plus className="h-5 w-5 mb-1" />
                                                        <span>New Profile</span>
                                                        <span className="text-xs text-muted-foreground/50 mt-1">Pro Plan</span>
                                                    </div>
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-between pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep(1)}
                                        className="border-border text-foreground hover:bg-muted"
                                    >
                                        <ArrowLeft className="mr-2 h-4 w-4" />
                                        Back
                                    </Button>
                                    <Button
                                        onClick={() => setStep(3)}
                                        disabled={brands.length > 0 && !formData.brand_profile_id}
                                        className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white"
                                    >
                                        Continue
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Step 3: Seller Info */}
                    {step === 3 && (
                        <Card className="border-border bg-card/50">
                            <CardHeader>
                                <CardTitle className="text-foreground">Seller Information</CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    Optional — helps personalize the request and enable reminders
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="sellerName" className="text-foreground">Seller Name</Label>
                                    <Input
                                        id="sellerName"
                                        placeholder="John Smith"
                                        value={formData.seller_name}
                                        onChange={(e) => updateField('seller_name', e.target.value)}
                                        className="bg-background/50 border-input text-foreground placeholder:text-muted-foreground"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="sellerEmail" className="text-foreground">Email</Label>
                                        <Input
                                            id="sellerEmail"
                                            type="email"
                                            placeholder="john@example.com"
                                            value={formData.seller_email}
                                            onChange={(e) => updateField('seller_email', e.target.value)}
                                            className="bg-background/50 border-input text-foreground placeholder:text-muted-foreground"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="sellerPhone" className="text-foreground">Phone</Label>
                                        <Input
                                            id="sellerPhone"
                                            type="tel"
                                            placeholder="(555) 123-4567"
                                            value={formData.seller_phone}
                                            onChange={(e) => updateField('seller_phone', e.target.value)}
                                            className="bg-background/50 border-input text-foreground placeholder:text-muted-foreground"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="closingDate" className="text-foreground">Closing Date</Label>
                                    <Input
                                        id="closingDate"
                                        type="date"
                                        value={formData.closing_date}
                                        onChange={(e) => updateField('closing_date', e.target.value)}
                                        className="bg-background/50 border-input text-foreground"
                                    />
                                </div>

                                {formData.seller_email && (
                                    <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
                                        <Checkbox
                                            id="sendSellerEmail"
                                            checked={formData.send_seller_email}
                                            onCheckedChange={(checked) => updateField('send_seller_email', checked === true)}
                                            className="mt-0.5"
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="sendSellerEmail" className="text-foreground font-medium cursor-pointer">
                                                Send email notification to seller
                                            </Label>
                                            <p className="text-sm text-muted-foreground">
                                                An email with the form link will be sent to the seller when you create this request
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-between">
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep(2)}
                                        className="border-border text-foreground hover:bg-muted"
                                    >
                                        <ArrowLeft className="mr-2 h-4 w-4" />
                                        Back
                                    </Button>
                                    <Button
                                        onClick={() => setStep(4)}
                                        className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white"
                                    >
                                        Continue
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Step 4: Utility Categories */}
                    {step === 4 && (
                        <Card className="border-border bg-card/50">
                            <CardHeader>
                                <CardTitle className="text-foreground">Utility Categories</CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    Select which utilities to include in the request
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                                    <Label className="text-foreground">Packet Mode</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                updateField('packet_mode', 'simple');
                                                trackEvent('packet_mode_selected', {
                                                    mode: 'simple',
                                                    location: 'new_request',
                                                });
                                            }}
                                            className={`text-left rounded-lg border p-3 transition-colors ${
                                                formData.packet_mode === 'simple'
                                                    ? 'border-emerald-500/60 bg-emerald-500/10'
                                                    : 'border-border hover:border-input'
                                            }`}
                                        >
                                            <p className="text-sm font-semibold text-foreground">Simple Utility Sheet</p>
                                            <p className="text-xs text-muted-foreground mt-1">Fast, single-page output</p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!isPro) {
                                                    setShowUpgradeDialog(true);
                                                    return;
                                                }
                                                const nextModules = formData.advanced_modules.length === 0
                                                    ? [...ADVANCED_MODULE_DEFAULTS]
                                                    : normalizeAdvancedModules(formData.advanced_modules);
                                                updateField('packet_mode', 'advanced');
                                                updateField('advanced_modules', nextModules);
                                                updateField(
                                                    'advanced_module_exclusions',
                                                    normalizeAdvancedModuleExclusions(formData.advanced_module_exclusions, nextModules)
                                                );
                                                trackEvent('packet_mode_selected', {
                                                    mode: 'advanced',
                                                    location: 'new_request',
                                                });
                                            }}
                                            className={`text-left rounded-lg border p-3 transition-colors ${
                                                formData.packet_mode === 'advanced'
                                                    ? 'border-emerald-500/60 bg-emerald-500/10'
                                                    : 'border-border hover:border-input'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-semibold text-foreground">Advanced Utility Packet</p>
                                                {!isPro && <Badge variant="outline">Pro / Teams</Badge>}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">Modular multi-page packet with seller handoff details</p>
                                        </button>
                                    </div>
                                </div>

                                {formData.packet_mode === 'advanced' && (
                                    <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-foreground">Advanced Modules</Label>
                                            <span className="text-xs text-muted-foreground">{formData.advanced_modules.length} enabled</span>
                                        </div>
                                        <AdvancedModuleConfigurator
                                            enabledModules={formData.advanced_modules}
                                            exclusions={formData.advanced_module_exclusions}
                                            onToggleModule={(moduleKey) => {
                                                const isEnabled = formData.advanced_modules.includes(moduleKey);
                                                toggleAdvancedModule(moduleKey);
                                                trackEvent('advanced_module_toggled', {
                                                    module: moduleKey,
                                                    enabled: !isEnabled,
                                                    location: 'new_request',
                                                });
                                            }}
                                            onToggleField={toggleAdvancedModuleField}
                                        />
                                        {formData.advanced_modules.length === 0 && (
                                            <p className="text-xs text-amber-500">Enable at least one module for Advanced mode.</p>
                                        )}
                                        {hasAdvancedModuleWithNoFields && formData.advanced_modules.length > 0 && (
                                            <p className="text-xs text-amber-500">Each enabled module must include at least one question.</p>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center justify-between pb-2 border-b border-border">
                                    <span className="text-sm text-muted-foreground">
                                        {formData.utility_categories.length} of {UTILITY_CATEGORIES.length} selected
                                    </span>
                                    <button
                                        onClick={toggleAllCategories}
                                        className="text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors"
                                    >
                                        {formData.utility_categories.length === UTILITY_CATEGORIES.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                                    {UTILITY_CATEGORIES.map((category) => {
                                        const isSelected = formData.utility_categories.includes(category.key);
                                        return (
                                            <button
                                                key={category.key}
                                                onClick={() => toggleCategory(category.key)}
                                                className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border transition-all min-w-0 ${
                                                    isSelected
                                                        ? 'bg-emerald-500/10 border-emerald-500/50 text-foreground'
                                                        : 'bg-muted/50 border-border text-muted-foreground hover:border-input'
                                                }`}
                                            >
                                                <span className="text-lg sm:text-xl">{category.icon}</span>
                                                <span className="font-medium text-sm sm:text-base min-w-0 flex-1 truncate">{category.label}</span>
                                                {isSelected && <Check className="h-4 w-4 text-emerald-400 ml-auto" />}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex justify-between pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep(3)}
                                        className="border-border text-foreground hover:bg-muted"
                                    >
                                        <ArrowLeft className="mr-2 h-4 w-4" />
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleCreate}
                                        disabled={!isStep3Valid || loading}
                                        data-testid="new-request-create"
                                        className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white"
                                    >
                                        {loading ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
                                        ) : (
                                            <>Create Request<Check className="ml-2 h-4 w-4" /></>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {/* ── SHARE DIALOG ─────────────────────────────────────────────────── */}
            <Dialog open={showShareDialog} onOpenChange={(open) => {
                if (!open) router.push('/dashboard');
                setShowShareDialog(open);
            }}>
                <DialogContent className="bg-popover border-border !max-w-[calc(100vw-2rem)] sm:!max-w-lg" showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle className="text-foreground text-lg sm:text-xl">Request Created! 🎉</DialogTitle>
                        <DialogDescription className="text-muted-foreground text-sm">
                            Share this link with your seller to collect utility information
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 sm:space-y-6 pt-4">
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-sm">Seller Link</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={getShareLink()}
                                    readOnly
                                    className="bg-muted border-input text-foreground font-mono text-xs sm:text-sm min-w-0"
                                />
                                <Button
                                    onClick={copyLink}
                                    variant="outline"
                                    className={`border-input shrink-0 h-10 w-10 sm:w-auto sm:px-3 ${copied ? 'text-emerald-400 border-emerald-500' : 'text-foreground'}`}
                                >
                                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2 sm:space-y-3">
                            <Label className="text-muted-foreground text-sm">Quick Share</Label>
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                <Button
                                    variant="outline"
                                    className="border-input text-foreground hover:bg-muted h-auto py-2.5 sm:py-3 text-sm active:scale-[0.98]"
                                    onClick={() => {
                                        navigator.clipboard.writeText(getSmsTemplate());
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                >
                                    <MessageSquare className="mr-1.5 sm:mr-2 h-4 w-4" />
                                    Copy SMS
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-input text-foreground hover:bg-muted h-auto py-2.5 sm:py-3 text-sm active:scale-[0.98]"
                                    onClick={() => {
                                        const email = getEmailTemplate();
                                        const mailto = `mailto:${formData.seller_email}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
                                        window.open(mailto);
                                    }}
                                >
                                    <Mail className="mr-1.5 sm:mr-2 h-4 w-4" />
                                    Open Email
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs sm:text-sm">SMS Template</Label>
                            <div className="p-2.5 sm:p-3 bg-muted/50 rounded-lg border border-border">
                                <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap break-words">{getSmsTemplate()}</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button
                                variant="outline"
                                className="border-input text-foreground hover:bg-muted w-full sm:w-auto active:scale-[0.98]"
                                onClick={() => { setShowShareDialog(false); router.push('/dashboard'); }}
                            >
                                Go to Dashboard
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── UPGRADE DIALOG ────────────────────────────────────────────────── */}
            <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
                <DialogContent className="bg-popover border-border !max-w-[calc(100vw-2rem)] sm:!max-w-md">
                    <DialogHeader>
                        <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
                            <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
                        </div>
                        <DialogTitle className="text-foreground text-lg sm:text-xl text-center">Monthly limit reached</DialogTitle>
                        <DialogDescription className="text-muted-foreground text-center text-sm">
                            You&apos;ve used all {usageInfo?.limit ?? 3} free requests this month
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 pt-4">
                        {usageInfo && (
                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-muted-foreground text-sm">Monthly usage</span>
                                    <span className="text-foreground font-medium">{usageInfo.used} / {usageInfo.limit} requests</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                    <div className="bg-red-500 h-2 rounded-full" style={{ width: '100%' }} />
                                </div>
                                <p className="text-muted-foreground text-xs mt-2">Resets the 1st of each month</p>
                            </div>
                        )}
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2.5">
                            <p className="text-sm font-semibold text-foreground">Pro plan — $9/month</p>
                            {[
                                'Unlimited requests, no monthly cap',
                                'Custom logo, colors & contact info on every sheet',
                                'Custom branded link for your business',
                            ].map((benefit) => (
                                <div key={benefit} className="flex items-start gap-2">
                                    <div className="mt-0.5 h-4 w-4 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                                        <Sparkles className="h-2.5 w-2.5 text-emerald-400" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">{benefit}</p>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Link href="/dashboard/settings" className="w-full">
                                <Button
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11"
                                    onClick={() => setShowUpgradeDialog(false)}
                                >
                                    Upgrade to Pro
                                </Button>
                            </Link>
                            <Button
                                variant="outline"
                                className="border-border text-muted-foreground hover:bg-muted"
                                onClick={() => { setShowUpgradeDialog(false); router.push('/dashboard'); }}
                            >
                                Back to Dashboard
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
