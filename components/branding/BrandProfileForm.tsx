'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ArrowLeft,
    Building2,
    FileDown,
    FileText,
    ImageIcon,
    ListChecks,
    Loader2,
    Lock,
    Mail,
    MessageSquare,
    Palette,
    Pencil,
    Plus,
    RotateCcw,
    Save,
    Settings2,
    Trash2,
    Upload,
    User,
    X,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { BrandProfileFormData, PacketMode } from '@/types';
import { DEFAULT_BUYER_STEPS } from '@/lib/constants';
import { BRAND_PROFILE_LIMITS } from '@/lib/branding/limits';
import UtilitySheetPdfPreview from './UtilitySheetPdfPreview';
import MessageTemplatesEditor from './MessageTemplatesEditor';
import { generateTestPdf } from '@/lib/test-pdf-generator';

interface BrandProfileFormProps {
    initialData?: BrandProfileFormData;
    onSubmit: (data: BrandProfileFormData) => Promise<void>;
    isEditing?: boolean;
    isPro?: boolean;
    /**
     * Human-readable ownership scope, e.g. "Personal profile" or
     * "Team profile · Acme Realty". Shown so users always know whether they
     * are editing a personal or shared workspace profile.
     */
    scopeLabel?: string;
}

const defaultFormData: BrandProfileFormData = {
    name: '',
    primary_color: '#10b981',
    secondary_color: '#059669',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    contact_website: '',
    disclaimer_text: '',
    is_default: false,
    // null = use the product-default buyer steps (explicit API semantics)
    buyer_next_steps: null,
    next_steps_title: '',
    show_powered_by: true,
    show_generation_date: true,
    welcome_message: '',
    message_templates: {},
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

function ProChip() {
    return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Pro
        </span>
    );
}

function UpgradeHint() {
    return (
        <p className="text-xs text-muted-foreground">
            Available on Pro.{' '}
            <Link href="/dashboard/settings" className="underline underline-offset-2 hover:text-foreground">
                Upgrade
            </Link>{' '}
            to customize this.
        </p>
    );
}

