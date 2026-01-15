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
import { ArrowLeft, Loader2, Save, Palette, Upload, X, ImageIcon, Plus, Trash2, RotateCcw, GripVertical, Settings2, ListChecks, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { BrandProfileFormData } from '@/types';
import { DEFAULT_BUYER_STEPS } from '@/lib/constants';
import UtilitySheetPdfPreview from './UtilitySheetPdfPreview';

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
};

export default function BrandProfileForm({ initialData, onSubmit, isEditing = false, isPro = false }: BrandProfileFormProps) {
    const router = useRouter();
    const [formData, setFormData] = useState<BrandProfileFormData>(initialData || defaultFormData);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const updateField = <K extends keyof BrandProfileFormData>(field: K, value: BrandProfileFormData[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
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
                                <Palette className="h-5 w-5 text-emerald-500" />
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
                                <ListChecks className="h-5 w-5 text-emerald-500" />
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
                                    className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                                    disabled={!isPro}
                                />
                                <p className="text-xs text-muted-foreground">Leave blank to use default: &quot;Buyer Next Steps&quot;</p>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-foreground">Steps</Label>
                                {(formData.buyer_next_steps || DEFAULT_BUYER_STEPS).map((step, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <div className="flex items-center justify-center w-6 h-6 mt-2 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex-shrink-0">
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
                                        updateField('buyer_next_steps', [...currentSteps, '']);
                                    }}
                                    className="flex-1"
                                    disabled={!isPro}
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
                            className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white"
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
                    <div className="sticky top-8">
                        <UtilitySheetPdfPreview branding={formData} />
                    </div>
                </div>
            </div>
        </div>
    );
}
