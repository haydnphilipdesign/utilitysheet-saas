'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { AdvancedModuleKey, AdvancedPacketData } from '@/types';
import { ADVANCED_MODULE_LABELS } from '@/lib/packet/modules';

interface AdvancedDetailsStepProps {
    moduleKey: AdvancedModuleKey;
    moduleIndex: number;
    moduleCount: number;
    isReviewEdit?: boolean;
    advanced: AdvancedPacketData;
    updateAdvanced: (updates: Partial<AdvancedPacketData>) => void;
    onBack: () => void;
    onNext: () => void;
}

const WATERING_DAY_OPTIONS: Array<{ value: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'; label: string }> = [
    { value: 'mon', label: 'Mon' },
    { value: 'tue', label: 'Tue' },
    { value: 'wed', label: 'Wed' },
    { value: 'thu', label: 'Thu' },
    { value: 'fri', label: 'Fri' },
    { value: 'sat', label: 'Sat' },
    { value: 'sun', label: 'Sun' },
];

const MONTH_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'jan', label: 'January' },
    { value: 'feb', label: 'February' },
    { value: 'mar', label: 'March' },
    { value: 'apr', label: 'April' },
    { value: 'may', label: 'May' },
    { value: 'jun', label: 'June' },
    { value: 'jul', label: 'July' },
    { value: 'aug', label: 'August' },
    { value: 'sep', label: 'September' },
    { value: 'oct', label: 'October' },
    { value: 'nov', label: 'November' },
    { value: 'dec', label: 'December' },
];

function Section({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="rounded-xl border border-border bg-card/50 p-4 sm:p-5 space-y-3">
            <h4 className="text-sm sm:text-base font-semibold text-foreground">{title}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
        </div>
    );
}