export default function BrandProfileForm({ initialData, onSubmit, isEditing = false, isPro = false, scopeLabel }: BrandProfileFormProps) {
    const router = useRouter();
    const [formData, setFormData] = useState<BrandProfileFormData>(() => ({
        ...defaultFormData,
        ...(initialData || {}),
        message_templates: initialData?.message_templates || {},
    }));
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [previewMode, setPreviewMode] = useState<PacketMode>('simple');
    const [nameTouched, setNameTouched] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const initialSnapshot = useMemo(
        () => JSON.stringify({ ...defaultFormData, ...(initialData || {}), message_templates: initialData?.message_templates || {} }),
        [initialData]
    );
    const isDirty = JSON.stringify(formData) !== initialSnapshot;

    const nameMissing = !formData.name.trim();
    const primaryColorInvalid = !HEX_COLOR_PATTERN.test(formData.primary_color.trim());
    const secondaryColorInvalid = !HEX_COLOR_PATTERN.test(formData.secondary_color.trim());
    const canSave = !nameMissing && !primaryColorInvalid && !secondaryColorInvalid && !loading;

    const usingCustomSteps = Array.isArray(formData.buyer_next_steps);

    const updateField = <K extends keyof BrandProfileFormData>(field: K, value: BrandProfileFormData[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Invalid file type. Please use JPEG, PNG, WebP, or SVG.');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error('File too large. Maximum size is 2MB.');
            return;
        }

        setUploading(true);
        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);

            const response = await fetch('/api/branding/upload', {
                method: 'POST',
                body: formDataUpload,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Upload failed');
            }

            const { url } = await response.json();
            updateField('logo_url', url);
            toast.success('Logo uploaded. Save to keep it.');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to upload logo');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveLogo = () => {
        // Explicit null tells the API to clear the stored logo on save.
        updateField('logo_url', null);
        toast.success('Logo removed. Save to apply.');
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const cleanedSteps = Array.isArray(formData.buyer_next_steps)
                ? formData.buyer_next_steps.map((step) => step.trim()).filter(Boolean)
                : null;

            await onSubmit({
                ...formData,
                name: formData.name.trim(),
                // An emptied custom list falls back to the product defaults.
                buyer_next_steps: cleanedSteps && cleanedSteps.length > 0 ? cleanedSteps : null,
            });
        } catch (error) {
            console.error('Error submitting form:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateTestPdf = async () => {
        setGeneratingPdf(true);
        try {
            await generateTestPdf(formData, isPro ? previewMode : 'simple');
            toast.success('Test PDF downloaded!');
        } catch (error) {
            console.error('Error generating test PDF:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to generate test PDF');
        } finally {
            setGeneratingPdf(false);
        }
    };

    const previewColumn = (
        <div className="space-y-4">
            <UtilitySheetPdfPreview
                branding={formData}
                isPro={isPro}
                mode={previewMode}
                onModeChange={setPreviewMode}
            />
            <Button
                variant="outline"
                className="w-full"
                onClick={handleGenerateTestPdf}
                disabled={generatingPdf}
            >
                {generatingPdf ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Preparing PDF...
                    </>
                ) : (
                    <>
                        <FileDown className="mr-2 h-4 w-4" />
                        Download test PDF
                    </>
                )}
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
                The test PDF is rendered by the same engine as real downloads, using the branding shown here
                {isDirty ? ', including your unsaved changes' : ''}.
            </p>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground mb-4 -ml-2"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">{isEditing ? 'Edit Branding Profile' : 'New Branding Profile'}</h1>
                        <p className="text-muted-foreground mt-1 max-w-xl">
                            One profile brands everything a seller and buyer see from you: the seller form, the web packet, PDFs, and emails.
                        </p>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-2">
                        {scopeLabel && (
                            <Badge variant="outline" className="text-muted-foreground gap-1.5">
                                {scopeLabel.startsWith('Team') ? <Building2 className="h-3 w-3" aria-hidden="true" /> : <User className="h-3 w-3" aria-hidden="true" />}
                                {scopeLabel}
                            </Badge>
                        )}
                        <div className="flex items-center gap-2">
                            <Switch
                                id="isDefault"
                                checked={formData.is_default}
                                onCheckedChange={(checked) => updateField('is_default', checked === true)}
                                disabled={!isPro}
                                aria-label="Default profile"
                                aria-describedby="isDefaultHint"
                            />
                            <Label
                                htmlFor="isDefault"
                                className={isPro ? 'text-foreground cursor-pointer' : 'text-muted-foreground cursor-not-allowed'}
                            >
                                Default profile
                            </Label>
                            {!isPro && <ProChip />}
                        </div>
                        <p id="isDefaultHint" className="text-xs text-muted-foreground text-left sm:text-right">
                            The default profile is preselected for new requests.
                        </p>
                    </div>
                </div>
            </div>

            {/* Two-column layout: tabbed editor left, live preview right */}
            <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
                <div className="min-w-0">
                    <Tabs defaultValue="brand">
                        <TabsList className="w-full h-auto sm:w-auto">
                            <TabsTrigger value="brand" className="px-3 py-1.5 text-sm">
                                <Palette className="h-4 w-4" aria-hidden="true" />
                                Brand
                            </TabsTrigger>
                            <TabsTrigger value="pdf" className="px-3 py-1.5 text-sm">
                                <FileText className="h-4 w-4" aria-hidden="true" />
                                PDF Content
                            </TabsTrigger>
                            <TabsTrigger value="messages" className="px-3 py-1.5 text-sm">
                                <Mail className="h-4 w-4" aria-hidden="true" />
                                Messages
                            </TabsTrigger>
                        </TabsList>

                        {/* ------------------------------------------------ Brand tab */}
                        <TabsContent value="brand" className="mt-4 space-y-6">
                            <Card className="border-border bg-card">
                                <CardHeader>
                                    <CardTitle className="text-foreground flex items-center gap-2">
                                        <Palette className="h-5 w-5 text-primary" aria-hidden="true" />
                                        Brand identity
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Your name, logo, and accent color. Shown on PDFs, the seller form, the web packet, and emails.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name" className="text-foreground">Brand name *</Label>
                                        <Input
                                            id="name"
                                            placeholder="e.g., Your Real Estate Team"
                                            value={formData.name}
                                            onChange={(e) => updateField('name', e.target.value)}
                                            onBlur={() => setNameTouched(true)}
                                            maxLength={BRAND_PROFILE_LIMITS.brandNameMax}
                                            aria-invalid={nameTouched && nameMissing}
                                            className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                        />
                                        {nameTouched && nameMissing ? (
                                            <p className="text-xs text-destructive" role="alert">Brand name is required.</p>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">
                                                Appears in the document header. With no logo, its initials become your brand mark.
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-foreground">Logo</Label>
                                        <div className="flex items-start gap-4">
                                            <div className="relative w-20 h-20 rounded-lg bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0">
                                                {formData.logo_url ? (
                                                    <Image
                                                        src={formData.logo_url}
                                                        alt="Current brand logo"
                                                        fill
                                                        className="object-contain"
                                                    />
                                                ) : uploading ? (
                                                    <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                                                ) : (
                                                    <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                                                )}
                                            </div>
                                            <div className="flex-1 space-y-1.5">
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                                                    onChange={handleFileSelect}
                                                    className="hidden"
                                                    id="logo-upload"
                                                />
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        disabled={uploading}
                                                    >
                                                        {uploading ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Uploading...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Upload className="mr-2 h-4 w-4" />
                                                                {formData.logo_url ? 'Replace logo' : 'Upload logo'}
                                                            </>
                                                        )}
                                                    </Button>
                                                    {formData.logo_url && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={handleRemoveLogo}
                                                            className="text-muted-foreground hover:text-destructive"
                                                        >
                                                            <X className="mr-1 h-4 w-4" />
                                                            Remove
                                                        </Button>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    JPEG, PNG, WebP, or SVG up to 2MB. Square or horizontal logos look best; the PDF renders logos 36px tall.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 sm:max-w-xs">
                                        <Label htmlFor="primaryColor" className="text-foreground">Primary color</Label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                id="primaryColor"
                                                aria-label="Pick primary color"
                                                value={HEX_COLOR_PATTERN.test(formData.primary_color) ? formData.primary_color : '#10b981'}
                                                onChange={(e) => updateField('primary_color', e.target.value)}
                                                className="w-10 h-10 rounded-lg cursor-pointer border-0 shrink-0"
                                            />
                                            <Input
                                                value={formData.primary_color}
                                                onChange={(e) => updateField('primary_color', e.target.value)}
                                                aria-label="Primary color hex value"
                                                aria-invalid={primaryColorInvalid}
                                                className="bg-background border-input text-foreground font-mono uppercase"
                                            />
                                        </div>
                                        {primaryColorInvalid ? (
                                            <p className="text-xs text-destructive" role="alert">Enter a hex color like #10B981.</p>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">
                                                The accent used across PDFs, the seller form, and the web packet.
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border bg-card">
                                <CardHeader>
                                    <CardTitle className="text-foreground">Contact information</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Shown in the document header and on seller emails so buyers and sellers can reach you.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="contactName" className="text-foreground">Agent/team name</Label>
                                            <Input
                                                id="contactName"
                                                placeholder="Jane Smith"
                                                value={formData.contact_name || ''}
                                                onChange={(e) => updateField('contact_name', e.target.value)}
                                                maxLength={BRAND_PROFILE_LIMITS.contactNameMax}
                                                className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="contactPhone" className="text-foreground">Phone</Label>
                                            <Input
                                                id="contactPhone"
                                                type="tel"
                                                placeholder="(555) 123-4567"
                                                value={formData.contact_phone || ''}
                                                onChange={(e) => updateField('contact_phone', e.target.value)}
                                                maxLength={BRAND_PROFILE_LIMITS.contactPhoneMax}
                                                className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="contactEmail" className="text-foreground">Email</Label>
                                            <Input
                                                id="contactEmail"
                                                type="email"
                                                placeholder="agent@realty.com"
                                                value={formData.contact_email || ''}
                                                onChange={(e) => updateField('contact_email', e.target.value)}
                                                maxLength={BRAND_PROFILE_LIMITS.contactEmailMax}
                                                className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="contactWebsite" className="text-foreground">Website</Label>
                                            <Input
                                                id="contactWebsite"
                                                placeholder="yourrealty.com"
                                                value={formData.contact_website || ''}
                                                onChange={(e) => updateField('contact_website', e.target.value)}
                                                maxLength={BRAND_PROFILE_LIMITS.contactWebsiteMax}
                                                className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                            />
                                            <p className="text-xs text-muted-foreground">PDFs show the plain domain, e.g. yourrealty.com.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ------------------------------------------- PDF Content tab */}
                        <TabsContent value="pdf" className="mt-4 space-y-6">
                            <Card className="border-border bg-card">
                                <CardHeader>
                                    <CardTitle className="text-foreground flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                                        Document text
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Optional messages printed on the Utility Info Sheet and Seller Transition Packet.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="space-y-2">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="flex items-center gap-2">
                                                <Label htmlFor="welcomeMessage" className="text-foreground">Welcome message</Label>
                                                {!isPro && <ProChip />}
                                            </span>
                                            <span className="text-[11px] tabular-nums text-muted-foreground">
                                                {(formData.welcome_message || '').length}/{BRAND_PROFILE_LIMITS.welcomeMessageMax}
                                            </span>
                                        </div>
                                        <Textarea
                                            id="welcomeMessage"
                                            placeholder="A short note to the buyer, shown near the top of the document..."
                                            value={formData.welcome_message || ''}
                                            onChange={(e) => updateField('welcome_message', e.target.value)}
                                            maxLength={BRAND_PROFILE_LIMITS.welcomeMessageMax}
                                            className="bg-background border-input text-foreground placeholder:text-muted-foreground min-h-[60px]"
                                            disabled={!isPro}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Appears above Home Basics, highlighted with your primary color.
                                        </p>
                                        {!isPro && <UpgradeHint />}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <Label htmlFor="disclaimer" className="text-foreground">Disclaimer</Label>
                                            <span className="text-[11px] tabular-nums text-muted-foreground">
                                                {(formData.disclaimer_text || '').length}/{BRAND_PROFILE_LIMITS.disclaimerTextMax}
                                            </span>
                                        </div>
                                        <Textarea
                                            id="disclaimer"
                                            placeholder="Add any legal disclaimers or additional notes..."
                                            value={formData.disclaimer_text || ''}
                                            onChange={(e) => updateField('disclaimer_text', e.target.value)}
                                            maxLength={BRAND_PROFILE_LIMITS.disclaimerTextMax}
                                            className="bg-background border-input text-foreground placeholder:text-muted-foreground min-h-[80px]"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Printed at the end of the document, after Buyer Next Steps. Available on every plan.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border bg-card">
                                <CardHeader>
                                    <CardTitle className="text-foreground flex items-center gap-2">
                                        <ListChecks className="h-5 w-5 text-primary" aria-hidden="true" />
                                        Buyer Next Steps
                                        {!isPro && <ProChip />}
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        The numbered checklist printed for buyers at the end of every document.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {!usingCustomSteps ? (
                                        <>
                                            <div className="rounded-lg border border-border bg-muted/40 p-3">
                                                <p className="text-xs font-medium text-muted-foreground mb-2">Using the standard steps:</p>
                                                <ol className="space-y-1.5">
                                                    {DEFAULT_BUYER_STEPS.map((step, index) => (
                                                        <li key={index} className="flex gap-2 text-sm text-foreground/80 items-start">
                                                            <span className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center">
                                                                {index + 1}
                                                            </span>
                                                            <span className="leading-relaxed">{step}</span>
                                                        </li>
                                                    ))}
                                                </ol>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={!isPro}
                                                onClick={() => updateField('buyer_next_steps', [...DEFAULT_BUYER_STEPS])}
                                            >
                                                <Pencil className="h-4 w-4 mr-1" />
                                                Customize steps
                                            </Button>
                                            {!isPro && <UpgradeHint />}
                                        </>
                                    ) : (
                                        <>
                                            <div className="space-y-2">
                                                <Label htmlFor="nextStepsTitle" className="text-foreground">Section title</Label>
                                                <Input
                                                    id="nextStepsTitle"
                                                    placeholder="Buyer Next Steps"
                                                    value={formData.next_steps_title || ''}
                                                    onChange={(e) => updateField('next_steps_title', e.target.value)}
                                                    maxLength={BRAND_PROFILE_LIMITS.nextStepsTitleMax}
                                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                                    disabled={!isPro}
                                                />
                                                <p className="text-xs text-muted-foreground">Leave blank to use &quot;Buyer Next Steps&quot;.</p>
                                            </div>

                                            <div className="space-y-3">
                                                <Label className="text-foreground">Steps</Label>
                                                {(formData.buyer_next_steps || []).map((step, index) => (
                                                    <div key={index} className="flex items-start gap-2">
                                                        <div className="flex items-center justify-center w-6 h-6 mt-2 rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0">
                                                            {index + 1}
                                                        </div>
                                                        <Textarea
                                                            value={step}
                                                            aria-label={`Step ${index + 1}`}
                                                            onChange={(e) => {
                                                                const newSteps = [...(formData.buyer_next_steps || [])];
                                                                newSteps[index] = e.target.value;
                                                                updateField('buyer_next_steps', newSteps);
                                                            }}
                                                            maxLength={BRAND_PROFILE_LIMITS.buyerNextStepMax}
                                                            className="bg-background border-input text-foreground min-h-[60px] flex-1"
                                                            disabled={!isPro}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label={`Remove step ${index + 1}`}
                                                            className="text-muted-foreground hover:text-destructive flex-shrink-0 mt-1"
                                                            disabled={!isPro}
                                                            onClick={() => {
                                                                const currentSteps = formData.buyer_next_steps || [];
                                                                if (currentSteps.length > 1) {
                                                                    updateField('buyer_next_steps', currentSteps.filter((_, i) => i !== index));
                                                                } else {
                                                                    toast.error('Remove the last step with "Use standard steps" below');
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const currentSteps = formData.buyer_next_steps || [];
                                                        if (currentSteps.length >= BRAND_PROFILE_LIMITS.buyerNextStepsMaxItems) {
                                                            toast.error(`Limit: ${BRAND_PROFILE_LIMITS.buyerNextStepsMaxItems} steps`);
                                                            return;
                                                        }
                                                        updateField('buyer_next_steps', [...currentSteps, '']);
                                                    }}
                                                    disabled={!isPro || (formData.buyer_next_steps || []).length >= BRAND_PROFILE_LIMITS.buyerNextStepsMaxItems}
                                                >
                                                    <Plus className="h-4 w-4 mr-1" />
                                                    Add step
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        // Explicit null clears the custom list on save.
                                                        updateField('buyer_next_steps', null);
                                                        updateField('next_steps_title', '');
                                                        toast.success('Back to the standard steps. Save to apply.');
                                                    }}
                                                    className="text-muted-foreground"
                                                    disabled={!isPro}
                                                >
                                                    <RotateCcw className="h-4 w-4 mr-1" />
                                                    Use standard steps
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-border bg-card">
                                <CardHeader>
                                    <CardTitle className="text-foreground flex items-center gap-2">
                                        <Settings2 className="h-5 w-5 text-primary" aria-hidden="true" />
                                        Display options
                                        {!isPro && <ProChip />}
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Small print shown on the document. Free plans always show both.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="showPoweredBy" className="text-foreground">Show &quot;Powered by utilitysheet.com&quot;</Label>
                                            <p className="text-xs text-muted-foreground">Printed in the page footer of the PDF.</p>
                                        </div>
                                        <Switch
                                            id="showPoweredBy"
                                            checked={isPro ? (formData.show_powered_by ?? true) : true}
                                            onCheckedChange={(checked) => updateField('show_powered_by', checked)}
                                            disabled={!isPro}
                                            aria-label='Show "Powered by utilitysheet.com"'
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="showGenerationDate" className="text-foreground">Show &quot;Generated on&quot; date</Label>
                                            <p className="text-xs text-muted-foreground">Shows the request date under the property address.</p>
                                        </div>
                                        <Switch
                                            id="showGenerationDate"
                                            checked={isPro ? (formData.show_generation_date ?? true) : true}
                                            onCheckedChange={(checked) => updateField('show_generation_date', checked)}
                                            disabled={!isPro}
                                            aria-label='Show "Generated on" date'
                                        />
                                    </div>
                                    {!isPro && <UpgradeHint />}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ---------------------------------------------- Messages tab */}
                        <TabsContent value="messages" className="mt-4 space-y-6">
                            <Card className="border-border bg-card">
                                <CardHeader>
                                    <CardTitle className="text-foreground flex items-center gap-2">
                                        <Palette className="h-5 w-5 text-primary" aria-hidden="true" />
                                        Email accent color
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Used in branded emails sent to sellers. PDFs and the seller form use your primary color only.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 sm:max-w-xs">
                                        <Label htmlFor="secondaryColor" className="text-foreground">Secondary color</Label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                id="secondaryColor"
                                                aria-label="Pick email accent color"
                                                value={HEX_COLOR_PATTERN.test(formData.secondary_color) ? formData.secondary_color : '#059669'}
                                                onChange={(e) => updateField('secondary_color', e.target.value)}
                                                className="w-10 h-10 rounded-lg cursor-pointer border-0 shrink-0"
                                            />
                                            <Input
                                                value={formData.secondary_color}
                                                onChange={(e) => updateField('secondary_color', e.target.value)}
                                                aria-label="Secondary color hex value"
                                                aria-invalid={secondaryColorInvalid}
                                                className="bg-background border-input text-foreground font-mono uppercase"
                                            />
                                        </div>
                                        {secondaryColorInvalid && (
                                            <p className="text-xs text-destructive" role="alert">Enter a hex color like #059669.</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border bg-card">
                                <CardHeader className="flex flex-row items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <CardTitle className="text-foreground flex items-center gap-2">
                                            <MessageSquare className="h-5 w-5 text-primary" aria-hidden="true" />
                                            Request message templates
                                        </CardTitle>
                                        <CardDescription className="text-muted-foreground">
                                            The text and email wording used when you send seller requests with this profile. These never
                                            appear on the PDF.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-muted-foreground shrink-0"
                                        onClick={() => {
                                            updateField('message_templates', {});
                                            toast.success('Templates reset to defaults. Save to apply.');
                                        }}
                                    >
                                        <RotateCcw className="h-4 w-4 mr-1" />
                                        Reset
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <MessageTemplatesEditor
                                        templates={formData.message_templates || {}}
                                        onChange={(updater) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                message_templates: updater(prev.message_templates || {}),
                                            }))
                                        }
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>

                    {/* Sticky save bar */}
                    <div className="sticky bottom-0 z-10 mt-6 -mx-3 sm:mx-0 border-t border-border bg-background/95 px-3 sm:px-0 py-3 backdrop-blur">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground" aria-live="polite">
                                {isDirty ? 'Unsaved changes. The preview already reflects them.' : isEditing ? 'All changes saved.' : ''}
                            </p>
                            <div className="flex gap-3 shrink-0">
                                <Button
                                    variant="outline"
                                    className="border-input text-muted-foreground hover:bg-muted"
                                    onClick={() => router.back()}
                                    disabled={loading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={!canSave || (isEditing && !isDirty)}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            {isEditing ? 'Save changes' : 'Create profile'}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Preview below the editor on small screens */}
                    <div className="lg:hidden mt-8">
                        {previewColumn}
                    </div>
                </div>

                {/* Sticky preview column on large screens */}
                <div className="hidden lg:block">
                    <div className="sticky top-8">
                        {previewColumn}
                    </div>
                </div>
            </div>
        </div>
    );
}
