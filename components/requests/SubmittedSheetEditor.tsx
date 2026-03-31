'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Loader2, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { UTILITY_CATEGORIES, UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import {
    ADVANCED_MODULE_FIELD_METADATA,
    ADVANCED_MODULE_LABELS,
    getAdvancedModuleVisibleFieldKeys,
    getEffectiveAdvancedModules,
} from '@/lib/packet/modules';
import type {
    AdvancedModuleKey,
    SubmittedSheetEditorPayload,
    TrashPickupDay,
    UtilityCategory,
} from '@/types';

const PICKUP_DAY_OPTIONS: Array<{ value: '' | TrashPickupDay; label: string }> = [
    { value: '', label: 'Not set' },
    { value: 'mon', label: 'Monday' },
    { value: 'tue', label: 'Tuesday' },
    { value: 'wed', label: 'Wednesday' },
    { value: 'thu', label: 'Thursday' },
    { value: 'fri', label: 'Friday' },
    { value: 'sat', label: 'Saturday' },
    { value: 'sun', label: 'Sunday' },
    { value: 'varies', label: 'Varies' },
    { value: 'not_sure', label: 'Not sure' },
];

const IRRIGATION_OPTIONS = [
    { value: '', label: 'Not set' },
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'not_sure', label: 'Not sure' },
] as const;

const WATERING_DAY_OPTIONS = [
    { value: 'mon', label: 'Mon' },
    { value: 'tue', label: 'Tue' },
    { value: 'wed', label: 'Wed' },
    { value: 'thu', label: 'Thu' },
    { value: 'fri', label: 'Fri' },
    { value: 'sat', label: 'Sat' },
    { value: 'sun', label: 'Sun' },
] as const;

function utilityLabel(category: UtilityCategory): string {
    return UTILITY_CATEGORIES.find((item) => item.key === category)?.label || category;
}

function isLongTextField(fieldKey: string): boolean {
    return ['notes', 'location', 'instructions'].some((token) => fieldKey.includes(token));
}

