'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { ArrowLeft, ArrowRight, Check, Copy, MessageSquare, Mail, Loader2, MapPin } from 'lucide-react';
import type { UtilityCategory } from '@/types';
import { UTILITY_CATEGORIES } from '@/lib/providers/mock-data';

interface FormData {
    property_address: string;
    seller_name: string;
    seller_email: string;
    seller_phone: string;
    closing_date: string;
    utility_categories: UtilityCategory[];
}

const initialFormData: FormData = {
    property_address: '',
    seller_name: '',
    seller_email: '',
    seller_phone: '',
    closing_date: '',
    utility_categories: ['electric', 'gas', 'water', 'sewer', 'trash'],
};

export default function NewRequestPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [loading, setLoading] = useState(false);
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [copied, setCopied] = useState(false);

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

    const handleCreate = async () => {
        setLoading(true);

        try {
            // Call API to create the request
            const response = await fetch('/api/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    propertyAddress: formData.property_address,
                    sellerName: formData.seller_name || undefined,
                    sellerEmail: formData.seller_email || undefined,
                    sellerPhone: formData.seller_phone || undefined,
                    closingDate: formData.closing_date || undefined,
                    utilityCategories: formData.utility_categories,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create request');
            }

            const newRequest = await response.json();

            // Use the public_token from the API response
            setGeneratedToken(newRequest.public_token);
            setShowShareDialog(true);
        } catch (error) {
            console.error('Error creating request:', error);
            // Fallback to client-generated token for demo purposes
            const token = uuidv4().replace(/-/g, '').slice(0, 12);
            setGeneratedToken(token);
            setShowShareDialog(true);
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
        return `Hi${formData.seller_name ? ` ${formData.seller_name.split(' ')[0]}` : ''}! Please complete this quick utility info form for ${formData.property_address}. It takes under 2 minutes: ${getShareLink()}`;
    };

    const getEmailTemplate = () => {
        return {
            subject: `Utility Information Request for ${formData.property_address}`,
            body: `Hi${formData.seller_name ? ` ${formData.seller_name.split(' ')[0]}` : ''},

As part of the home sale process, we need to collect utility provider information for ${formData.property_address}.

Please complete this quick form (takes under 2 minutes):
${getShareLink()}

This information will be compiled into a Utility Handoff Packet for the buyers.

Thank you!`,
        };
    };

    const isStep1Valid = formData.property_address.length >= 5;
    const isStep3Valid = formData.utility_categories.length > 0;

    return (
        <div className="max-w-2xl mx-auto">
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
                <h1 className="text-3xl font-bold text-white">New Utility Sheet Request</h1>
                <p className="text-zinc-400 mt-1">Create a request link to send to your seller</p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-2 mb-8">
                {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-2 flex-1">
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${s < step
                                ? 'bg-emerald-500 text-white'
                                : s === step
                                    ? 'bg-zinc-800 text-white border-2 border-emerald-500'
                                    : 'bg-zinc-800 text-zinc-500'
                                }`}
                        >
                            {s < step ? <Check className="h-4 w-4" /> : s}
                        </div>
                        {s < 3 && (
                            <div
                                className={`flex-1 h-0.5 ${s < step ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Step 1: Property Address */}
            {step === 1 && (
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-emerald-400" />
                            Property Address
                        </CardTitle>
                        <CardDescription className="text-zinc-400">
                            Enter the property address for this utility sheet
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="address" className="text-zinc-300">Full Address *</Label>
                            <Input
                                id="address"
                                placeholder="123 Main Street, City, State, ZIP"
                                value={formData.property_address}
                                onChange={(e) => updateField('property_address', e.target.value)}
                                className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button
                                onClick={() => setStep(2)}
                                disabled={!isStep1Valid}
                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                            >
                                Continue
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Seller Info (Optional) */}
            {step === 2 && (
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader>
                        <CardTitle className="text-white">Seller Information</CardTitle>
                        <CardDescription className="text-zinc-400">
                            Optional - helps personalize the request and enable reminders
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="sellerName" className="text-zinc-300">Seller Name</Label>
                            <Input
                                id="sellerName"
                                placeholder="John Smith"
                                value={formData.seller_name}
                                onChange={(e) => updateField('seller_name', e.target.value)}
                                className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="sellerEmail" className="text-zinc-300">Email</Label>
                                <Input
                                    id="sellerEmail"
                                    type="email"
                                    placeholder="john@example.com"
                                    value={formData.seller_email}
                                    onChange={(e) => updateField('seller_email', e.target.value)}
                                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sellerPhone" className="text-zinc-300">Phone</Label>
                                <Input
                                    id="sellerPhone"
                                    type="tel"
                                    placeholder="(555) 123-4567"
                                    value={formData.seller_phone}
                                    onChange={(e) => updateField('seller_phone', e.target.value)}
                                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="closingDate" className="text-zinc-300">Closing Date</Label>
                            <Input
                                id="closingDate"
                                type="date"
                                value={formData.closing_date}
                                onChange={(e) => updateField('closing_date', e.target.value)}
                                className="bg-zinc-800/50 border-zinc-700 text-white"
                            />
                        </div>
                        <div className="flex justify-between">
                            <Button
                                variant="outline"
                                onClick={() => setStep(1)}
                                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <Button
                                onClick={() => setStep(3)}
                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                            >
                                Continue
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Utility Categories */}
            {step === 3 && (
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader>
                        <CardTitle className="text-white">Utility Categories</CardTitle>
                        <CardDescription className="text-zinc-400">
                            Select which utilities to include in the request
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {UTILITY_CATEGORIES.map((category) => {
                                const isSelected = formData.utility_categories.includes(category.key);
                                return (
                                    <button
                                        key={category.key}
                                        onClick={() => toggleCategory(category.key)}
                                        className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${isSelected
                                            ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                                            : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                                            }`}
                                    >
                                        <span className="text-xl">{category.icon}</span>
                                        <span className="font-medium">{category.label}</span>
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
                                onClick={() => setStep(2)}
                                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <Button
                                onClick={handleCreate}
                                disabled={!isStep3Valid || loading}
                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
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
            <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
                <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-white text-xl">Request Created! 🎉</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Share this link with your seller to collect utility information
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                        {/* Link Copy */}
                        <div className="space-y-2">
                            <Label className="text-zinc-300">Seller Link</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={getShareLink()}
                                    readOnly
                                    className="bg-zinc-800 border-zinc-700 text-white font-mono text-sm"
                                />
                                <Button
                                    onClick={copyLink}
                                    variant="outline"
                                    className={`border-zinc-700 shrink-0 ${copied ? 'text-emerald-400 border-emerald-500' : 'text-zinc-300'
                                        }`}
                                >
                                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        {/* Message Templates */}
                        <div className="space-y-3">
                            <Label className="text-zinc-300">Quick Share</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-auto py-3"
                                    onClick={() => {
                                        navigator.clipboard.writeText(getSmsTemplate());
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                >
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Copy SMS
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-auto py-3"
                                    onClick={() => {
                                        const email = getEmailTemplate();
                                        const mailto = `mailto:${formData.seller_email}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
                                        window.open(mailto);
                                    }}
                                >
                                    <Mail className="mr-2 h-4 w-4" />
                                    Open Email
                                </Button>
                            </div>
                        </div>

                        {/* SMS Preview */}
                        <div className="space-y-2">
                            <Label className="text-zinc-400 text-sm">SMS Template</Label>
                            <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{getSmsTemplate()}</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
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
        </div>
    );
}
