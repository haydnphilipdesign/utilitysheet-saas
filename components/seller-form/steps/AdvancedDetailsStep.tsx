'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { AdvancedModuleExclusions, AdvancedModuleKey, AdvancedPacketData } from '@/types';
import { ADVANCED_MODULE_LABELS, getAdvancedModuleVisibleFieldKeys } from '@/lib/packet/modules';
import { trackEvent } from '@/lib/analytics/events';

interface AdvancedDetailsStepProps {
    moduleKey: AdvancedModuleKey;
    moduleIndex: number;
    moduleCount: number;
    isReviewEdit?: boolean;
    moduleExclusions?: AdvancedModuleExclusions;
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
    moduleExclusions,
    advanced,
    updateAdvanced,
    onBack,
    onNext,
}: AdvancedDetailsStepProps) {
    const moduleTitle = ADVANCED_MODULE_LABELS[moduleKey];
    const visibleFieldSet = new Set(getAdvancedModuleVisibleFieldKeys(moduleKey, moduleExclusions));
    const showField = (fieldKey: string) => visibleFieldSet.has(fieldKey);
    const renderIfVisible = (fieldKey: string, node: ReactNode) => (showField(fieldKey) ? node : null);

    const handleSkipSection = () => {
        trackEvent('seller_advanced_section_skipped', {
            module: moduleKey,
            location: 'seller_flow',
        });
        onNext();
    };

    const setQuickWateringDays = (preset: 'every_day' | 'mwf' | 'tts' | 'weekends' | 'clear') => {
        const all = WATERING_DAY_OPTIONS.map((d) => d.value);
        const map: Record<typeof preset, typeof all> = {
            every_day: all,
            mwf: ['mon', 'wed', 'fri'],
            tts: ['tue', 'thu', 'sat'],
            weekends: ['sat', 'sun'],
            clear: [],
        };
        updateAdvanced({
            irrigation_seasonal_controls: {
                ...advanced.irrigation_seasonal_controls,
                watering_days: map[preset],
            },
        });
    };

    const irrigationHasSystem = advanced.irrigation_seasonal_controls?.has_irrigation_system;
    const hideIrrigationDetails = moduleKey === 'irrigation_seasonal_controls' && irrigationHasSystem === 'no';

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
                    {renderIfVisible('lawn_care_provider_name', <Field
                        label="Lawn Care Provider"
                        value={advanced.lawn_exterior?.lawn_care_provider_name}
                        placeholder="Name of company or person"
                        onChange={(value) => updateAdvanced({
                            lawn_exterior: {
                                ...advanced.lawn_exterior,
                                lawn_care_provider_name: value,
                            },
                        })}
                    />)}
                    {renderIfVisible('lawn_care_provider_phone', <Field
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
                    />)}
                    {renderIfVisible('snow_removal_provider_name', <Field
                        label="Snow Removal Provider"
                        value={advanced.lawn_exterior?.snow_removal_provider_name}
                        placeholder="Name of company or person"
                        onChange={(value) => updateAdvanced({
                            lawn_exterior: {
                                ...advanced.lawn_exterior,
                                snow_removal_provider_name: value,
                            },
                        })}
                    />)}
                    {renderIfVisible('snow_removal_provider_phone', <Field
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
                    />)}
                    {renderIfVisible('lawn_exterior_notes', <Field
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
                    />)}
                </>
            );
        }

        if (moduleKey === 'irrigation_seasonal_controls') {
            const selectedDays = advanced.irrigation_seasonal_controls?.watering_days || [];
            return (
                <>
                    {renderIfVisible('has_irrigation_system', <label className="space-y-1">
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
                    </label>)}
                    {!hideIrrigationDetails && renderIfVisible('irrigation_provider_name', <Field
                        label="Irrigation Provider"
                        value={advanced.irrigation_seasonal_controls?.irrigation_provider_name}
                        placeholder="Name of company or person"
                        onChange={(value) => updateAdvanced({
                            irrigation_seasonal_controls: {
                                ...advanced.irrigation_seasonal_controls,
                                irrigation_provider_name: value,
                            },
                        })}
                    />)}
                    {!hideIrrigationDetails && renderIfVisible('irrigation_provider_phone', <Field
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
                    />)}
                    {!hideIrrigationDetails && renderIfVisible('watering_days', <div className="space-y-2 sm:col-span-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Watering Days</span>
                        <div className="flex flex-wrap gap-1.5 pb-1">
                            {[
                                { id: 'every_day' as const, label: 'Every day' },
                                { id: 'mwf' as const, label: 'M / W / F' },
                                { id: 'tts' as const, label: 'T / Th / Sat' },
                                { id: 'weekends' as const, label: 'Weekends' },
                                { id: 'clear' as const, label: 'Clear' },
                            ].map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => setQuickWateringDays(preset.id)}
                                    className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
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
                                                ? 'border-[color:var(--brand-accent-border)] bg-[var(--brand-accent-soft)] text-[color:var(--brand-accent)]'
                                                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                                        }`}
                                    >
                                        {day.label}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-muted-foreground">Select any regular watering days, if known.</p>
                    </div>)}
                    {!hideIrrigationDetails && renderIfVisible('irrigation_season_start_month', <label className="space-y-1">
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
                    </label>)}
                    {!hideIrrigationDetails && renderIfVisible('irrigation_season_end_month', <label className="space-y-1">
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
                    </label>)}
                    {!hideIrrigationDetails && renderIfVisible('irrigation_notes', <Field
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
                    />)}
                </>
            );
        }

        if (moduleKey === 'mailbox_access') {
            return (
                <>
                    {renderIfVisible('mailbox_number', <Field
                        label="Mailbox Number"
                        value={advanced.mailbox_access?.mailbox_number}
                        placeholder="Example: Box 12B"
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, mailbox_number: value },
                        })}
                    />)}
                    {renderIfVisible('mailbox_location', <Field
                        label="Mailbox Location"
                        value={advanced.mailbox_access?.mailbox_location}
                        placeholder="Where to find the mailbox"
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, mailbox_location: value },
                        })}
                    />)}
                    {renderIfVisible('garage_door_code', <Field
                        label="Garage Door Code"
                        value={advanced.mailbox_access?.garage_door_code}
                        placeholder="Code to provide at closing"
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, garage_door_code: value },
                        })}
                    />)}
                    {renderIfVisible('keys_and_garage_remotes_location', <Field
                        label="Keys & Garage Remotes at Closing"
                        multiline
                        value={advanced.mailbox_access?.keys_and_garage_remotes_location}
                        placeholder="Where extra keys and garage remotes will be left"
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, keys_and_garage_remotes_location: value },
                        })}
                    />)}
                    {renderIfVisible('parking_instructions', <Field
                        label="Parking Instructions"
                        multiline
                        value={advanced.mailbox_access?.parking_instructions}
                        placeholder="Best place to park for access"
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, parking_instructions: value },
                        })}
                    />)}
                    {renderIfVisible('breaker_box_location', <Field
                        label="Breaker Box Location"
                        value={advanced.mailbox_access?.breaker_box_location}
                        placeholder="Garage, basement, exterior, etc."
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, breaker_box_location: value },
                        })}
                    />)}
                    {renderIfVisible('main_water_shutoff_location', <Field
                        label="Main Water Shutoff Location"
                        value={advanced.mailbox_access?.main_water_shutoff_location}
                        placeholder="Utility room, crawlspace, etc."
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, main_water_shutoff_location: value },
                        })}
                    />)}
                </>
            );
        }

        if (moduleKey === 'smart_home_security') {
            return (
                <>
                    {renderIfVisible('security_system_brand', <Field
                        label="Security System Brand"
                        value={advanced.smart_home_security?.security_system_brand}
                        placeholder="ADT, Ring, SimpliSafe, etc."
                        onChange={(value) => updateAdvanced({
                            smart_home_security: { ...advanced.smart_home_security, security_system_brand: value },
                        })}
                    />)}
                    {renderIfVisible('smart_thermostat_brand', <Field
                        label="Smart Thermostat Brand"
                        value={advanced.smart_home_security?.smart_thermostat_brand}
                        placeholder="Nest, Ecobee, etc."
                        onChange={(value) => updateAdvanced({
                            smart_home_security: { ...advanced.smart_home_security, smart_thermostat_brand: value },
                        })}
                    />)}
                    {renderIfVisible('smart_doorbell_brand', <Field
                        label="Smart Doorbell Brand"
                        value={advanced.smart_home_security?.smart_doorbell_brand}
                        placeholder="Ring, Arlo, etc."
                        onChange={(value) => updateAdvanced({
                            smart_home_security: { ...advanced.smart_home_security, smart_doorbell_brand: value },
                        })}
                    />)}
                    {renderIfVisible('smart_home_notes', <Field
                        label="Notes"
                        multiline
                        value={advanced.smart_home_security?.smart_home_notes}
                        placeholder="Passcodes, app transfer notes, or setup tips"
                        onChange={(value) => updateAdvanced({
                            smart_home_security: { ...advanced.smart_home_security, smart_home_notes: value },
                        })}
                    />)}
                </>
            );
        }

        return (
            <>
                {renderIfVisible('hvac_provider_name', <Field
                    label="HVAC Provider"
                    value={advanced.service_providers?.hvac_provider_name}
                    placeholder="Company name"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, hvac_provider_name: value },
                    })}
                />)}
                {renderIfVisible('hvac_provider_phone', <Field
                    label="HVAC Phone"
                    type="tel"
                    inputMode="tel"
                    value={advanced.service_providers?.hvac_provider_phone}
                    placeholder="(555) 123-4567"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, hvac_provider_phone: value },
                    })}
                />)}
                {renderIfVisible('pest_control_provider_name', <Field
                    label="Pest Control Provider"
                    value={advanced.service_providers?.pest_control_provider_name}
                    placeholder="Company name"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, pest_control_provider_name: value },
                    })}
                />)}
                {renderIfVisible('pest_control_provider_phone', <Field
                    label="Pest Control Phone"
                    type="tel"
                    inputMode="tel"
                    value={advanced.service_providers?.pest_control_provider_phone}
                    placeholder="(555) 123-4567"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, pest_control_provider_phone: value },
                    })}
                />)}
                {renderIfVisible('plumber_provider_name', <Field
                    label="Plumber"
                    value={advanced.service_providers?.plumber_provider_name}
                    placeholder="Company name"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, plumber_provider_name: value },
                    })}
                />)}
                {renderIfVisible('plumber_provider_phone', <Field
                    label="Plumber Phone"
                    type="tel"
                    inputMode="tel"
                    value={advanced.service_providers?.plumber_provider_phone}
                    placeholder="(555) 123-4567"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, plumber_provider_phone: value },
                    })}
                />)}
                {renderIfVisible('pool_service_provider_name', <Field
                    label="Pool Service Provider"
                    value={advanced.service_providers?.pool_service_provider_name}
                    placeholder="Company name"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, pool_service_provider_name: value },
                    })}
                />)}
                {renderIfVisible('pool_service_provider_phone', <Field
                    label="Pool Service Phone"
                    type="tel"
                    inputMode="tel"
                    value={advanced.service_providers?.pool_service_provider_phone}
                    placeholder="(555) 123-4567"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, pool_service_provider_phone: value },
                    })}
                />)}
                {renderIfVisible('other_maintenance_providers', <Field
                    label="Other Maintenance Providers"
                    multiline
                    value={advanced.service_providers?.other_maintenance_providers}
                    placeholder="Provider names, services, and contact information"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, other_maintenance_providers: value },
                    })}
                />)}
                {renderIfVisible('service_provider_notes', <Field
                    label="Notes"
                    multiline
                    value={advanced.service_providers?.service_provider_notes}
                    placeholder="Preferred vendors, contract details, or service notes"
                    onChange={(value) => updateAdvanced({
                        service_providers: { ...advanced.service_providers, service_provider_notes: value },
                    })}
                />)}
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
                {!isReviewEdit && moduleCount > 1 && (
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Optional section {moduleIndex + 1} of {moduleCount}</p>
                )}
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">{moduleTitle}</h3>
                <p className="text-sm text-muted-foreground">
                    {isReviewEdit
                        ? `Editing ${moduleTitle.toLowerCase()}. Update anything you need.`
                        : `These help the next owner take over smoothly. Fill in what you know, skip the rest.`}
                </p>
            </div>

            <Section title={moduleTitle}>
                {renderModuleFields()}
            </Section>

            <div className="flex flex-col gap-2 sm:gap-3 pt-1">
                <div className="flex gap-2 sm:gap-3">
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
                        className="flex-[2] py-3 rounded-xl font-semibold bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-strong)] text-white transition-colors"
                        data-testid="advanced-continue"
                    >
                        {isReviewEdit ? 'Save & Return to Review' : 'Continue'}
                    </button>
                </div>
                {!isReviewEdit && (
                    <button
                        type="button"
                        onClick={handleSkipSection}
                        className="w-full py-2.5 rounded-xl text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="advanced-skip-section"
                    >
                        Skip this section
                    </button>
                )}
            </div>
        </motion.div>
    );
}
