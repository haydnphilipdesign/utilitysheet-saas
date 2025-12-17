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

const initialFormData: BrandProfileFormData = {
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

export default function NewBrandingPage() {
    const router = useRouter();
    const [formData, setFormData] = useState<BrandProfileFormData>(initialFormData);
    const [loading, setLoading] = useState(false);

    const updateField = <K extends keyof BrandProfileFormData>(field: K, value: BrandProfileFormData[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setLoading(true);
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000));
        router.push('/dashboard/branding');
    };

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <Button
                    variant="ghost"
                    className="text-zinc-400 hover:text-white mb-4"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
                <h1 className="text-3xl font-bold text-white">New Branding Profile</h1>
                <p className="text-zinc-400 mt-1">Create a custom look for your utility packets</p>
            </div>

            <div className="grid gap-6">
                {/* Brand Identity */}
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Palette className="h-5 w-5 text-emerald-400" />
                            Brand Identity
                        </CardTitle>
                        <CardDescription className="text-zinc-400">
                            Set your brand name and colors
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-zinc-300">Brand Name *</Label>
                            <Input
                                id="name"
                                placeholder="e.g., Your Real Estate Team"
                                value={formData.name}
                                onChange={(e) => updateField('name', e.target.value)}
                                className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-zinc-300">Logo</Label>
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-lg bg-zinc-800 border-2 border-dashed border-zinc-700 flex items-center justify-center">
                                    <Upload className="h-6 w-6 text-zinc-500" />
                                </div>
                                <div className="flex-1">
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        className="bg-zinc-800/50 border-zinc-700 text-white"
                                    />
                                    <p className="text-xs text-zinc-500 mt-1">PNG or JPG, max 2MB</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="primaryColor" className="text-zinc-300">Primary Color</Label>
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
                                        className="bg-zinc-800/50 border-zinc-700 text-white font-mono uppercase"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="secondaryColor" className="text-zinc-300">Secondary Color</Label>
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
                                        className="bg-zinc-800/50 border-zinc-700 text-white font-mono uppercase"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Contact Information */}
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader>
                        <CardTitle className="text-white">Contact Information</CardTitle>
                        <CardDescription className="text-zinc-400">
                            Shown on the packet for buyer questions
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contactName" className="text-zinc-300">Agent/Team Name</Label>
                                <Input
                                    id="contactName"
                                    placeholder="Jane Smith"
                                    value={formData.contact_name || ''}
                                    onChange={(e) => updateField('contact_name', e.target.value)}
                                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contactPhone" className="text-zinc-300">Phone</Label>
                                <Input
                                    id="contactPhone"
                                    type="tel"
                                    placeholder="(555) 123-4567"
                                    value={formData.contact_phone || ''}
                                    onChange={(e) => updateField('contact_phone', e.target.value)}
                                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contactEmail" className="text-zinc-300">Email</Label>
                                <Input
                                    id="contactEmail"
                                    type="email"
                                    placeholder="agent@realty.com"
                                    value={formData.contact_email || ''}
                                    onChange={(e) => updateField('contact_email', e.target.value)}
                                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contactWebsite" className="text-zinc-300">Website</Label>
                                <Input
                                    id="contactWebsite"
                                    placeholder="yourrealty.com"
                                    value={formData.contact_website || ''}
                                    onChange={(e) => updateField('contact_website', e.target.value)}
                                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Additional Options */}
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader>
                        <CardTitle className="text-white">Additional Options</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="disclaimer" className="text-zinc-300">Footer Disclaimer (optional)</Label>
                            <Textarea
                                id="disclaimer"
                                placeholder="Add any legal disclaimers or additional notes..."
                                value={formData.disclaimer_text || ''}
                                onChange={(e) => updateField('disclaimer_text', e.target.value)}
                                className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 min-h-[80px]"
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
                                className="text-sm text-zinc-300 cursor-pointer"
                            >
                                Set as default branding profile
                            </label>
                        </div>
                    </CardContent>
                </Card>

                {/* Preview */}
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader>
                        <CardTitle className="text-white">Preview</CardTitle>
                        <CardDescription className="text-zinc-400">
                            How your branding will appear on packets
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-6 rounded-lg bg-zinc-800/50 border border-zinc-700">
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
                                    <h3 className="font-semibold text-white">
                                        {formData.name || 'Brand Name'}
                                    </h3>
                                    <p className="text-sm text-zinc-400">
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
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        onClick={() => router.back()}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
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
                                Save Profile
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
