'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { AlertCircle, ArrowLeft, Check, Download, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { UTILITY_CATEGORIES, UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import { generatePacketPdf } from '@/lib/pdf-generator';
import {
    ADVANCED_MODULE_FIELD_METADATA,
    ADVANCED_MODULE_LABELS,
    PACKET_MODE_LABELS,
    getAdvancedModuleVisibleFieldKeys,
    getEffectiveAdvancedModules,
} from '@/lib/packet/modules';
import { cn } from '@/lib/utils';
import type {
    AdvancedModuleKey,
    SubmittedSheetEditableUtility,
    SubmittedSheetEditorPayload,
    SubmittedSheetUtilityStatus,
    TrashPickupDay,
    UtilityCategory,
} from '@/types';

type FieldErrors = Record<string, string>;
type SaveState = 'idle' | 'saving' | 'saved' | 'invalid' | 'error';

const STATUS_OPTIONS: Array<{ value: SubmittedSheetUtilityStatus; label: string }> = [
    { value: 'provider', label: 'Provider' },
    { value: 'not_sure', label: 'Not sure' },
    { value: 'not_included', label: 'Leave off sheet' },
];

const WATER_SOURCE_OPTIONS = [
    { value: 'city', label: 'Public water' },
    { value: 'well', label: 'Private well' },
    { value: 'hoa', label: 'HOA / Condo' },
    { value: 'not_sure', label: 'Not sure' },
];

const SEWER_TYPE_OPTIONS = [
    { value: 'public', label: 'Public sewer' },
    { value: 'septic', label: 'Septic system' },
    { value: 'hoa', label: 'HOA / Condo' },
    { value: 'not_sure', label: 'Not sure' },
];

const HEATING_TYPE_OPTIONS = [
    { value: 'natural_gas', label: 'Natural gas' },
    { value: 'electric', label: 'Electric' },
    { value: 'propane', label: 'Propane' },
    { value: 'oil', label: 'Heating oil' },
    { value: 'not_sure', label: 'Not sure' },
];

const RECYCLING_OPTIONS = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'not_sure', label: 'Not sure' },
];

const IRRIGATION_OPTIONS = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'not_sure', label: 'Not sure' },
];

const WEEKDAY_OPTIONS: Array<{ value: TrashPickupDay; short: string; label: string }> = [
    { value: 'mon', short: 'Mon', label: 'Monday' },
    { value: 'tue', short: 'Tue', label: 'Tuesday' },
    { value: 'wed', short: 'Wed', label: 'Wednesday' },
    { value: 'thu', short: 'Thu', label: 'Thursday' },
    { value: 'fri', short: 'Fri', label: 'Friday' },
    { value: 'sat', short: 'Sat', label: 'Saturday' },
    { value: 'sun', short: 'Sun', label: 'Sunday' },
];
const WEEKDAY_VALUES = new Set<string>(WEEKDAY_OPTIONS.map((option) => option.value));

const SCHEDULE_SINGLE_OPTIONS: Array<{ value: 'varies' | 'not_sure'; label: string }> = [
    { value: 'varies', label: 'Varies' },
    { value: 'not_sure', label: 'Not sure' },
];

// Keeps focused or scrolled-to controls clear of the sticky save bar. Applied to content
// sections only: a scroll margin on the sticky bar itself would fight its positioning.
const clearOfSaveBarClassName = '[&_input]:scroll-mb-40 [&_select]:scroll-mb-40 [&_textarea]:scroll-mb-40 [&_button]:scroll-mb-40';

const selectClassName ='h-11 sm:h-8 w-full min-w-0 rounded-md border border-input bg-input/20 dark:bg-input/30 px-3 sm:px-2 text-base sm:text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30';

function utilityCategoryMeta(category: UtilityCategory) {
    const match = UTILITY_CATEGORIES.find((item) => item.key === category);
    return { label: match?.label || category, icon: match?.icon || '' };
}

function isLongTextField(fieldKey: string): boolean {
    return ['notes', 'location', 'instructions', 'other_maintenance_providers'].some((token) => fieldKey.includes(token));
}

function scrollBehavior(): ScrollBehavior {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function fieldId(...parts: string[]): string {
    return `sheet-${parts.join('-')}`;
}

/** Returns the normalized website, '' for blank, or null when it is not a usable web address. */
function normalizeWebsite(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const url = new URL(withScheme);
        if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname.includes('.')) return null;
        return withScheme;
    } catch {
        return null;
    }
}

