'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, Save, Palette, Upload } from 'lucide-react';
import type { BrandProfileFormData } from '@/types';

interface BrandProfileFormProps {
    initialData?: BrandProfileFormData;
    onSubmit: (data: BrandProfileFormData) => Promise<void>;
    isEditing?: boolean;
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
};

export default function BrandProfileForm({ initialData, onSubmit, isEditing = false }: BrandProfileFormProps) {
    const router = useRouter();
    const [formData, setFormData] = useState<BrandProfileFormData>(initialData || defaultFormData);
    const [loading, setLoading] = useState(false);

    const updateField = <K extends keyof BrandProfileFormData>(field: K, value: BrandProfileFormData[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
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
        <div className="max-w-3xl mx-auto">
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
                <p className="text-muted-foreground mt-1">{isEditing ? 'Update your custom look' : 'Create a custom look for your utility packets'}</p>
            </div>

            <div className="grid gap-6">
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
                                <div className="w-20 h-20 rounded-lg bg-muted border-2 border-dashed border-border flex items-center justify-center">
                                    <Upload className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div className="flex-1">
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        className="bg-background border-input text-foreground"
                                        disabled
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Logo upload coming soon</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
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
                            Shown on the packet for buyer questions
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
                            />
                            <label
                                htmlFor="isDefault"
                                className="text-sm text-foreground cursor-pointer"
                            >
                                Set as default branding profile
                            </label>
                        </div>
                    </CardContent>
                </Card>

                {/* Preview */}
                <Card className="border-border bg-card">
                    <CardHeader>
                        <CardTitle className="text-foreground">Preview</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            How your branding will appear on packets
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-6 rounded-lg bg-secondary/50 border border-border">
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                                    style={{ backgroundColor: formData.primary_color }}
                                >
                                    {formData.name
                                        ? formData.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                                        : 'BR'
                                    }
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground">
                                        {formData.name || 'Brand Name'}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {formData.contact_name || 'Agent Name'} • {formData.contact_phone || '(555) 123-4567'}
                                    </p>
                                </div>
                            </div>
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
                        className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
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
        </div>
    );
}
