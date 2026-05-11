'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, MapPin, ArrowRight } from 'lucide-react';
import { SellerLayout } from '@/components/seller-form/SellerLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GooglePlacesAddressInput } from '@/components/address/GooglePlacesAddressInput';
import { trackEvent } from '@/lib/analytics/events';
import {
    type IntakeAddressParts,
    type IntakeMissingField,
    US_STATE_CODES,
    formatCanonicalIntakeAddress,
    getMissingIntakeFields,
    normalizeIntakeAddressParts,
    validateIntakeAddress,
} from '@/lib/address/intake-validation';

interface BrandProfile {
    name?: string;
    logo_url?: string;
    primary_color?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_website?: string;
}

interface ConfirmAddressFields extends IntakeAddressParts {
    unit: string;
}

const EMPTY_CONFIRM_ADDRESS: ConfirmAddressFields = {
    street: '',
    unit: '',
    city: '',
    state: '',
    zip: '',
};

const FIELD_ERROR_MESSAGE: Record<IntakeMissingField, string> = {
    street: 'Please enter a street address.',
    city: 'Please enter a city.',
    state: 'Please select a state.',
    zip: 'Please enter a valid 5-digit ZIP code.',
};

function toFieldErrors(missingFields: IntakeMissingField[]): Partial<Record<IntakeMissingField, string>> {
    const next: Partial<Record<IntakeMissingField, string>> = {};
    missingFields.forEach((field) => {
        next[field] = FIELD_ERROR_MESSAGE[field];
    });
    return next;
}