function compactAdvanced(advanced: SubmittedSheetEditorPayload['editor']['advanced']) {
    return Object.fromEntries(
        Object.entries((advanced || {}) as Record<string, unknown>).map(([moduleKey, section]) => [
            moduleKey,
            Object.fromEntries(
                Object.entries((section || {}) as Record<string, unknown>).filter(([, value]) =>
                    value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)
                )
            ),
        ])
    );
}

function editableSnapshot(payload: SubmittedSheetEditorPayload | null): string {
    if (!payload) return '';
    return JSON.stringify({
        address: payload.request.propertyAddress,
        homeBasics: [payload.request.waterSource, payload.request.sewerType, payload.request.heatingType],
        utilities: payload.editor.utilities,
        advanced: compactAdvanced(payload.editor.advanced),
    });
}

function validate(payload: SubmittedSheetEditorPayload, categories: UtilityCategory[]): FieldErrors {
    const errors: FieldErrors = {};
    if (payload.request.propertyAddress.trim().length < 5) {
        errors[fieldId('address')] = 'Enter the full property address.';
    }
    for (const category of categories) {
        const utility = payload.editor.utilities[category];
        if (!utility || utility.status === 'not_included') continue;
        if (utility.status === 'provider' && !utility.providerName.trim()) {
            errors[fieldId(category, 'providerName')] = 'Enter the provider name, or choose Not sure.';
        }
        if (normalizeWebsite(utility.contactUrl) === null) {
            errors[fieldId(category, 'contactUrl')] = 'Enter a valid website, like example.com.';
        }
    }
    return errors;
}

function Field({
    id,
    label,
    error,
    hint,
    className,
    children,
}: {
    id: string;
    label: string;
    error?: string;
    hint?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn('min-w-0 space-y-1.5', className)}>
            <label htmlFor={id} className="block text-sm font-medium text-foreground">
                {label}
            </label>
            {children}
            {error ? (
                <p id={`${id}-message`} className="text-xs text-destructive">{error}</p>
            ) : hint ? (
                <p id={`${id}-message`} className="text-xs text-muted-foreground">{hint}</p>
            ) : null}
        </div>
    );
}

function fieldA11y(id: string, error?: string, hint?: string) {
    return {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || hint ? `${id}-message` : undefined,
    };
}