export function SubmittedSheetEditor({ requestId }: { requestId: string }) {
    const router = useRouter();
    const [data, setData] = useState<SubmittedSheetEditorPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/requests/${requestId}/submitted-data`);
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                setData(null);
                setError(result.message || result.error || 'Unable to load the submitted info sheet editor.');
                return;
            }

            setData(result);
        } catch (loadError) {
            console.error('Failed to load submitted sheet editor:', loadError);
            setData(null);
            setError('Unable to load the submitted info sheet editor.');
        } finally {
            setLoading(false);
        }
    }, [requestId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const visibleAdvancedModules = useMemo(() => {
        if (!data) return [] as AdvancedModuleKey[];
        return getEffectiveAdvancedModules(
            data.request.advancedModules,
            data.request.advancedModuleExclusions
        );
    }, [data]);

    const visibleUtilityCategories = useMemo(() => {
        if (!data) return [] as UtilityCategory[];
        return UTILITY_CATEGORY_KEYS.filter((category) => Boolean(data.editor.utilities[category]));
    }, [data]);

    const updateUtilityField = <K extends 'providerName' | 'contactPhone' | 'contactUrl' | 'meterNumber'>(
        category: UtilityCategory,
        field: K,
        value: string
    ) => {
        setData((current) => {
            if (!current) return current;
            const existing = current.editor.utilities[category];
            if (!existing) return current;

            return {
                ...current,
                editor: {
                    ...current.editor,
                    utilities: {
                        ...current.editor.utilities,
                        [category]: {
                            ...existing,
                            [field]: value,
                        },
                    },
                },
            };
        });
    };

    const updateTrashField = (
        category: UtilityCategory,
        field: 'hasRecycling' | 'trashPickupDay' | 'recyclingPickupDay',
        value: string
    ) => {
        setData((current) => {
            if (!current) return current;
            const existing = current.editor.utilities[category];
            if (!existing) return current;

            return {
                ...current,
                editor: {
                    ...current.editor,
                    utilities: {
                        ...current.editor.utilities,
                        [category]: {
                            ...existing,
                            trashDetails: {
                                ...existing.trashDetails,
                                [field]: value,
                                ...(field === 'hasRecycling' && value === 'no'
                                    ? { recyclingPickupDay: '' }
                                    : {}),
                            },
                        },
                    },
                },
            };
        });
    };

    const updateAdvancedField = (moduleKey: AdvancedModuleKey, fieldKey: string, value: unknown) => {
        setData((current) => {
            if (!current) return current;
            const currentAdvanced = (current.editor.advanced || {}) as Record<string, unknown>;
            const currentModule = ((currentAdvanced[moduleKey] || {}) as Record<string, unknown>);

            return {
                ...current,
                editor: {
                    ...current.editor,
                    advanced: {
                        ...currentAdvanced,
                        [moduleKey]: {
                            ...currentModule,
                            [fieldKey]: value,
                        },
                    },
                },
            };
        });
    };

    const toggleWateringDay = (day: string, checked: boolean) => {
        if (!data) return;
        const currentAdvanced = (data.editor.advanced || {}) as Record<string, unknown>;
        const irrigation = ((currentAdvanced.irrigation_seasonal_controls || {}) as Record<string, unknown>);
        const currentDays = Array.isArray(irrigation.watering_days)
            ? irrigation.watering_days.map((value) => String(value))
            : [];
        const nextDays = checked
            ? Array.from(new Set([...currentDays, day]))
            : currentDays.filter((value) => value !== day);

        updateAdvancedField('irrigation_seasonal_controls', 'watering_days', nextDays);
    };

    const handleSave = async () => {
        if (!data) return;
        setSaving(true);

        try {
            const response = await fetch(`/api/requests/${requestId}/submitted-data`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    updatedAt: data.request.updatedAt,
                    propertyAddress: data.request.propertyAddress,
                    utilities: data.editor.utilities,
                    advanced: data.editor.advanced,
                }),
            });

            const result = await response.json().catch(() => ({}));

            if (response.status === 409) {
                toast.error(result.message || 'This sheet was updated elsewhere. Reloading the latest version.');
                await loadData();
                return;
            }

            if (!response.ok) {
                toast.error(result.message || result.error || 'Failed to save changes');
                return;
            }

            setData(result);
            toast.success('Info sheet updated');
        } catch (saveError) {
            console.error('Failed to save submitted sheet changes:', saveError);
            toast.error('Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="max-w-3xl mx-auto space-y-6">
                <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground px-0"
                    onClick={() => router.push(`/dashboard/requests/${requestId}`)}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Request
                </Button>

                <Card className="border-border bg-card/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-foreground">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Editor unavailable
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                            {error || 'Unable to load the submitted info sheet editor.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" className="border-input" onClick={() => void loadData()}>
                            Try Again
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                    <Button
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground px-0"
                        onClick={() => router.push(`/dashboard/requests/${requestId}`)}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Request
                    </Button>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-3xl font-bold text-foreground">Edit Submitted Info Sheet</h1>
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                            Submitted
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Changes update the live info sheet and future PDF downloads. Seller and public links stay read-only after submission, and any PDF that was already emailed stays as a past snapshot.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <Link href={`/dashboard/requests/${requestId}`}>
                        <Button variant="outline" className="border-input text-foreground hover:bg-muted">
                            Cancel
                        </Button>
                    </Link>
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="pt-6 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-foreground">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            <span className="font-medium">Editing safeguards</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            This editor saves directly against the submitted request. In Team workspaces, any teammate who already has access can make updates. If someone changes the sheet first, we’ll stop your save and reload the latest version instead of silently overwriting it.
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Seller</p>
                            <p className="text-sm text-foreground">{data.request.sellerName || 'Not provided'}</p>
                            <p className="text-xs text-muted-foreground">{data.request.sellerEmail || 'No email on file'}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Request Setup</p>
                            <p className="text-sm text-foreground">
                                {data.request.packetMode === 'advanced' ? 'Advanced Utility Packet' : 'Simple Utility Sheet'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Closing date: {data.request.closingDate || 'Not set'}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground">Property Address</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Update the address if you need to correct formatting, capitalization, or seller-entered typos before the next share or download.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Input
                        value={data.request.propertyAddress}
                        onChange={(event) => setData((current) => current ? {
                            ...current,
                            request: {
                                ...current.request,
                                propertyAddress: event.target.value,
                            },
                        } : current)}
                        placeholder="123 Main St, Anytown, ST 12345"
                    />
                </CardContent>
            </Card>

            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground">Packet Context</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        These home basics appear on the live info sheet and PDF but remain read-only in this first editing release.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
                    <div>
                        <p className="text-muted-foreground mb-1">Water source</p>
                        <p className="text-foreground capitalize">{data.request.waterSource?.replace('_', ' ') || 'Not set'}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground mb-1">Sewer type</p>
                        <p className="text-foreground capitalize">{data.request.sewerType?.replace('_', ' ') || 'Not set'}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground mb-1">Heating type</p>
                        <p className="text-foreground capitalize">{data.request.heatingType?.replace('_', ' ') || 'Not set'}</p>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-foreground">Utility Providers</h2>
                    <p className="text-sm text-muted-foreground">
                        Fix capitalization, swap providers, update address-specific providers, or add missing phone and website details for the live sheet.
                    </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    {visibleUtilityCategories.map((category) => {
                        const utility = data.editor.utilities[category];
                        if (!utility) return null;

                        const showMeterField = category === 'electric' && (
                            data.editor.collectElectricMeterNumber || utility.meterNumber.trim().length > 0
                        );

                        return (
                            <Card key={category} className="border-border bg-card/50">
                                <CardHeader className="space-y-1">
                                    <CardTitle className="text-base text-foreground">{utilityLabel(category)}</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Edit the provider details that appear on the packet and PDF.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">Provider name</label>
                                        <Input
                                            value={utility.providerName}
                                            onChange={(event) => updateUtilityField(category, 'providerName', event.target.value)}
                                            placeholder="Provider name"
                                        />
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">Phone</label>
                                            <Input
                                                value={utility.contactPhone}
                                                onChange={(event) => updateUtilityField(category, 'contactPhone', event.target.value)}
                                                placeholder="(555) 123-4567"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">Website</label>
                                            <Input
                                                value={utility.contactUrl}
                                                onChange={(event) => updateUtilityField(category, 'contactUrl', event.target.value)}
                                                placeholder="utilityprovider.com"
                                            />
                                        </div>
                                    </div>

                                    {showMeterField ? (
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">Meter number</label>
                                            <Input
                                                value={utility.meterNumber}
                                                onChange={(event) => updateUtilityField(category, 'meterNumber', event.target.value)}
                                                placeholder="Meter number"
                                            />
                                        </div>
                                    ) : null}

                                    {category === 'trash' ? (
                                        <>
                                            <Separator className="bg-border" />
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-foreground">Recycling available</label>
                                                    <select
                                                        value={utility.trashDetails.hasRecycling}
                                                        onChange={(event) => updateTrashField(category, 'hasRecycling', event.target.value)}
                                                        className="w-full h-11 sm:h-9 px-3 rounded-md bg-background/50 border border-input text-foreground text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                    >
                                                        <option value="">Not set</option>
                                                        <option value="yes">Yes</option>
                                                        <option value="no">No</option>
                                                        <option value="not_sure">Not sure</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-foreground">Trash pickup day</label>
                                                    <select
                                                        value={utility.trashDetails.trashPickupDay}
                                                        onChange={(event) => updateTrashField(category, 'trashPickupDay', event.target.value)}
                                                        className="w-full h-11 sm:h-9 px-3 rounded-md bg-background/50 border border-input text-foreground text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                    >
                                                        {PICKUP_DAY_OPTIONS.map((option) => (
                                                            <option key={option.value || 'blank'} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-foreground">Recycling pickup day</label>
                                                <select
                                                    value={utility.trashDetails.recyclingPickupDay}
                                                    onChange={(event) => updateTrashField(category, 'recyclingPickupDay', event.target.value)}
                                                    disabled={utility.trashDetails.hasRecycling === 'no'}
                                                    className="w-full h-11 sm:h-9 px-3 rounded-md bg-background/50 border border-input text-foreground text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                                                >
                                                    {PICKUP_DAY_OPTIONS.map((option) => (
                                                        <option key={option.value || 'blank'} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </>
                                    ) : null}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {visibleAdvancedModules.length > 0 ? (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h2 className="text-xl font-semibold text-foreground">Advanced Packet Details</h2>
                        <p className="text-sm text-muted-foreground">
                            These sections stay aligned with the packet module setup already attached to this request.
                        </p>
                    </div>

                    <div className="grid gap-4">
                        {visibleAdvancedModules.map((moduleKey) => {
                            const visibleKeys = new Set(
                                getAdvancedModuleVisibleFieldKeys(moduleKey, data.request.advancedModuleExclusions)
                            );
                            const fields = ADVANCED_MODULE_FIELD_METADATA[moduleKey].filter((field) => visibleKeys.has(field.key));
                            const moduleData = ((data.editor.advanced?.[moduleKey] || {}) as Record<string, unknown>);

                            return (
                                <Card key={moduleKey} className="border-border bg-card/50">
                                    <CardHeader>
                                        <CardTitle className="text-foreground">{ADVANCED_MODULE_LABELS[moduleKey]}</CardTitle>
                                        <CardDescription className="text-muted-foreground">
                                            Update the information that appears in this advanced packet section.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid gap-4 lg:grid-cols-2">
                                        {fields.map((field) => {
                                            if (moduleKey === 'irrigation_seasonal_controls' && field.key === 'has_irrigation_system') {
                                                const rawValue = moduleData[field.key];
                                                const value = typeof rawValue === 'string' ? rawValue : '';
                                                return (
                                                    <div key={field.key} className="space-y-2">
                                                        <label className="text-sm font-medium text-foreground">{field.label}</label>
                                                        <select
                                                            value={value}
                                                            onChange={(event) => updateAdvancedField(moduleKey, field.key, event.target.value || null)}
                                                            className="w-full h-11 sm:h-9 px-3 rounded-md bg-background/50 border border-input text-foreground text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                        >
                                                            {IRRIGATION_OPTIONS.map((option) => (
                                                                <option key={option.label} value={option.value}>
                                                                    {option.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                );
                                            }

                                            if (moduleKey === 'irrigation_seasonal_controls' && field.key === 'watering_days') {
                                                const rawDays = moduleData[field.key];
                                                const currentDays = Array.isArray(rawDays)
                                                    ? rawDays.map((value: unknown) => String(value))
                                                    : [];

                                                return (
                                                    <div key={field.key} className="space-y-3 lg:col-span-2">
                                                        <label className="text-sm font-medium text-foreground">{field.label}</label>
                                                        <div className="flex flex-wrap gap-3">
                                                            {WATERING_DAY_OPTIONS.map((option) => (
                                                                <label
                                                                    key={option.value}
                                                                    className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2 text-sm text-foreground"
                                                                >
                                                                    <Checkbox
                                                                        checked={currentDays.includes(option.value)}
                                                                        onCheckedChange={(checked) => toggleWateringDay(option.value, Boolean(checked))}
                                                                    />
                                                                    {option.label}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            const rawValue = moduleData[field.key];
                                            const value = typeof rawValue === 'string'
                                                ? rawValue
                                                : Array.isArray(rawValue)
                                                    ? rawValue.join(', ')
                                                    : '';

                                            return (
                                                <div
                                                    key={field.key}
                                                    className={`space-y-2 ${isLongTextField(field.key) ? 'lg:col-span-2' : ''}`}
                                                >
                                                    <label className="text-sm font-medium text-foreground">{field.label}</label>
                                                    {isLongTextField(field.key) ? (
                                                        <Textarea
                                                            value={value}
                                                            onChange={(event) => updateAdvancedField(moduleKey, field.key, event.target.value || null)}
                                                            placeholder={field.example || field.sellerPrompt}
                                                        />
                                                    ) : (
                                                        <Input
                                                            value={value}
                                                            onChange={(event) => updateAdvancedField(moduleKey, field.key, event.target.value || null)}
                                                            placeholder={field.example || field.sellerPrompt}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            ) : null}

            <div className="flex justify-end">
                <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    {saving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
}