function isIntakeMissingField(value: unknown): value is IntakeMissingField {
    return value === 'street' || value === 'city' || value === 'state' || value === 'zip';
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export default function IntakeLinkPage({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = use(params);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
    const [accepting, setAccepting] = useState(true);
    const [address, setAddress] = useState('');
    const [showConfirmAddress, setShowConfirmAddress] = useState(false);
    const [confirmAddress, setConfirmAddress] = useState<ConfirmAddressFields>(EMPTY_CONFIRM_ADDRESS);
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<IntakeMissingField, string>>>({});

    const slug = resolvedParams.slug;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError(null);
            try {
                const res = await fetch(`/api/intake/${encodeURIComponent(slug)}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data?.error || 'Not found');
                }

                if (cancelled) return;
                setBrandProfile(data.brandProfile || null);
                setAccepting(Boolean(data.accepting));
                if (data.accepting === false) {
                    setLoadError(data?.message || 'This link is temporarily unavailable.');
                }
            } catch (e: unknown) {
                if (cancelled) return;
                setLoadError(getErrorMessage(e, 'This link is unavailable.'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [slug]);

    const confirmMissingFields = useMemo(() => {
        const normalized = normalizeIntakeAddressParts(confirmAddress);
        return getMissingIntakeFields(normalized);
    }, [confirmAddress]);

    const canStart = useMemo(() => {
        if (!accepting || submitting) return false;
        if (showConfirmAddress) return confirmMissingFields.length === 0;
        return address.trim().length >= 5;
    }, [accepting, address, confirmMissingFields, showConfirmAddress, submitting]);

    const clearFieldError = (field: IntakeMissingField) => {
        setFieldErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const handleAddressInputChange = useCallback((value: string) => {
        setAddress(value);
        setFormError(null);
    }, []);

    const focusFirstMissingField = (missingFields: IntakeMissingField[]) => {
        const ordered: IntakeMissingField[] = ['street', 'city', 'state', 'zip'];
        const first = ordered.find((field) => missingFields.includes(field));
        if (!first) return;

        const targetId = first === 'street'
            ? 'confirmStreet'
            : first === 'city'
                ? 'confirmCity'
                : first === 'state'
                    ? 'confirmState'
                    : 'confirmZip';
        const target = document.getElementById(targetId) as
            | HTMLInputElement
            | HTMLSelectElement
            | null;
        target?.focus();
    };

    const handleAutocompleteAddressSelected = useCallback((selectedAddress: {
        street: string;
        unit: string;
        city: string;
        state: string;
        zip: string;
        full: string;
        placeId: string | null;
        isComplete: boolean;
    }) => {
        setFormError(null);
        setFieldErrors({});
        setConfirmAddress({
            street: selectedAddress.street,
            unit: selectedAddress.unit,
            city: selectedAddress.city,
            state: selectedAddress.state,
            zip: selectedAddress.zip,
        });

        trackEvent('intake_address_autocomplete_selected', {
            location: 'intake_link',
            page: 'intake_link',
            has_place_id: Boolean(selectedAddress.placeId),
            is_complete: selectedAddress.isComplete,
        });

        if (selectedAddress.isComplete) {
            setShowConfirmAddress(false);
            return;
        }

        const missingFields = getMissingIntakeFields(selectedAddress);
        setShowConfirmAddress(true);
        setFieldErrors(toFieldErrors(missingFields));
        setFormError('Please confirm the full address details below.');
        setTimeout(() => focusFirstMissingField(missingFields), 0);
    }, []);

    const submitStart = async (propertyAddress: string) => {
        setSubmitting(true);
        setFormError(null);

        try {
            const res = await fetch(`/api/intake/${encodeURIComponent(slug)}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ propertyAddress }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const missingFields = Array.isArray(data?.missingFields)
                    ? data.missingFields.filter((field: unknown): field is IntakeMissingField => isIntakeMissingField(field))
                    : [];

                if (res.status === 400 && missingFields.length > 0) {
                    const prefill = validateIntakeAddress(propertyAddress).parsed;
                    setShowConfirmAddress(true);
                    setConfirmAddress((prev) => ({
                        ...prev,
                        street: prefill.street,
                        city: prefill.city,
                        state: prefill.state,
                        zip: prefill.zip,
                    }));
                    setFieldErrors(toFieldErrors(missingFields));
                    setFormError(typeof data?.message === 'string'
                        ? data.message
                        : 'Please include street, city, state, and ZIP code.');
                    trackEvent('intake_address_validation_failed', {
                        location: 'intake_link',
                        page: 'intake_link',
                        stage: 'server',
                        missing_fields: missingFields,
                    });
                    setTimeout(() => focusFirstMissingField(missingFields), 0);
                    return;
                }

                throw new Error(data?.message || data?.error || 'Failed to start');
            }
            const token = String(data?.sellerToken || '');
            if (!token) {
                throw new Error('Failed to start');
            }

            window.location.href = `/s/${encodeURIComponent(token)}`;
        } catch (e: unknown) {
            setFormError(getErrorMessage(e, 'Failed to start. Please try again.'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleStart = async () => {
        trackEvent('intake_address_continue_clicked', {
            location: 'intake_link',
            page: 'intake_link',
            input_mode: showConfirmAddress ? 'confirm' : 'single',
        });

        if (!showConfirmAddress) {
            const propertyAddress = address.trim();
            if (propertyAddress.length < 5) return;

            const validation = validateIntakeAddress(propertyAddress);
            if (validation.isComplete) {
                setFormError(null);
                setFieldErrors({});
                await submitStart(propertyAddress);
                return;
            }

            setShowConfirmAddress(true);
            setConfirmAddress((prev) => ({
                ...prev,
                street: validation.parsed.street,
                city: validation.parsed.city,
                state: validation.parsed.state,
                zip: validation.parsed.zip,
            }));
            setFieldErrors(toFieldErrors(validation.missingFields));
            setFormError('Please confirm the full address details below.');
            trackEvent('intake_address_validation_failed', {
                location: 'intake_link',
                page: 'intake_link',
                stage: 'client',
                missing_fields: validation.missingFields,
            });
            setTimeout(() => focusFirstMissingField(validation.missingFields), 0);
            return;
        }

        const normalized = normalizeIntakeAddressParts(confirmAddress);
        const missingFields = getMissingIntakeFields(normalized);
        if (missingFields.length > 0) {
            setFieldErrors(toFieldErrors(missingFields));
            setFormError('Please complete the missing fields before continuing.');
            trackEvent('intake_address_validation_failed', {
                location: 'intake_link',
                page: 'intake_link',
                stage: 'client',
                missing_fields: missingFields,
            });
            focusFirstMissingField(missingFields);
            return;
        }

        const canonicalAddress = formatCanonicalIntakeAddress({
            ...normalized,
            unit: confirmAddress.unit,
        });
        setAddress(canonicalAddress);
        setFormError(null);
        setFieldErrors({});
        trackEvent('intake_address_confirmed', {
            location: 'intake_link',
            page: 'intake_link',
            source: 'confirm_step',
        });
        await submitStart(canonicalAddress);
    };

    return (
        <SellerLayout
            progress={0}
            stepName="Start"
            completedCount={0}
            totalCount={0}
            brandProfile={brandProfile}
        >
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading…</span>
                    </div>
                </div>
            ) : loadError ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-full max-w-md bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertTriangle className="h-8 w-8 text-red-400" />
                        </div>
                        <h1 className="text-xl font-bold text-white mb-2">Unavailable</h1>
                        <p className="text-zinc-400 mb-6 text-sm">{loadError}</p>
                        <Button
                            variant="outline"
                            className="border-input text-foreground hover:bg-muted"
                            onClick={() => window.location.reload()}
                        >
                            Try Again
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-xl mx-auto space-y-6">
                    <div className="rounded-2xl border border-border bg-card/50 p-6 sm:p-8">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-xl bg-emerald-500/10 p-2">
                                <MapPin className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div className="space-y-1">
                                <h1 className="text-xl font-semibold text-foreground">Enter the property address</h1>
                                <p className="text-sm text-muted-foreground">
                                    We’ll use this to tailor the utility questions for your home.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 space-y-2">
                            <Label htmlFor="propertyAddress" className="text-foreground">Property Address</Label>
                            <GooglePlacesAddressInput
                                id="propertyAddress"
                                value={address}
                                onChange={handleAddressInputChange}
                                onAddressSelected={handleAutocompleteAddressSelected}
                                placeholder="123 Main St, Austin, TX 78701"
                                data-testid="intake-address-input"
                                className="bg-background/50 border-input text-foreground"
                                disabled={submitting || showConfirmAddress}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && canStart) {
                                        e.preventDefault();
                                        handleStart();
                                    }
                                }}
                            />
                            <p className="text-xs text-muted-foreground">
                                Please include street, city, state, and ZIP code.
                            </p>
                        </div>

                        {showConfirmAddress && (
                            <div
                                className="mt-6 rounded-xl border border-border bg-background/40 p-4 sm:p-5 space-y-4"
                                data-testid="intake-address-confirm"
                            >
                                <div className="space-y-1">
                                    <h2 className="text-sm font-semibold text-foreground">Confirm your address details</h2>
                                    <p className="text-xs text-muted-foreground">
                                        This helps us find the right utility providers for your home.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="confirmStreet" className="text-foreground">Street Address</Label>
                                    <Input
                                        id="confirmStreet"
                                        value={confirmAddress.street}
                                        onChange={(e) => {
                                            setConfirmAddress((prev) => ({ ...prev, street: e.target.value }));
                                            clearFieldError('street');
                                            setFormError(null);
                                        }}
                                        data-testid="intake-address-confirm-street"
                                        autoComplete="address-line1"
                                        disabled={submitting}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && canStart) {
                                                e.preventDefault();
                                                handleStart();
                                            }
                                        }}
                                    />
                                    {fieldErrors.street && <p className="text-xs text-red-500">{fieldErrors.street}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="confirmUnit" className="text-foreground">Apt / Unit (optional)</Label>
                                    <Input
                                        id="confirmUnit"
                                        value={confirmAddress.unit}
                                        onChange={(e) => {
                                            setConfirmAddress((prev) => ({ ...prev, unit: e.target.value }));
                                            setFormError(null);
                                        }}
                                        data-testid="intake-address-confirm-unit"
                                        autoComplete="address-line2"
                                        disabled={submitting}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && canStart) {
                                                e.preventDefault();
                                                handleStart();
                                            }
                                        }}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmCity" className="text-foreground">City</Label>
                                        <Input
                                            id="confirmCity"
                                            value={confirmAddress.city}
                                            onChange={(e) => {
                                                setConfirmAddress((prev) => ({ ...prev, city: e.target.value }));
                                                clearFieldError('city');
                                                setFormError(null);
                                            }}
                                            data-testid="intake-address-confirm-city"
                                            autoComplete="address-level2"
                                            disabled={submitting}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && canStart) {
                                                    e.preventDefault();
                                                    handleStart();
                                                }
                                            }}
                                        />
                                        {fieldErrors.city && <p className="text-xs text-red-500">{fieldErrors.city}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="confirmState" className="text-foreground">State</Label>
                                        <select
                                            id="confirmState"
                                            value={confirmAddress.state}
                                            onChange={(e) => {
                                                setConfirmAddress((prev) => ({ ...prev, state: e.target.value }));
                                                clearFieldError('state');
                                                setFormError(null);
                                            }}
                                            data-testid="intake-address-confirm-state"
                                            autoComplete="address-level1"
                                            disabled={submitting}
                                            className="bg-input/20 dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/30 h-11 sm:h-8 rounded-md border px-3 sm:px-2 py-2 sm:py-0.5 text-base sm:text-sm transition-colors text-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && canStart) {
                                                    e.preventDefault();
                                                    handleStart();
                                                }
                                            }}
                                        >
                                            <option value="">Select state</option>
                                            {US_STATE_CODES.map((stateCode) => (
                                                <option key={stateCode} value={stateCode}>
                                                    {stateCode}
                                                </option>
                                            ))}
                                        </select>
                                        {fieldErrors.state && <p className="text-xs text-red-500">{fieldErrors.state}</p>}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="confirmZip" className="text-foreground">ZIP Code</Label>
                                    <Input
                                        id="confirmZip"
                                        value={confirmAddress.zip}
                                        onChange={(e) => {
                                            setConfirmAddress((prev) => ({ ...prev, zip: e.target.value }));
                                            clearFieldError('zip');
                                            setFormError(null);
                                        }}
                                        data-testid="intake-address-confirm-zip"
                                        autoComplete="postal-code"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        disabled={submitting}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && canStart) {
                                                e.preventDefault();
                                                handleStart();
                                            }
                                        }}
                                    />
                                    {fieldErrors.zip && <p className="text-xs text-red-500">{fieldErrors.zip}</p>}
                                </div>
                            </div>
                        )}

                        {formError && (
                            <p className="mt-4 text-sm text-red-500" data-testid="intake-address-error">
                                {formError}
                            </p>
                        )}

                        <div className="mt-6 flex items-center justify-end">
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={handleStart}
                                disabled={!canStart}
                                data-testid="intake-continue"
                            >
                                {submitting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                )}
                                {showConfirmAddress ? 'Confirm and Continue' : 'Continue'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </SellerLayout>
    );
}