function ToggleChip({
    pressed,
    onClick,
    ariaLabel,
    children,
}: {
    pressed: boolean;
    onClick: () => void;
    ariaLabel?: string;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            aria-label={ariaLabel}
            onClick={onClick}
            className="inline-flex h-10 min-w-11 items-center justify-center gap-1 rounded-md border border-input bg-background px-2.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-[2px] focus-visible:ring-ring/40 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground sm:h-8 sm:min-w-10 sm:text-xs"
        >
            {pressed ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
            {children}
        </button>
    );
}

function DaySchedulePicker({
    id,
    label,
    days,
    singleValue,
    onChange,
}: {
    id: string;
    label: string;
    days: TrashPickupDay[];
    singleValue: '' | TrashPickupDay;
    onChange: (next: { days: TrashPickupDay[]; single: '' | TrashPickupDay }) => void;
}) {
    const weekdays = days.filter((day) => WEEKDAY_VALUES.has(day));
    const selectedSingle = weekdays.length > 0
        ? ''
        : days.find((day) => !WEEKDAY_VALUES.has(day)) || singleValue;

    return (
        <div role="group" aria-labelledby={`${id}-label`} className="space-y-2">
            <p id={`${id}-label`} className="text-sm font-medium text-foreground">{label}</p>
            <div className="flex flex-wrap items-center gap-1.5">
                {WEEKDAY_OPTIONS.map((option) => {
                    const pressed = weekdays.includes(option.value);
                    return (
                        <ToggleChip
                            key={option.value}
                            pressed={pressed}
                            ariaLabel={option.label}
                            onClick={() => {
                                const nextDays = pressed
                                    ? weekdays.filter((day) => day !== option.value)
                                    : WEEKDAY_OPTIONS.map((item) => item.value).filter((day) => day === option.value || weekdays.includes(day));
                                onChange({ days: nextDays, single: '' });
                            }}
                        >
                            {option.short}
                        </ToggleChip>
                    );
                })}
                <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
                {SCHEDULE_SINGLE_OPTIONS.map((option) => {
                    const pressed = selectedSingle === option.value;
                    return (
                        <ToggleChip
                            key={option.value}
                            pressed={pressed}
                            onClick={() => onChange({ days: [], single: pressed ? '' : option.value })}
                        >
                            {option.label}
                        </ToggleChip>
                    );
                })}
            </div>
        </div>
    );
}

function StatusChoice({
    category,
    label,
    value,
    onChange,
}: {
    category: UtilityCategory;
    label: string;
    value: SubmittedSheetUtilityStatus;
    onChange: (status: SubmittedSheetUtilityStatus) => void;
}) {
    return (
        <fieldset className="min-w-0">
            <legend className="sr-only">How {label} appears on the info sheet</legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 sm:inline-grid sm:w-auto">
                {STATUS_OPTIONS.map((option) => (
                    <label
                        key={option.value}
                        className="flex min-h-10 min-w-0 cursor-pointer items-center justify-center rounded-md px-1.5 py-1 text-center text-sm leading-tight font-medium sm:whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground has-checked:bg-background has-checked:font-semibold has-checked:text-foreground has-checked:shadow-sm has-checked:ring-1 has-checked:ring-foreground/15 has-focus-visible:ring-[2px] has-focus-visible:ring-ring/50 sm:min-h-7 sm:px-3 sm:text-xs"
                    >
                        <input
                            type="radio"
                            className="sr-only"
                            name={fieldId(category, 'status')}
                            value={option.value}
                            checked={value === option.value}
                            onChange={() => onChange(option.value)}
                        />
                        {option.label}
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

export function SubmittedSheetEditor({ requestId }: { requestId: string }) {
    const router = useRouter();
    const requestHref = `/dashboard/requests/${requestId}`;
    const [data, setData] = useState<SubmittedSheetEditorPayload | null>(null);
    const [saved, setSaved] = useState<SubmittedSheetEditorPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [focusTarget, setFocusTarget] = useState<string | null>(null);
    const [pendingHref, setPendingHref] = useState<string | null>(null);
    const [conflictOpen, setConflictOpen] = useState(false);

    const saving = saveState === 'saving';
    const dirty = useMemo(() => editableSnapshot(data) !== editableSnapshot(saved), [data, saved]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const response = await fetch(`/api/requests/${requestId}/submitted-data`, { cache: 'no-store' });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                setData(null);
                setSaved(null);
                setLoadError(result.message || result.error || 'We couldn’t load this info sheet.');
                return;
            }

            setData(result);
            setSaved(result);
            setErrors({});
            setSaveState('idle');
        } catch (error) {
            console.error('Failed to load submitted sheet editor:', error);
            setData(null);
            setSaved(null);
            setLoadError('We couldn’t load this info sheet. Check your connection and try again.');
        } finally {
            setLoading(false);
        }
    }, [requestId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    useEffect(() => {
        if (!focusTarget) return;
        document.getElementById(focusTarget)?.focus();
        setFocusTarget(null);
    }, [focusTarget]);

    const visibleAdvancedModules = useMemo(() => {
        if (!data) return [] as AdvancedModuleKey[];
        return getEffectiveAdvancedModules(data.request.advancedModules, data.request.advancedModuleExclusions);
    }, [data]);

    const visibleUtilityCategories = useMemo(() => {
        if (!data) return [] as UtilityCategory[];
        return UTILITY_CATEGORY_KEYS.filter((category) => Boolean(data.editor.utilities[category]));
    }, [data]);

    const notSureItems = useMemo(() => {
        const items: Array<{ targetId: string; label: string }> = [];
        if (!data) return items;
        for (const category of visibleUtilityCategories) {
            if (data.editor.utilities[category]?.status === 'not_sure') {
                items.push({ targetId: fieldId('utility', category), label: utilityCategoryMeta(category).label });
            }
        }
        if (data.request.waterSource === 'not_sure') items.push({ targetId: fieldId('waterSource'), label: 'Water source' });
        if (data.request.sewerType === 'not_sure') items.push({ targetId: fieldId('sewerType'), label: 'Sewer type' });
        if (data.request.heatingType === 'not_sure') items.push({ targetId: fieldId('heatingType'), label: 'Heating type' });
        return items;
    }, [data, visibleUtilityCategories]);

    const clearErrors = (prefix: string) => {
        setErrors((current) => {
            const keys = Object.keys(current).filter((key) => key.startsWith(prefix));
            if (keys.length === 0) return current;
            const next = { ...current };
            for (const key of keys) delete next[key];
            return next;
        });
    };

    const updateRequest = (patch: Partial<SubmittedSheetEditorPayload['request']>) => {
        setData((current) => current ? { ...current, request: { ...current.request, ...patch } } : current);
    };

    const updateUtility = (
        category: UtilityCategory,
        update: (utility: SubmittedSheetEditableUtility) => SubmittedSheetEditableUtility
    ) => {
        setData((current) => {
            const existing = current?.editor.utilities[category];
            if (!current || !existing) return current;
            return {
                ...current,
                editor: {
                    ...current.editor,
                    utilities: { ...current.editor.utilities, [category]: update(existing) },
                },
            };
        });
    };

    const updateUtilityField = (
        category: UtilityCategory,
        field: 'providerName' | 'contactPhone' | 'contactUrl' | 'meterNumber',
        value: string
    ) => {
        clearErrors(fieldId(category, field));
        updateUtility(category, (utility) => ({ ...utility, [field]: value }));
    };

    const setUtilityStatus = (category: UtilityCategory, status: SubmittedSheetUtilityStatus) => {
        clearErrors(fieldId(category));
        updateUtility(category, (utility) => ({ ...utility, status }));
        if (status === 'provider') setFocusTarget(fieldId(category, 'providerName'));
    };

    const updateAdvancedField = (moduleKey: AdvancedModuleKey, fieldKey: string, value: unknown) => {
        setData((current) => {
            if (!current) return current;
            const currentAdvanced = (current.editor.advanced || {}) as Record<string, unknown>;
            const currentModule = (currentAdvanced[moduleKey] || {}) as Record<string, unknown>;
            return {
                ...current,
                editor: {
                    ...current.editor,
                    advanced: { ...currentAdvanced, [moduleKey]: { ...currentModule, [fieldKey]: value } },
                },
            };
        });
    };

    const jumpTo = (targetId: string) => {
        const element = document.getElementById(targetId);
        if (!element) return;
        const isField = element.matches('select');
        const focusable = isField
            ? element
            : element.querySelector<HTMLElement>('input[type="radio"]:checked') || element;
        element.scrollIntoView({ behavior: scrollBehavior(), block: isField ? 'center' : 'start' });
        focusable.focus({ preventScroll: true });
    };

    const navigate = (href: string) => {
        if (dirty) {
            setPendingHref(href);
            return;
        }
        router.push(href);
    };

    const save = async (): Promise<SubmittedSheetEditorPayload | null> => {
        if (!data) return null;

        const nextErrors = validate(data, visibleUtilityCategories);
        setErrors(nextErrors);
        setSaveErrorMessage(null);
        const firstInvalid = Object.keys(nextErrors)[0];
        if (firstInvalid) {
            // Feedback stays in the save bar and inline: a toast would cover the sticky Save button on phones.
            setSaveState('invalid');
            const element = document.getElementById(firstInvalid);
            element?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
            element?.focus({ preventScroll: true });
            return null;
        }

        const utilities = Object.fromEntries(
            Object.entries(data.editor.utilities).map(([category, utility]) => [
                category,
                {
                    ...utility,
                    providerName: utility.status === 'provider' ? utility.providerName.trim() : '',
                    contactUrl: normalizeWebsite(utility.contactUrl) || '',
                },
            ])
        );

        setSaveState('saving');
        try {
            const response = await fetch(`/api/requests/${requestId}/submitted-data`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    updatedAt: data.request.updatedAt,
                    propertyAddress: data.request.propertyAddress.trim(),
                    homeBasics: {
                        waterSource: data.request.waterSource,
                        sewerType: data.request.sewerType,
                        heatingType: data.request.heatingType,
                    },
                    utilities,
                    advanced: data.editor.advanced,
                }),
            });
            const result = await response.json().catch(() => ({}));

            if (response.status === 409) {
                setSaveState('error');
                setConflictOpen(true);
                return null;
            }

            if (!response.ok) {
                setSaveState('error');
                setSaveErrorMessage(typeof result.message === 'string' ? result.message : null);
                return null;
            }

            setData(result);
            setSaved(result);
            setSaveState('saved');
            return result as SubmittedSheetEditorPayload;
        } catch (error) {
            console.error('Failed to save submitted sheet changes:', error);
            setSaveState('error');
            setSaveErrorMessage('Changes not saved. Check your connection and try again.');
            return null;
        }
    };

    const downloadPdf = async (token: string, successMessage: string) => {
        setDownloadingPdf(true);
        try {
            await generatePacketPdf(token);
            toast.success(successMessage);
        } catch (error) {
            console.error('Failed to download packet PDF:', error);
            toast.error('We couldn’t generate the PDF. Please try again.');
        } finally {
            setDownloadingPdf(false);
        }
    };

    const handleSave = async () => {
        await save();
    };

    const handleDownloadPdf = async () => {
        if (!data) return;
        if (!dirty) {
            await downloadPdf(data.request.publicToken, 'PDF downloaded');
            return;
        }
        const result = await save();
        if (result) await downloadPdf(result.request.publicToken, 'Changes saved and PDF downloaded');
    };

    if (loading) {
        return (
            <div className="flex h-96 flex-col items-center justify-center gap-3 text-muted-foreground" role="status">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                <p className="text-sm">Loading info sheet…</p>
            </div>
        );
    }

    if (loadError || !data) {
        return (
            <div className="mx-auto max-w-xl space-y-4 py-8">
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                    <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
                    <h1 className="mt-3 text-lg font-semibold text-foreground">Editor unavailable</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {loadError || 'We couldn’t load this info sheet.'}
                    </p>
                    <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                        <Button variant="outline" onClick={() => router.push(requestHref)}>
                            Back to request
                        </Button>
                        <Button onClick={() => void loadData()}>Try again</Button>
                    </div>
                </div>
            </div>
        );
    }

    const closingDate = data.request.closingDate
        ? (() => {
            try {
                return format(parseISO(data.request.closingDate), 'MMM d, yyyy');
            } catch {
                return data.request.closingDate;
            }
        })()
        : null;
    const metaItems = [
        data.request.sellerName ? `Seller: ${data.request.sellerName}` : null,
        PACKET_MODE_LABELS[data.request.packetMode === 'advanced' ? 'advanced' : 'simple'],
        closingDate ? `Closing ${closingDate}` : null,
    ].filter(Boolean) as string[];

    const saveStatus = saving
        ? { icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />, text: 'Saving changes…', tone: 'text-muted-foreground' }
        : dirty
            ? saveState === 'invalid' && Object.keys(errors).length > 0
                ? { icon: <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />, text: 'Fix the highlighted fields to save.', tone: 'text-destructive' }
            : saveState === 'error'
                ? { icon: <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />, text: saveErrorMessage || 'Changes not saved yet. Try saving again.', tone: 'text-destructive' }
                : { icon: <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />, text: 'Unsaved changes. Not on the info sheet yet.', tone: 'text-foreground' }
            : saveState === 'saved'
                ? { icon: <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />, text: 'All changes saved', tone: 'text-muted-foreground' }
                : { icon: null, text: 'No unsaved changes', tone: 'text-muted-foreground' };

    const homeBasicsFields = [
        { key: 'waterSource' as const, label: 'Water source', options: WATER_SOURCE_OPTIONS },
        { key: 'sewerType' as const, label: 'Sewer type', options: SEWER_TYPE_OPTIONS },
        { key: 'heatingType' as const, label: 'Heating type', options: HEATING_TYPE_OPTIONS },
    ];

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div className="space-y-4">
                <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2 text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(requestHref)}
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to request
                </Button>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Edit Info Sheet</h1>
                            <StatusBadge status={data.request.status} />
                        </div>
                        <p className="text-base font-medium text-foreground break-words">{saved?.request.propertyAddress}</p>
                        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
                            {metaItems.map((item, index) => (
                                <span key={item} className="inline-flex items-center gap-x-1.5 whitespace-nowrap">
                                    {index > 0 ? <span aria-hidden="true">·</span> : null}
                                    {item}
                                </span>
                            ))}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
                        <a
                            href={`/packet/${data.request.publicToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(buttonVariants({ variant: 'outline' }))}
                        >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            View info sheet
                        </a>
                        <Button
                            variant="outline"
                            onClick={() => void handleDownloadPdf()}
                            disabled={saving || downloadingPdf}
                        >
                            {downloadingPdf ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Download className="h-4 w-4" aria-hidden="true" />
                            )}
                            {downloadingPdf ? 'Generating PDF…' : dirty ? 'Save & download PDF' : 'Download PDF'}
                        </Button>
                    </div>
                </div>

                <p className="text-sm text-muted-foreground">
                    Correct or refine the seller’s answers. Saving updates the web info sheet and every PDF downloaded afterward.
                </p>
            </div>

            {notSureItems.length > 0 ? (
                <div className={cn('rounded-xl border border-amber-500/30 bg-amber-500/5 p-4', clearOfSaveBarClassName)} data-testid="not-sure-summary">
                    <div className="flex gap-3">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                        <div className="min-w-0 space-y-2">
                            <p className="text-sm text-foreground">
                                <span className="font-medium">
                                    {notSureItems.length === 1 ? '1 answer prints as “Not sure.”' : `${notSureItems.length} answers print as “Not sure.”`}
                                </span>{' '}
                                Replace them with the right details, or leave them off the sheet.
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {notSureItems.map((item) => (
                                    <Button
                                        key={item.targetId}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="bg-background"
                                        onClick={() => jumpTo(item.targetId)}
                                    >
                                        {item.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <section aria-labelledby="sheet-property-heading" className={cn('rounded-xl border border-border bg-card', clearOfSaveBarClassName)}>
                <div className="border-b border-border px-4 py-3 sm:px-5">
                    <h2 id="sheet-property-heading" className="text-base font-semibold text-foreground">Property</h2>
                </div>
                <div className="space-y-4 p-4 sm:p-5">
                    <Field id={fieldId('address')} label="Property address" error={errors[fieldId('address')]}>
                        <Input
                            {...fieldA11y(fieldId('address'), errors[fieldId('address')])}
                            value={data.request.propertyAddress}
                            maxLength={200}
                            autoComplete="off"
                            onChange={(event) => {
                                clearErrors(fieldId('address'));
                                updateRequest({ propertyAddress: event.target.value });
                            }}
                        />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-3">
                        {homeBasicsFields.map((field) => (
                            <Field key={field.key} id={fieldId(field.key)} label={field.label}>
                                <select
                                    id={fieldId(field.key)}
                                    value={data.request[field.key] || ''}
                                    onChange={(event) => updateRequest({ [field.key]: event.target.value || null })}
                                    className={selectClassName}
                                >
                                    <option value="">Not set</option>
                                    {field.options.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </Field>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Home Basics set to “Not set” are left off the sheet.</p>
                </div>
            </section>

            <section aria-labelledby="sheet-utilities-heading" className={cn('space-y-3', clearOfSaveBarClassName)}>
                <div>
                    <h2 id="sheet-utilities-heading" className="text-lg font-semibold text-foreground">Utility providers</h2>
                    <p className="text-sm text-muted-foreground">
                        For each utility, list the provider, keep “Not sure,” or leave it off the sheet.
                    </p>
                </div>

                {visibleUtilityCategories.map((category) => {
                    const utility = data.editor.utilities[category];
                    if (!utility) return null;
                    const { label, icon } = utilityCategoryMeta(category);
                    const showMeterField = category === 'electric' && (
                        data.editor.collectElectricMeterNumber || utility.meterNumber.trim().length > 0
                    );
                    const nameId = fieldId(category, 'providerName');
                    const phoneId = fieldId(category, 'contactPhone');
                    const urlId = fieldId(category, 'contactUrl');
                    const meterId = fieldId(category, 'meterNumber');

                    return (
                        <section
                            key={category}
                            id={fieldId('utility', category)}
                            aria-labelledby={`${fieldId('utility', category)}-title`}
                            data-testid={`utility-card-${category}`}
                            className="scroll-mt-24 rounded-xl border border-border bg-card"
                        >
                            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                                <h3
                                    id={`${fieldId('utility', category)}-title`}
                                    className="flex items-center gap-2 text-base font-semibold text-foreground"
                                >
                                    {icon ? <span aria-hidden="true">{icon}</span> : null}
                                    {label}
                                </h3>
                                <StatusChoice
                                    category={category}
                                    label={label}
                                    value={utility.status}
                                    onChange={(status) => setUtilityStatus(category, status)}
                                />
                            </div>

                            {utility.status === 'not_included' ? (
                                <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
                                    {label} won’t appear on the web info sheet or PDF.
                                </p>
                            ) : (
                                <div className="space-y-4 border-t border-border p-4 sm:p-5">
                                    {utility.status === 'provider' ? (
                                        <Field id={nameId} label="Provider name" error={errors[nameId]}>
                                            <Input
                                                {...fieldA11y(nameId, errors[nameId])}
                                                value={utility.providerName}
                                                maxLength={200}
                                                autoComplete="off"
                                                onChange={(event) => updateUtilityField(category, 'providerName', event.target.value)}
                                            />
                                        </Field>
                                    ) : (
                                        <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                                            The provider prints as “Not sure.” Any details below still appear on the sheet.
                                        </p>
                                    )}

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field id={phoneId} label="Phone">
                                            <Input
                                                {...fieldA11y(phoneId)}
                                                type="tel"
                                                value={utility.contactPhone}
                                                maxLength={50}
                                                placeholder="Optional"
                                                onChange={(event) => updateUtilityField(category, 'contactPhone', event.target.value)}
                                            />
                                        </Field>
                                        <Field id={urlId} label="Website" error={errors[urlId]}>
                                            <Input
                                                {...fieldA11y(urlId, errors[urlId])}
                                                inputMode="url"
                                                value={utility.contactUrl}
                                                placeholder="Optional"
                                                onChange={(event) => updateUtilityField(category, 'contactUrl', event.target.value)}
                                            />
                                        </Field>
                                        {showMeterField ? (
                                            <Field id={meterId} label="Meter number">
                                                <Input
                                                    {...fieldA11y(meterId)}
                                                    value={utility.meterNumber}
                                                    maxLength={64}
                                                    placeholder="Optional"
                                                    onChange={(event) => updateUtilityField(category, 'meterNumber', event.target.value)}
                                                />
                                            </Field>
                                        ) : null}
                                    </div>

                                    {category === 'trash' ? (
                                        <div className="space-y-4 border-t border-border pt-4">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pickup schedule</h4>
                                            <Field id={fieldId(category, 'hasRecycling')} label="Recycling available" className="sm:max-w-xs">
                                                <select
                                                    id={fieldId(category, 'hasRecycling')}
                                                    value={utility.trashDetails.hasRecycling}
                                                    onChange={(event) => {
                                                        const hasRecycling = event.target.value as SubmittedSheetEditableUtility['trashDetails']['hasRecycling'];
                                                        updateUtility(category, (current) => ({
                                                            ...current,
                                                            trashDetails: {
                                                                ...current.trashDetails,
                                                                hasRecycling,
                                                                ...(hasRecycling === 'no' ? { recyclingPickupDay: '' as const, recyclingPickupDays: [] } : {}),
                                                            },
                                                        }));
                                                    }}
                                                    className={selectClassName}
                                                >
                                                    <option value="">Not set</option>
                                                    {RECYCLING_OPTIONS.map((option) => (
                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                    ))}
                                                </select>
                                            </Field>
                                            <DaySchedulePicker
                                                id={fieldId(category, 'trashPickup')}
                                                label="Trash pickup"
                                                days={utility.trashDetails.trashPickupDays}
                                                singleValue={utility.trashDetails.trashPickupDay}
                                                onChange={({ days, single }) => updateUtility(category, (current) => ({
                                                    ...current,
                                                    trashDetails: { ...current.trashDetails, trashPickupDays: days, trashPickupDay: days[0] || single },
                                                }))}
                                            />
                                            {utility.trashDetails.hasRecycling !== 'no' ? (
                                                <DaySchedulePicker
                                                    id={fieldId(category, 'recyclingPickup')}
                                                    label="Recycling pickup"
                                                    days={utility.trashDetails.recyclingPickupDays}
                                                    singleValue={utility.trashDetails.recyclingPickupDay}
                                                    onChange={({ days, single }) => updateUtility(category, (current) => ({
                                                        ...current,
                                                        trashDetails: { ...current.trashDetails, recyclingPickupDays: days, recyclingPickupDay: days[0] || single },
                                                    }))}
                                                />
                                            ) : null}
                                            <p className="text-xs text-muted-foreground">Leave a schedule unselected to keep it off the sheet.</p>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </section>
                    );
                })}
            </section>

            {visibleAdvancedModules.length > 0 ? (
                <section aria-labelledby="sheet-advanced-heading" className={cn('space-y-3', clearOfSaveBarClassName)}>
                    <div>
                        <h2 id="sheet-advanced-heading" className="text-lg font-semibold text-foreground">Property handoff details</h2>
                        <p className="text-sm text-muted-foreground">Blank fields are left off the sheet.</p>
                    </div>

                    {visibleAdvancedModules.map((moduleKey) => {
                        const visibleKeys = new Set(getAdvancedModuleVisibleFieldKeys(moduleKey, data.request.advancedModuleExclusions));
                        const fields = ADVANCED_MODULE_FIELD_METADATA[moduleKey].filter((field) => visibleKeys.has(field.key));
                        const moduleData = (data.editor.advanced?.[moduleKey] || {}) as Record<string, unknown>;

                        return (
                            <section
                                key={moduleKey}
                                aria-labelledby={fieldId(moduleKey, 'title')}
                                className="rounded-xl border border-border bg-card"
                            >
                                <div className="border-b border-border px-4 py-3 sm:px-5">
                                    <h3 id={fieldId(moduleKey, 'title')} className="text-base font-semibold text-foreground">
                                        {ADVANCED_MODULE_LABELS[moduleKey]}
                                    </h3>
                                </div>
                                <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
                                    {fields.map((field) => {
                                        const id = fieldId(moduleKey, field.key);
                                        const rawValue = moduleData[field.key];

                                        if (moduleKey === 'irrigation_seasonal_controls' && field.key === 'has_irrigation_system') {
                                            return (
                                                <Field key={field.key} id={id} label={field.label}>
                                                    <select
                                                        id={id}
                                                        value={typeof rawValue === 'string' ? rawValue : ''}
                                                        onChange={(event) => updateAdvancedField(moduleKey, field.key, event.target.value || null)}
                                                        className={selectClassName}
                                                    >
                                                        <option value="">Not set</option>
                                                        {IRRIGATION_OPTIONS.map((option) => (
                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                </Field>
                                            );
                                        }

                                        if (moduleKey === 'irrigation_seasonal_controls' && field.key === 'watering_days') {
                                            const currentDays = Array.isArray(rawValue) ? rawValue.map((value: unknown) => String(value)) : [];
                                            return (
                                                <div key={field.key} role="group" aria-labelledby={`${id}-label`} className="space-y-2 lg:col-span-2">
                                                    <p id={`${id}-label`} className="text-sm font-medium text-foreground">{field.label}</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {WEEKDAY_OPTIONS.map((option) => {
                                                            const pressed = currentDays.includes(option.value);
                                                            return (
                                                                <ToggleChip
                                                                    key={option.value}
                                                                    pressed={pressed}
                                                                    ariaLabel={option.label}
                                                                    onClick={() => updateAdvancedField(
                                                                        moduleKey,
                                                                        field.key,
                                                                        pressed
                                                                            ? currentDays.filter((day) => day !== option.value)
                                                                            : WEEKDAY_OPTIONS.map((item) => item.value).filter((day) => day === option.value || currentDays.includes(day))
                                                                    )}
                                                                >
                                                                    {option.short}
                                                                </ToggleChip>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        const value = typeof rawValue === 'string'
                                            ? rawValue
                                            : Array.isArray(rawValue)
                                                ? rawValue.join(', ')
                                                : '';
                                        const longText = isLongTextField(field.key);

                                        return (
                                            <Field key={field.key} id={id} label={field.label} className={longText ? 'lg:col-span-2' : undefined}>
                                                {longText ? (
                                                    <Textarea
                                                        id={id}
                                                        value={value}
                                                        onChange={(event) => updateAdvancedField(moduleKey, field.key, event.target.value || null)}
                                                        placeholder={field.example || field.sellerPrompt}
                                                    />
                                                ) : (
                                                    <Input
                                                        id={id}
                                                        value={value}
                                                        onChange={(event) => updateAdvancedField(moduleKey, field.key, event.target.value || null)}
                                                        placeholder={field.example || field.sellerPrompt}
                                                    />
                                                )}
                                            </Field>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </section>
            ) : null}

            <div
                className="sticky bottom-3 z-20 rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:bottom-4 sm:px-4"
                data-testid="save-bar"
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p role="status" aria-live="polite" className={cn('flex items-center gap-2 text-sm', saveStatus.tone)}>
                        {saveStatus.icon}
                        {saveStatus.text}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                        <Button variant="outline" onClick={() => navigate(requestHref)} disabled={saving}>
                            {dirty ? 'Cancel' : 'Done'}
                        </Button>
                        <Button onClick={() => void handleSave()} disabled={!dirty || saving || downloadingPdf}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                            {saving ? 'Saving…' : 'Save changes'}
                        </Button>
                    </div>
                </div>
            </div>

            <Dialog open={pendingHref !== null} onOpenChange={(open) => { if (!open) setPendingHref(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Discard unsaved changes?</DialogTitle>
                        <DialogDescription>
                            Your edits to this info sheet haven’t been saved. The web info sheet and PDF will keep the last saved version.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPendingHref(null)}>Keep editing</Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                const href = pendingHref;
                                setSaved(data);
                                setPendingHref(null);
                                if (href) router.push(href);
                            }}
                        >
                            Discard changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>This info sheet changed</DialogTitle>
                        <DialogDescription>
                            Someone else saved changes while you were editing, so your changes weren’t saved. Reload to see the latest version, then reapply your edits.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConflictOpen(false)}>Keep my edits open</Button>
                        <Button
                            onClick={() => {
                                setConflictOpen(false);
                                void loadData();
                            }}
                        >
                            Reload latest version
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
