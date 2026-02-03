'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, Check, Copy, Link as LinkIcon, MessageSquare, Mail, Loader2, MapPin, Sparkles, AlertTriangle, Plus } from 'lucide-react';
import type { BrandProfile, UtilityCategory } from '@/types';
import { UTILITY_CATEGORIES, UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import Link from 'next/link';
import { toast } from 'sonner';
import { DEFAULT_MESSAGE_TEMPLATES, firstNameFromFullName, renderTemplate } from '@/lib/message-templates';

interface FormData {
    property_address: string;
    seller_name: string;
    seller_email: string;
    seller_phone: string;
    closing_date: string;
    utility_categories: UtilityCategory[];
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
    brand_profile_id: '',
    send_seller_email: true,
};

const ONBOARDING_SAMPLE_ADDRESS = '123 Maple Street, Anytown, PA 18301';

export default function NewRequestPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isOnboarding = searchParams.get('onboarding') === '1' || searchParams.get('onboarding') === 'true';

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

    useEffect(() => {
        if (!isOnboarding) return;

        setFormData((prev) => {
            return {
                ...prev,
                property_address: prev.property_address.trim() ? prev.property_address : ONBOARDING_SAMPLE_ADDRESS,
            };
        });
    }, [isOnboarding]);

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch brands and account data in parallel
                const [brandsResponse, accountResponse, intakeResponse] = await Promise.all([
                    fetch('/api/branding'),
                    fetch('/api/account'),
                    fetch('/api/intake-link'),
                ]);

                if (brandsResponse.ok) {
                    const data = await brandsResponse.json();
                    setBrands(data);
                    // Set default brand if available
                    const defaultBrand = data.find((b: any) => b.is_default) || data[0];
                    if (defaultBrand) {
                        setFormData(prev => ({ ...prev, brand_profile_id: defaultBrand.id }));
                    }
                }

                if (accountResponse.ok) {
                    const accountData = await accountResponse.json();
                    setIsPro(accountData.account?.subscription_status === 'pro' || accountData.activeOrganization?.subscription_status === 'team');
                }

                if (intakeResponse.ok) {
                    const data = await intakeResponse.json().catch(() => ({}));
                    if (data.intakeLink?.url && data.intakeLink?.slug) {
                        setIntakeLink({ url: data.intakeLink.url, slug: data.intakeLink.slug });
                    }
                    setIntakeCanCustomize(Boolean(data.canCustomize));
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        }
        fetchData();
    }, []);

    const handleCopyReusableLink = async () => {
        if (!intakeLink?.url) return;
        try {
            await navigator.clipboard.writeText(intakeLink.url);
            toast.success('Reusable link copied');
        } catch {
            toast.error('Failed to copy link');
        }
    };

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
                brandProfileId: formData.brand_profile_id || undefined,
                sendSellerEmail: formData.send_seller_email,
            };

            if (isOnboarding) {
                requestBody.isDemo = true;
            }

            // Call API to create the request
            const response = await fetch('/api/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json();

                // Handle plan limit error specifically
                if (response.status === 403 && errorData.usage) {
                    setUsageInfo(errorData.usage);
                    setShowUpgradeDialog(true);
                    return;
                }

                throw new Error(errorData.message || 'Failed to create request');
            }

            const newRequest = await response.json();

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
    const isStep3Valid = formData.utility_categories.length > 0;

    return (
        <div className="w-full max-w-2xl mx-auto">
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

            {/* Header */}
            <div className="mb-8">
                <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground mb-4"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">New Utility Sheet Request</h1>
                <p className="text-muted-foreground mt-1">Create a request link to send to your seller</p>
            </div>

            {/* Reusable Seller Link */}
            {intakeLink?.url && (
                <Card className="border-border bg-card/50 mb-6">
                    <CardHeader>
                        <CardTitle className="text-foreground flex items-center gap-2">
                            <LinkIcon className="h-5 w-5 text-emerald-400" />
                            Reusable Seller Link
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Optional: share one fixed link. The seller will enter the property address first.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            <Input
                                value={intakeLink.url}
                                readOnly
                                className="bg-muted border-input text-muted-foreground"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="border-input text-foreground hover:bg-muted"
                                onClick={handleCopyReusableLink}
                            >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy
                            </Button>
                        </div>
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                Want a custom slug? {intakeCanCustomize ? 'Update it in Settings.' : 'Upgrade to Pro/Teams.'}
                            </p>
                            <Link href="/dashboard/settings" className="text-xs text-emerald-400 hover:text-emerald-300">
                                Open Settings
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Progress Steps */}
            <div className="flex items-center gap-1.5 sm:gap-2 mb-8">
                {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex items-center gap-2 flex-1">
                        <div
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors ${s < step
                                ? 'bg-emerald-500 text-white'
                                : s === step
                                    ? 'bg-muted text-foreground border-2 border-emerald-500'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                        >
                            {s < step ? <Check className="h-4 w-4" /> : s}
                        </div>
                        {s < 4 && (
                            <div
                                className={`flex-1 h-0.5 ${s < step ? 'bg-emerald-500' : 'bg-muted'}`}
                            />
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
                                className="bg-background/50 border-input text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button
                                onClick={() => setStep(2)}
                                disabled={!isStep1Valid}
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {brands.map((brand) => (
                                <button
                                    key={brand.id}
                                    onClick={() => updateField('brand_profile_id', brand.id)}
                                    className={`text-left p-4 rounded-xl border transition-all ${formData.brand_profile_id === brand.id
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
                                disabled={!formData.brand_profile_id}
                                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white"
                            >
                                Continue
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Seller Info (Optional) */}
            {step === 3 && (
                <Card className="border-border bg-card/50">
                    <CardHeader>
                        <CardTitle className="text-foreground">Seller Information</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Optional - helps personalize the request and enable reminders
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

                        {/* Email Notification Toggle */}
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
                        {/* Select All Toggle */}
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
                                        className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border transition-all min-w-0 ${isSelected
                                            ? 'bg-emerald-500/10 border-emerald-500/50 text-foreground'
                                            : 'bg-muted/50 border-border text-muted-foreground hover:border-input'
                                            }`}
                                    >
                                        <span className="text-lg sm:text-xl">{category.icon}</span>
                                        <span className="font-medium text-sm sm:text-base min-w-0 flex-1 truncate">{category.label}</span>
                                        {isSelected && (
                                            <Check className="h-4 w-4 text-emerald-400 ml-auto" />
                                        )}
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
                                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        Create Request
                                        <Check className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Share Dialog */}
            <Dialog open={showShareDialog} onOpenChange={(open) => {
                if (!open) {
                    // When dialog closes, always redirect to dashboard to prevent duplicate submissions
                    router.push('/dashboard');
                }
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
                        {/* Link Copy */}
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
                                    className={`border-input shrink-0 h-10 w-10 sm:w-auto sm:px-3 ${copied ? 'text-emerald-400 border-emerald-500' : 'text-foreground'
                                        }`}
                                >
                                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        {/* Message Templates */}
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

                        {/* SMS Preview */}
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
                                onClick={() => {
                                    setShowShareDialog(false);
                                    router.push('/dashboard');
                                }}
                            >
                                Go to Dashboard
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Upgrade Dialog */}
            <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
                <DialogContent className="bg-zinc-900 border-zinc-800 !max-w-[calc(100vw-2rem)] sm:!max-w-md">
                    <DialogHeader>
                        <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
                            <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
                        </div>
                        <DialogTitle className="text-white text-lg sm:text-xl text-center">Monthly Limit Reached</DialogTitle>
                        <DialogDescription className="text-zinc-400 text-center text-sm">
                            You&apos;ve used all your requests for this month
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                        {/* Usage Display */}
                        {usageInfo && (
                            <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-zinc-400 text-sm">Monthly Usage</span>
                                    <span className="text-white font-medium">
                                        {usageInfo.used} of {usageInfo.limit} requests
                                    </span>
                                </div>
                                <div className="w-full bg-zinc-700 rounded-full h-2">
                                    <div
                                        className="bg-red-500 h-2 rounded-full"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <p className="text-zinc-500 text-xs mt-2 capitalize">
                                    Current plan: {usageInfo.plan}
                                </p>
                            </div>
                        )}

                        {/* Upgrade Benefits */}
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Sparkles className="h-3 w-3 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-white text-sm font-medium">Upgrade to Pro</p>
                                    <p className="text-zinc-400 text-sm">Unlimited requests, custom branding, and priority support</p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                            <Link href="/dashboard/settings" className="w-full">
                                <Button
                                    className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white"
                                    onClick={() => setShowUpgradeDialog(false)}
                                >
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Upgrade Now
                                </Button>
                            </Link>
                            <Button
                                variant="outline"
                                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                                onClick={() => {
                                    setShowUpgradeDialog(false);
                                    router.push('/dashboard');
                                }}
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