function Field({
    label,
    value,
    onChange,
    placeholder,
    helperText,
    multiline = false,
    type = 'text',
    inputMode,
}: {
    label: string;
    value?: string | null;
    onChange: (value: string) => void;
    placeholder?: string;
    helperText?: string;
    multiline?: boolean;
    type?: 'text' | 'tel' | 'email';
    inputMode?: 'text' | 'tel' | 'email';
}) {
    return (
        <label className={`space-y-1 ${multiline ? 'sm:col-span-2' : ''}`}>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
            {multiline ? (
                <textarea
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
            ) : (
                <input
                    type={type}
                    inputMode={inputMode}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm text-foreground placeholder:text-muted-foreground"
                />
            )}
            {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
        </label>
    );
}

export function AdvancedDetailsStep({
    moduleKey,
    moduleIndex,
    moduleCount,
    isReviewEdit = false,
    advanced,
    updateAdvanced,
    onBack,
    onNext,
}: AdvancedDetailsStepProps) {
    const moduleTitle = ADVANCED_MODULE_LABELS[moduleKey];

    const toggleWateringDay = (dayValue: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun') => {
        const currentDays = advanced.irrigation_seasonal_controls?.watering_days || [];
        const daySet = new Set(currentDays);
        if (daySet.has(dayValue)) {
            daySet.delete(dayValue);
        } else {
            daySet.add(dayValue);
        }

        const orderedDays = WATERING_DAY_OPTIONS
            .map((day) => day.value)
            .filter((day) => daySet.has(day));

        updateAdvanced({
            irrigation_seasonal_controls: {
                ...advanced.irrigation_seasonal_controls,
                watering_days: orderedDays,
            },
        });
    };

    const renderModuleFields = () => {
        if (moduleKey === 'lawn_exterior') {
            return (
                <>
                    <Field
                        label="Lawn Care Provider"
                        value={advanced.lawn_exterior?.lawn_care_provider_name}
                        placeholder="Name of company or person"
                        onChange={(value) => updateAdvanced({
                            lawn_exterior: {
                                ...advanced.lawn_exterior,
                                lawn_care_provider_name: value,
                            },
                        })}
                    />
                    <Field
                        label="Lawn Care Phone"
                        type="tel"
                        inputMode="tel"
                        value={advanced.lawn_exterior?.lawn_care_provider_phone}
                        placeholder="(555) 123-4567"
                        onChange={(value) => updateAdvanced({
                            lawn_exterior: {
                                ...advanced.lawn_exterior,
                                lawn_care_provider_phone: value,
                            },
                        })}
                    />
                    <Field
                        label="Lawn Care Email"
                        type="email"
                        inputMode="email"
                        value={advanced.lawn_exterior?.lawn_care_provider_email}
                        placeholder="service@example.com"
                        onChange={(value) => updateAdvanced({
                            lawn_exterior: {
                                ...advanced.lawn_exterior,
                                lawn_care_provider_email: value,
                            },
                        })}
                    />
                    <Field
                        label="Snow Removal Provider"
                        value={advanced.lawn_exterior?.snow_removal_provider_name}
                        placeholder="Name of company or person"
                        onChange={(value) => updateAdvanced({
                            lawn_exterior: {
                                ...advanced.lawn_exterior,
                                snow_removal_provider_name: value,
                            },
                        })}
                    />
                    <Field
                        label="Snow Removal Phone"
                        type="tel"
                        inputMode="tel"
                        value={advanced.lawn_exterior?.snow_removal_provider_phone}
                        placeholder="(555) 123-4567"
                        onChange={(value) => updateAdvanced({
                            lawn_exterior: {
                                ...advanced.lawn_exterior,
                                snow_removal_provider_phone: value,
                            },
                        })}
                    />
                    <Field
                        label="Notes"
                        multiline
                        value={advanced.lawn_exterior?.lawn_exterior_notes}
                        placeholder="Seasonal notes, contracts, or special instructions"
                        onChange={(value) => updateAdvanced({
                            lawn_exterior: {
                                ...advanced.lawn_exterior,
                                lawn_exterior_notes: value,
                            },
                        })}
                    />
                </>
            );
        }

        if (moduleKey === 'irrigation_seasonal_controls') {
            const selectedDays = advanced.irrigation_seasonal_controls?.watering_days || [];
            return (
                <>
                    <label className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Has Irrigation System</span>
                        <select
                            value={advanced.irrigation_seasonal_controls?.has_irrigation_system || 'not_sure'}
                            onChange={(e) => updateAdvanced({
                                irrigation_seasonal_controls: {
                                    ...advanced.irrigation_seasonal_controls,
                                    has_irrigation_system: e.target.value as 'yes' | 'no' | 'not_sure',
                                },
                            })}
                            className="h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm text-foreground"
                        >
                            <option value="not_sure">Not sure</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </label>
                    <Field
                        label="Irrigation Provider"
                        value={advanced.irrigation_seasonal_controls?.irrigation_provider_name}
                        placeholder="Name of company or person"
                        onChange={(value) => updateAdvanced({
                            irrigation_seasonal_controls: {
                                ...advanced.irrigation_seasonal_controls,
                                irrigation_provider_name: value,
                            },
                        })}
                    />
                    <Field
                        label="Irrigation Phone"
                        type="tel"
                        inputMode="tel"
                        value={advanced.irrigation_seasonal_controls?.irrigation_provider_phone}
                        placeholder="(555) 123-4567"
                        onChange={(value) => updateAdvanced({
                            irrigation_seasonal_controls: {
                                ...advanced.irrigation_seasonal_controls,
                                irrigation_provider_phone: value,
                            },
                        })}
                    />
                    <div className="space-y-2 sm:col-span-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Watering Days</span>
                        <div className="flex flex-wrap gap-2">
                            {WATERING_DAY_OPTIONS.map((day) => {
                                const isSelected = selectedDays.includes(day.value);
                                return (
                                    <button
                                        key={day.value}
                                        type="button"
                                        data-testid={`irrigation-day-${day.value}`}
                                        aria-pressed={isSelected}
                                        onClick={() => toggleWateringDay(day.value)}
                                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                                            isSelected
                                                ? 'border-slate-500/60 bg-slate-500/10 text-foreground'
                                                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                                        }`}
                                    >
                                        {day.label}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-muted-foreground">Select any regular watering days, if known.</p>
                    </div>
                    <label className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Season Start Month</span>
                        <select
                            data-testid="irrigation-season-start-month"
                            value={advanced.irrigation_seasonal_controls?.irrigation_season_start_month || ''}
                            onChange={(e) => updateAdvanced({
                                irrigation_seasonal_controls: {
                                    ...advanced.irrigation_seasonal_controls,
                                    irrigation_season_start_month: e.target.value || null,
                                },
                            })}
                            className="h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm text-foreground"
                        >
                            <option value="">Not sure</option>
                            {MONTH_OPTIONS.map((month) => (
                                <option key={month.value} value={month.value}>
                                    {month.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Season End Month</span>
                        <select
                            data-testid="irrigation-season-end-month"
                            value={advanced.irrigation_seasonal_controls?.irrigation_season_end_month || ''}
                            onChange={(e) => updateAdvanced({
                                irrigation_seasonal_controls: {
                                    ...advanced.irrigation_seasonal_controls,
                                    irrigation_season_end_month: e.target.value || null,
                                },
                            })}
                            className="h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm text-foreground"
                        >
                            <option value="">Not sure</option>
                            {MONTH_OPTIONS.map((month) => (
                                <option key={month.value} value={month.value}>
                                    {month.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <Field
                        label="Notes"
                        multiline
                        value={advanced.irrigation_seasonal_controls?.irrigation_notes}
                        placeholder="Controller location, seasonal timing, or other handoff details"
                        onChange={(value) => updateAdvanced({
                            irrigation_seasonal_controls: {
                                ...advanced.irrigation_seasonal_controls,
                                irrigation_notes: value,
                            },
                        })}
                    />
                </>
            );
        }

        if (moduleKey === 'mailbox_access') {
            return (
                <>
                    <Field
                        label="Mailbox Number"
                        value={advanced.mailbox_access?.mailbox_number}
                        placeholder="Example: Box 12B"
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, mailbox_number: value },
                        })}
                    />
                    <Field
                        label="Mailbox Location"
                        value={advanced.mailbox_access?.mailbox_location}
                        placeholder="Where to find the mailbox"
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, mailbox_location: value },
                        })}
                    />
                    <Field
                        label="Parking Instructions"
                        multiline
                        value={advanced.mailbox_access?.parking_instructions}
                        placeholder="Best place to park for access"
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, parking_instructions: value },
                        })}
                    />
                    <Field
                        label="Breaker Box Location"
                        value={advanced.mailbox_access?.breaker_box_location}
                        placeholder="Garage, basement, exterior, etc."
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, breaker_box_location: value },
                        })}
                    />
                    <Field
                        label="Main Water Shutoff Location"
                        value={advanced.mailbox_access?.main_water_shutoff_location}
                        placeholder="Utility room, crawlspace, etc."
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, main_water_shutoff_location: value },
                        })}
                    />
                </>
            );
        }

        if (moduleKey === 'smart_home_security') {
            return (
                <>
                    <Field
                        label="Security System Brand"
                        value={advanced.smart_home_security?.security_system_brand}
                        placeholder="ADT, Ring, SimpliSafe, etc."
                        onChange={(value) => updateAdvanced({
                            smart_home_security: { ...advanced.smart_home_security, security_system_brand: value },
                        })}
                    />
                    <Field
                        label="Smart Thermostat Brand"
                        value={advanced.smart_home_security?.smart_thermostat_brand}
                        placeholder="Nest, Ecobee, etc."
                        onChange={(value) => updateAdvanced({
                            smart_home_security: { ...advanced.smart_home_security, smart_thermostat_brand: value },
                        })}
                    />
                    <Field
                        label="Smart Doorbell Brand"
                        value={advanced.smart_home_security?.smart_doorbell_brand}
                        placeholder="Ring, Arlo, etc."
                        onChange={(value) => updateAdvanced({
                            smart_home_security: { ...advanced.smart_home_security, smart_doorbell_brand: value },
                        })}
                    />
                    <Field
                        label="Notes"
                        multiline
                        value={advanced.smart_home_security?.smart_home_notes}
                        placeholder="Passcodes, app transfer notes, or setup tips"
                        onChange={(value) => updateAdvanced({
                            smart_home_security: { ...advanced.smart_home_security, smart_home_notes: value },
                        })}
                    />
                </>
            );
        }

        return (
            <>
                <Field
                    label="HVAC Provider"
                    value={advanced.service_providers?.hvac_provider_name}
                    placeholder="Company name"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, hvac_provider_name: value },
                    })}
                />
                <Field
                    label="HVAC Phone"
                    type="tel"
                    inputMode="tel"
                    value={advanced.service_providers?.hvac_provider_phone}
                    placeholder="(555) 123-4567"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, hvac_provider_phone: value },
                    })}
                />
                <Field
                    label="Pest Control Provider"
                    value={advanced.service_providers?.pest_control_provider_name}
                    placeholder="Company name"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, pest_control_provider_name: value },
                    })}
                />
                <Field
                    label="Pest Control Phone"
                    type="tel"
                    inputMode="tel"
                    value={advanced.service_providers?.pest_control_provider_phone}
                    placeholder="(555) 123-4567"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, pest_control_provider_phone: value },
                    })}
                />
                <Field
                    label="Plumber"
                    value={advanced.service_providers?.plumber_provider_name}
                    placeholder="Company name"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, plumber_provider_name: value },
                    })}
                />
                <Field
                    label="Plumber Phone"
                    type="tel"
                    inputMode="tel"
                    value={advanced.service_providers?.plumber_provider_phone}
                    placeholder="(555) 123-4567"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, plumber_provider_phone: value },
                    })}
                />
                <Field
                    label="Notes"
                    multiline
                    value={advanced.service_providers?.service_provider_notes}
                    placeholder="Preferred vendors, contract details, or service notes"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, service_provider_notes: value },
                    })}
                />
            </>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
        >
            <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Step {moduleIndex + 1} of {moduleCount}</p>
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">Additional Home Details</h3>
                <p className="text-sm text-muted-foreground">
                    {isReviewEdit
                        ? `Editing ${moduleTitle}. You can skip any field.`
                        : `Add any ${moduleTitle.toLowerCase()} details you want to share. You can skip any field.`}
                </p>
            </div>

            <Section title={moduleTitle}>
                {renderModuleFields()}
            </Section>

            <div className="flex gap-2 sm:gap-3 pt-1">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex-1 py-3 rounded-xl font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                    Back
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    className="flex-[2] py-3 rounded-xl font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                >
                    {isReviewEdit ? 'Save & Return to Review' : 'Continue'}
                </button>
            </div>
        </motion.div>
    );
}
