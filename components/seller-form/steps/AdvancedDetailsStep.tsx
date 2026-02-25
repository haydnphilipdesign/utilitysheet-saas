'use client';

import { motion } from 'framer-motion';
import type { AdvancedModuleKey, AdvancedPacketData } from '@/types';
import { ADVANCED_MODULE_LABELS } from '@/lib/packet/modules';
import type { ReactNode } from 'react';

interface AdvancedDetailsStepProps {
    modules: AdvancedModuleKey[];
    advanced: AdvancedPacketData;
    updateAdvanced: (updates: Partial<AdvancedPacketData>) => void;
    onBack: () => void;
    onNext: () => void;
}

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
    multiline = false,
}: {
    label: string;
    value?: string | null;
    onChange: (value: string) => void;
    placeholder?: string;
    multiline?: boolean;
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
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm text-foreground placeholder:text-muted-foreground"
                />
            )}
        </label>
    );
}

export function AdvancedDetailsStep({
    modules,
    advanced,
    updateAdvanced,
    onBack,
    onNext,
}: AdvancedDetailsStepProps) {
    const hasModule = (moduleKey: AdvancedModuleKey) => modules.includes(moduleKey);
    const validWateringDays = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
        >
            <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">Seller Transition Details</h3>
                <p className="text-sm text-muted-foreground">
                    Fill any additional details you know. All fields are optional.
                </p>
            </div>

            {hasModule('lawn_exterior') && (
                <Section title={ADVANCED_MODULE_LABELS.lawn_exterior}>
                    <Field
                        label="Lawn Care Provider"
                        value={advanced.lawn_exterior?.lawn_care_provider_name}
                        onChange={(value) => updateAdvanced({
                            lawn_exterior: {
                                ...advanced.lawn_exterior,
                                lawn_care_provider_name: value,
                            },
                        })}
                    />
                    <Field
                        label="Lawn Care Phone"
                        value={advanced.lawn_exterior?.lawn_care_provider_phone}
                        onChange={(value) => updateAdvanced({
                            lawn_exterior: {
                                ...advanced.lawn_exterior,
                                lawn_care_provider_phone: value,
                            },
                        })}
                    />
                    <Field
                        label="Lawn Care Email"
                        value={advanced.lawn_exterior?.lawn_care_provider_email}
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
                        onChange={(value) => updateAdvanced({
                            lawn_exterior: {
                                ...advanced.lawn_exterior,
                                snow_removal_provider_name: value,
                            },
                        })}
                    />
                    <Field
                        label="Snow Removal Phone"
                        value={advanced.lawn_exterior?.snow_removal_provider_phone}
                        onChange={(value) => updateAdvanced({
                            lawn_exterior: {
                                ...advanced.lawn_exterior,
                                snow_removal_provider_phone: value,
                            },
                        })}
                    />
                    <Field
                        label="Notes"
                        value={advanced.lawn_exterior?.lawn_exterior_notes}
                        multiline
                        onChange={(value) => updateAdvanced({
                            lawn_exterior: {
                                ...advanced.lawn_exterior,
                                lawn_exterior_notes: value,
                            },
                        })}
                    />
                </Section>
            )}

            {hasModule('irrigation_seasonal_controls') && (
                <Section title={ADVANCED_MODULE_LABELS.irrigation_seasonal_controls}>
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
                        onChange={(value) => updateAdvanced({
                            irrigation_seasonal_controls: {
                                ...advanced.irrigation_seasonal_controls,
                                irrigation_provider_name: value,
                            },
                        })}
                    />
                    <Field
                        label="Irrigation Phone"
                        value={advanced.irrigation_seasonal_controls?.irrigation_provider_phone}
                        onChange={(value) => updateAdvanced({
                            irrigation_seasonal_controls: {
                                ...advanced.irrigation_seasonal_controls,
                                irrigation_provider_phone: value,
                            },
                        })}
                    />
                    <Field
                        label="Watering Days (comma-separated)"
                        value={(advanced.irrigation_seasonal_controls?.watering_days || []).join(', ')}
                        onChange={(value) => updateAdvanced({
                            irrigation_seasonal_controls: {
                                ...advanced.irrigation_seasonal_controls,
                                watering_days: value
                                    .split(',')
                                    .map((d) => d.trim().toLowerCase())
                                    .filter((d) => validWateringDays.has(d)) as Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>,
                            },
                        })}
                    />
                    <Field
                        label="Season Start Month (e.g. apr)"
                        value={advanced.irrigation_seasonal_controls?.irrigation_season_start_month}
                        onChange={(value) => updateAdvanced({
                            irrigation_seasonal_controls: {
                                ...advanced.irrigation_seasonal_controls,
                                irrigation_season_start_month: value,
                            },
                        })}
                    />
                    <Field
                        label="Season End Month (e.g. oct)"
                        value={advanced.irrigation_seasonal_controls?.irrigation_season_end_month}
                        onChange={(value) => updateAdvanced({
                            irrigation_seasonal_controls: {
                                ...advanced.irrigation_seasonal_controls,
                                irrigation_season_end_month: value,
                            },
                        })}
                    />
                    <Field
                        label="Notes"
                        value={advanced.irrigation_seasonal_controls?.irrigation_notes}
                        multiline
                        onChange={(value) => updateAdvanced({
                            irrigation_seasonal_controls: {
                                ...advanced.irrigation_seasonal_controls,
                                irrigation_notes: value,
                            },
                        })}
                    />
                </Section>
            )}

            {hasModule('mailbox_access') && (
                <Section title={ADVANCED_MODULE_LABELS.mailbox_access}>
                    <Field
                        label="Mailbox Number"
                        value={advanced.mailbox_access?.mailbox_number}
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, mailbox_number: value },
                        })}
                    />
                    <Field
                        label="Mailbox Location"
                        value={advanced.mailbox_access?.mailbox_location}
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, mailbox_location: value },
                        })}
                    />
                    <Field
                        label="Parking Instructions"
                        value={advanced.mailbox_access?.parking_instructions}
                        multiline
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, parking_instructions: value },
                        })}
                    />
                    <Field
                        label="Breaker Box Location"
                        value={advanced.mailbox_access?.breaker_box_location}
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, breaker_box_location: value },
                        })}
                    />
                    <Field
                        label="Main Water Shutoff Location"
                        value={advanced.mailbox_access?.main_water_shutoff_location}
                        onChange={(value) => updateAdvanced({
                            mailbox_access: { ...advanced.mailbox_access, main_water_shutoff_location: value },
                        })}
                    />
                </Section>
            )}

            {hasModule('smart_home_security') && (
                <Section title={ADVANCED_MODULE_LABELS.smart_home_security}>
                    <Field
                        label="Security System Brand"
                        value={advanced.smart_home_security?.security_system_brand}
                        onChange={(value) => updateAdvanced({
                            smart_home_security: { ...advanced.smart_home_security, security_system_brand: value },
                        })}
                    />
                    <Field
                        label="Smart Thermostat Brand"
                        value={advanced.smart_home_security?.smart_thermostat_brand}
                        onChange={(value) => updateAdvanced({
                            smart_home_security: { ...advanced.smart_home_security, smart_thermostat_brand: value },
                        })}
                    />
                    <Field
                        label="Smart Doorbell Brand"
                        value={advanced.smart_home_security?.smart_doorbell_brand}
                        onChange={(value) => updateAdvanced({
                            smart_home_security: { ...advanced.smart_home_security, smart_doorbell_brand: value },
                        })}
                    />
                    <Field
                        label="Notes"
                        value={advanced.smart_home_security?.smart_home_notes}
                        multiline
                        onChange={(value) => updateAdvanced({
                            smart_home_security: { ...advanced.smart_home_security, smart_home_notes: value },
                        })}
                    />
                </Section>
            )}

            {hasModule('service_providers') && (
                <Section title={ADVANCED_MODULE_LABELS.service_providers}>
                    <Field
                        label="HVAC Provider"
                        value={advanced.service_providers?.hvac_provider_name}
                        onChange={(value) => updateAdvanced({
                            service_providers: { ...advanced.service_providers, hvac_provider_name: value },
                        })}
                    />
                    <Field
                        label="HVAC Phone"
                        value={advanced.service_providers?.hvac_provider_phone}
                        onChange={(value) => updateAdvanced({
                            service_providers: { ...advanced.service_providers, hvac_provider_phone: value },
                        })}
                    />
                    <Field
                        label="Pest Control Provider"
                        value={advanced.service_providers?.pest_control_provider_name}
                        onChange={(value) => updateAdvanced({
                            service_providers: { ...advanced.service_providers, pest_control_provider_name: value },
                        })}
                    />
                    <Field
                        label="Pest Control Phone"
                        value={advanced.service_providers?.pest_control_provider_phone}
                        onChange={(value) => updateAdvanced({
                            service_providers: { ...advanced.service_providers, pest_control_provider_phone: value },
                        })}
                    />
                    <Field
                        label="Plumber"
                        value={advanced.service_providers?.plumber_provider_name}
                        onChange={(value) => updateAdvanced({
                            service_providers: { ...advanced.service_providers, plumber_provider_name: value },
                        })}
                    />
                    <Field
                        label="Plumber Phone"
                        value={advanced.service_providers?.plumber_provider_phone}
                        onChange={(value) => updateAdvanced({
                            service_providers: { ...advanced.service_providers, plumber_provider_phone: value },
                        })}
                    />
                    <Field
                        label="Notes"
                        value={advanced.service_providers?.service_provider_notes}
                        multiline
                        onChange={(value) => updateAdvanced({
                            service_providers: { ...advanced.service_providers, service_provider_notes: value },
                        })}
                    />
                </Section>
            )}

            <div className="flex gap-2 sm:gap-3 pt-1">
                <button
                    onClick={onBack}
                    className="flex-1 py-3 rounded-xl font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                    Back
                </button>
                <button
                    onClick={onNext}
                    className="flex-[2] py-3 rounded-xl font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                >
                    Continue
                </button>
            </div>
        </motion.div>
    );
}
