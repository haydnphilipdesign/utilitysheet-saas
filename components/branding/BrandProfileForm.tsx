'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Save, Palette, Upload, X, ImageIcon, Plus, Trash2, RotateCcw, GripVertical, Settings2, ListChecks, Lock, FileDown, Mail, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import type { BrandProfileFormData } from '@/types';
import { DEFAULT_BUYER_STEPS } from '@/lib/constants';
import { BRAND_PROFILE_LIMITS } from '@/lib/branding/limits';
import UtilitySheetPdfPreview from './UtilitySheetPdfPreview';
import { generateTestPdf } from '@/lib/test-pdf-generator';
import { DEFAULT_MESSAGE_TEMPLATES } from '@/lib/message-templates';

interface BrandProfileFormProps {
    initialData?: BrandProfileFormData;
    onSubmit: (data: BrandProfileFormData) => Promise<void>;
    isEditing?: boolean;
    isPro?: boolean;
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
    // Advanced customization defaults
    buyer_next_steps: undefined, // undefined = use defaults
    next_steps_title: '',
    show_powered_by: true,
    show_generation_date: true,
    welcome_message: '',
    message_templates: {},
};

export default function BrandProfileForm({ initialData, onSubmit, isEditing = false, isPro = false }: BrandProfileFormProps) {
    const router = useRouter();
    const [formData, setFormData] = useState<BrandProfileFormData>(() => ({
        ...defaultFormData,
        ...(initialData || {}),
        message_templates: initialData?.message_templates || {},
    }));
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const updateField = <K extends keyof BrandProfileFormData>(field: K, value: BrandProfileFormData[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const updateMessageTemplates = (
        updater: (prev: NonNullable<BrandProfileFormData['message_templates']>) => NonNullable<BrandProfileFormData['message_templates']>
    ) => {
        setFormData((prev) => ({
            ...prev,
            message_templates: updater(prev.message_templates || {}),
        }));
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Invalid file type. Please use JPEG, PNG, WebP, or SVG.');
            return;
        }

        // Validate file size (2MB max)
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
            toast.success('Logo uploaded successfully!');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to upload logo');
        } finally {
            setUploading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveLogo = () => {
        updateField('logo_url', undefined);
        toast.success('Logo removed');
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await onSubmit(formData);
        } catch (error) {
            console.error('Error submitting form:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateTestPdf = async () => {
        setGeneratingPdf(true);
        try {
            await generateTestPdf(formData);
            toast.success('Test PDF downloaded!');
        } catch (error) {
            console.error('Error generating test PDF:', error);
            toast.error('Failed to generate test PDF');
        } finally {
            setGeneratingPdf(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
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
                <h1 className="text-3xl font-bold text-foreground">{isEditing ? 'Edit Branding Profile' : 'New Branding Profile'}</h1>
                <p className="text-muted-foreground mt-1">{isEditing ? 'Update your custom look' : 'Create a custom look for your utility info sheets'}</p>
            </div>

            {/* Two-column layout: Form on left, Preview on right */}
            <div className="grid lg:grid-cols-[1fr_400px] gap-8">
                {/* Left Column: Form Cards */}
                <div className="space-y-6">
                    {/* Brand Identity */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <Palette className="h-5 w-5 text-primary" />
                                Brand Identity
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Set your brand name and colors
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-foreground">Brand Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g., Your Real Estate Team"
                                    value={formData.name}
                                    onChange={(e) => updateField('name', e.target.value)}
                                    maxLength={BRAND_PROFILE_LIMITS.brandNameMax}
                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-foreground">Logo</Label>
                                <div className="flex items-center gap-4">
                                    {/* Logo Preview */}
                                    <div className="relative w-20 h-20 rounded-lg bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden group">
                                        {formData.logo_url ? (
                                            <>
                                                <Image
                                                    src={formData.logo_url}
                                                    alt="Brand logo"
                                                    fill
                                                    className="object-contain"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveLogo}
                                                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="h-6 w-6 text-white" />
                                                </button>
                                            </>
                                        ) : uploading ? (
                                            <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                                        ) : (
                                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/svg+xml"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                            id="logo-upload"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                            className="w-full"
                                        >
                                            {uploading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Uploading...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    {formData.logo_url ? 'Replace Logo' : 'Upload Logo'}
                                                </>
                                            )}
                                        </Button>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            JPEG, PNG, WebP, or SVG. Max 2MB.
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Recommended: 200×200px minimum. Square or horizontal logos work best.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="primaryColor" className="text-foreground">Primary Color</Label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            id="primaryColor"
                                            value={formData.primary_color}
                                            onChange={(e) => updateField('primary_color', e.target.value)}
                                            className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                        />
                                        <Input
                                            value={formData.primary_color}
                                            onChange={(e) => updateField('primary_color', e.target.value)}
                                            className="bg-background border-input text-foreground font-mono uppercase"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="secondaryColor" className="text-foreground">Secondary Color</Label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            id="secondaryColor"
                                            value={formData.secondary_color}
                                            onChange={(e) => updateField('secondary_color', e.target.value)}
                                            className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                        />
                                        <Input
                                            value={formData.secondary_color}
                                            onChange={(e) => updateField('secondary_color', e.target.value)}
                                            className="bg-background border-input text-foreground font-mono uppercase"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contact Information */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="text-foreground">Contact Information</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Shown on the info sheet for buyer questions
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="contactName" className="text-foreground">Agent/Team Name</Label>
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
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Additional Options */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="text-foreground">Additional Options</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="disclaimer" className="text-foreground">Footer Disclaimer (optional)</Label>
                                <Textarea
                                    id="disclaimer"
                                    placeholder="Add any legal disclaimers or additional notes..."
                                    value={formData.disclaimer_text || ''}
                                    onChange={(e) => updateField('disclaimer_text', e.target.value)}
                                    maxLength={BRAND_PROFILE_LIMITS.disclaimerTextMax}
                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground min-h-[80px]"
                                />
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="isDefault"
                                    checked={formData.is_default}
                                    onCheckedChange={(checked: boolean | 'indeterminate') => updateField('is_default', checked === true)}
                                    disabled={!isPro}
                                />
                                <label
                                    htmlFor="isDefault"
                                    className={`text-sm ${isPro ? 'text-foreground cursor-pointer' : 'text-muted-foreground cursor-not-allowed'}`}
                                >
                                    Set as default branding profile {!isPro ? '(Pro)' : ''}
                                </label>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Request Message Templates */}
                    <Card className="border-border bg-card">
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                            <div className="space-y-1">
                                <CardTitle className="text-foreground flex items-center gap-2">
                                    <MessageSquare className="h-5 w-5 text-violet-500" />
                                    Request Message Templates
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    Customize the default SMS and email text used when sending seller requests
                                </CardDescription>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-muted-foreground"
                                onClick={() => {
                                    updateField('message_templates', {});
                                    toast.success('Templates reset to defaults');
                                }}
                            >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Reset
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="rounded-lg border border-border bg-muted/40 p-3">
                                <p className="text-xs text-muted-foreground">
                                    Available variables:{' '}
                                    <span className="font-mono">
                                        {'{{seller_first_name_with_space}}'} {'{{seller_name}}'} {'{{agent_name}}'} {'{{property_address}}'} {'{{closing_date}}'} {'{{link}}'}
                                    </span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Leave a field blank to use the default template.
                                </p>
                            </div>

                            <Tabs defaultValue="seller_request">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="seller_request">Seller Request</TabsTrigger>
                                    <TabsTrigger value="seller_reminder">Seller Reminder</TabsTrigger>
                                </TabsList>

                                <TabsContent value="seller_request" className="space-y-6 mt-4">
                                    {/* SMS */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                            <Label className="text-foreground">SMS (copy/share)</Label>
                                        </div>
                                        <Textarea
                                            value={formData.message_templates?.seller_request?.sms || ''}
                                            placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.sms || ''}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                updateMessageTemplates((prev) => ({
                                                    ...prev,
                                                    seller_request: {
                                                        ...(prev.seller_request || {}),
                                                        sms: value,
                                                    },
                                                }));
                                            }}
                                            className="bg-background border-input text-foreground placeholder:text-muted-foreground min-h-[80px]"
                                            maxLength={500}
                                        />
                                    </div>

                                    {/* Manual mailto */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            <Label className="text-foreground">Email (manual — mailto)</Label>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-foreground text-sm">Subject</Label>
                                                <Input
                                                    value={formData.message_templates?.seller_request?.mailto?.subject || ''}
                                                    placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.mailto?.subject || ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        updateMessageTemplates((prev) => ({
                                                            ...prev,
                                                            seller_request: {
                                                                ...(prev.seller_request || {}),
                                                                mailto: {
                                                                    ...(prev.seller_request?.mailto || {}),
                                                                    subject: value,
                                                                },
                                                            },
                                                        }));
                                                    }}
                                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                                    maxLength={200}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-foreground text-sm">Body</Label>
                                            <Textarea
                                                value={formData.message_templates?.seller_request?.mailto?.body || ''}
                                                placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.mailto?.body || ''}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    updateMessageTemplates((prev) => ({
                                                        ...prev,
                                                        seller_request: {
                                                            ...(prev.seller_request || {}),
                                                            mailto: {
                                                                ...(prev.seller_request?.mailto || {}),
                                                                body: value,
                                                            },
                                                        },
                                                    }));
                                                }}
                                                className="bg-background border-input text-foreground placeholder:text-muted-foreground min-h-[160px]"
                                                maxLength={6000}
                                            />
                                        </div>
                                    </div>

                                    {/* Automatic email */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            <Label className="text-foreground">Email (automatic)</Label>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-foreground text-sm">Subject</Label>
                                                <Input
                                                    value={formData.message_templates?.seller_request?.email?.subject || ''}
                                                    placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.email?.subject || ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        updateMessageTemplates((prev) => ({
                                                            ...prev,
                                                            seller_request: {
                                                                ...(prev.seller_request || {}),
                                                                email: {
                                                                    ...(prev.seller_request?.email || {}),
                                                                    subject: value,
                                                                },
                                                            },
                                                        }));
                                                    }}
                                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                                    maxLength={200}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-foreground text-sm">Button Text</Label>
                                                <Input
                                                    value={formData.message_templates?.seller_request?.email?.button_text || ''}
                                                    placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.email?.button_text || ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        updateMessageTemplates((prev) => ({
                                                            ...prev,
                                                            seller_request: {
                                                                ...(prev.seller_request || {}),
                                                                email: {
                                                                    ...(prev.seller_request?.email || {}),
                                                                    button_text: value,
                                                                },
                                                            },
                                                        }));
                                                    }}
                                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                                    maxLength={80}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-foreground text-sm">Body</Label>
                                            <Textarea
                                                value={formData.message_templates?.seller_request?.email?.body || ''}
                                                placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_request?.email?.body || ''}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    updateMessageTemplates((prev) => ({
                                                        ...prev,
                                                        seller_request: {
                                                            ...(prev.seller_request || {}),
                                                            email: {
                                                                ...(prev.seller_request?.email || {}),
                                                                body: value,
                                                            },
                                                        },
                                                    }));
                                                }}
                                                className="bg-background border-input text-foreground placeholder:text-muted-foreground min-h-[180px]"
                                                maxLength={12000}
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="seller_reminder" className="space-y-6 mt-4">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            <Label className="text-foreground">Email (automatic)</Label>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-foreground text-sm">Subject</Label>
                                                <Input
                                                    value={formData.message_templates?.seller_reminder?.email?.subject || ''}
                                                    placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_reminder?.email?.subject || ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        updateMessageTemplates((prev) => ({
                                                            ...prev,
                                                            seller_reminder: {
                                                                ...(prev.seller_reminder || {}),
                                                                email: {
                                                                    ...(prev.seller_reminder?.email || {}),
                                                                    subject: value,
                                                                },
                                                            },
                                                        }));
                                                    }}
                                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                                    maxLength={200}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-foreground text-sm">Button Text</Label>
                                                <Input
                                                    value={formData.message_templates?.seller_reminder?.email?.button_text || ''}
                                                    placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_reminder?.email?.button_text || ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        updateMessageTemplates((prev) => ({
                                                            ...prev,
                                                            seller_reminder: {
                                                                ...(prev.seller_reminder || {}),
                                                                email: {
                                                                    ...(prev.seller_reminder?.email || {}),
                                                                    button_text: value,
                                                                },
                                                            },
                                                        }));
                                                    }}
                                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                                    maxLength={80}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-foreground text-sm">Body</Label>
                                            <Textarea
                                                value={formData.message_templates?.seller_reminder?.email?.body || ''}
                                                placeholder={DEFAULT_MESSAGE_TEMPLATES.seller_reminder?.email?.body || ''}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    updateMessageTemplates((prev) => ({
                                                        ...prev,
                                                        seller_reminder: {
                                                            ...(prev.seller_reminder || {}),
                                                            email: {
                                                                ...(prev.seller_reminder?.email || {}),
                                                                body: value,
                                                            },
                                                        },
                                                    }));
                                                }}
                                                className="bg-background border-input text-foreground placeholder:text-muted-foreground min-h-[180px]"
                                                maxLength={12000}
                                            />
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    {/* Display Options */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <Settings2 className="h-5 w-5 text-blue-500" />
                                Display Options
                                {!isPro && (
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                                        <Lock className="h-3 w-3" />
                                        Pro
                                    </span>
                                )}
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Control what appears on your info sheets
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-foreground">Show &quot;Powered by UtilitySheet&quot;</Label>
                                    <p className="text-xs text-muted-foreground">Display powered by text in the footer</p>
                                </div>
                                <Switch
                                    checked={isPro ? (formData.show_powered_by ?? true) : true}
                                    onCheckedChange={(checked) => updateField('show_powered_by', checked)}
                                    disabled={!isPro}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-foreground">Show Generation Date</Label>
                                    <p className="text-xs text-muted-foreground">Display when the info sheet was generated</p>
                                </div>
                                <Switch
                                    checked={isPro ? (formData.show_generation_date ?? true) : true}
                                    onCheckedChange={(checked) => updateField('show_generation_date', checked)}
                                    disabled={!isPro}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="welcomeMessage" className="text-foreground">Welcome Message (optional)</Label>
                                <Textarea
                                    id="welcomeMessage"
                                    placeholder="Add a brief message that appears above the utility list..."
                                    value={formData.welcome_message || ''}
                                    onChange={(e) => updateField('welcome_message', e.target.value)}
                                    maxLength={BRAND_PROFILE_LIMITS.welcomeMessageMax}
                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground min-h-[60px]"
                                    disabled={!isPro}
                                />
                                <p className="text-xs text-muted-foreground">This message will appear above the utility providers table.</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Buyer Next Steps */}
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <ListChecks className="h-5 w-5 text-primary" />
                                Buyer Next Steps
                                {!isPro && (
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                                        <Lock className="h-3 w-3" />
                                        Pro
                                    </span>
                                )}
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Customize the instructions shown to buyers
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="nextStepsTitle" className="text-foreground">Section Title</Label>
                                <Input
                                    id="nextStepsTitle"
                                    placeholder="Buyer Next Steps"
                                    value={formData.next_steps_title || ''}
                                    onChange={(e) => updateField('next_steps_title', e.target.value)}
                                    maxLength={BRAND_PROFILE_LIMITS.nextStepsTitleMax}
                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                    disabled={!isPro}
                                />
                                <p className="text-xs text-muted-foreground">Leave blank to use default: &quot;Buyer Next Steps&quot;</p>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-foreground">Steps</Label>
                                {(formData.buyer_next_steps || DEFAULT_BUYER_STEPS).map((step, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <div className="flex items-center justify-center w-6 h-6 mt-2 rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0">
                                            {index + 1}
                                        </div>
                                        <Textarea
                                            value={step}
                                            onChange={(e) => {
                                                const currentSteps = formData.buyer_next_steps || [...DEFAULT_BUYER_STEPS];
                                                const newSteps = [...currentSteps];
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
                                            className="text-muted-foreground hover:text-destructive flex-shrink-0 mt-1"
                                            disabled={!isPro}
                                            onClick={() => {
                                                const currentSteps = formData.buyer_next_steps || [...DEFAULT_BUYER_STEPS];
                                                if (currentSteps.length > 1) {
                                                    const newSteps = currentSteps.filter((_, i) => i !== index);
                                                    updateField('buyer_next_steps', newSteps);
                                                } else {
                                                    toast.error('You must have at least one step');
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const currentSteps = formData.buyer_next_steps || [...DEFAULT_BUYER_STEPS];
                                        if (currentSteps.length >= BRAND_PROFILE_LIMITS.buyerNextStepsMaxItems) {
                                            toast.error(`Limit: ${BRAND_PROFILE_LIMITS.buyerNextStepsMaxItems} steps`);
                                            return;
                                        }
                                        updateField('buyer_next_steps', [...currentSteps, '']);
                                    }}
                                    className="flex-1"
                                    disabled={!isPro || (formData.buyer_next_steps || DEFAULT_BUYER_STEPS).length >= BRAND_PROFILE_LIMITS.buyerNextStepsMaxItems}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Step
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        updateField('buyer_next_steps', undefined);
                                        toast.success('Steps reset to defaults');
                                    }}
                                    className="text-muted-foreground"
                                    disabled={!isPro}
                                >
                                    <RotateCcw className="h-4 w-4 mr-1" />
                                    Reset to Defaults
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex justify-end gap-4">
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
                            disabled={loading || !formData.name}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    {isEditing ? 'Update Profile' : 'Save Profile'}
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Right Column: Live PDF Preview */}
                <div className="hidden lg:block">
                    <div className="sticky top-8 space-y-4">
                        <UtilitySheetPdfPreview branding={formData} />
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={handleGenerateTestPdf}
                            disabled={generatingPdf}
                        >
                            {generatingPdf ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Generate Test PDF
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
