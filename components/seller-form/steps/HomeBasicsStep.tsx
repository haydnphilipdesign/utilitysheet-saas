'use client';

import { motion } from 'framer-motion';
import { Droplets, Flame, Waves } from 'lucide-react';
import { WizardState } from '../SellerWizard';

interface HomeBasicsStepProps {
    state: WizardState;
    updateState: (updates: Partial<WizardState>) => void;
    onNext: () => void;
}

export function HomeBasicsStep({ state, updateState, onNext }: HomeBasicsStepProps) {
    const isWaterComplete = state.water_source !== 'not_sure' || true; // Allow defaults
    const isSewerComplete = state.sewer_type !== 'not_sure' || true;

    // Check validation if needed, for now we allow "Skip/Not Sure" which counts as a value

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
        >
            <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-white">Home Basics</h3>
                <p className="text-zinc-400">Let's start with the essentials.</p>
            </div>

            {/* Water Source */}
            <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                    <Droplets className="h-4 w-4" />
                    Water Source
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                        { id: 'city', label: 'Public Water' },
                        { id: 'well', label: 'Private Well' },
                        { id: 'condo', label: 'HOA / Condo' }
                    ].map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => updateState({ water_source: opt.id as any })}
                            className={`p-4 rounded-xl border text-left transition-all ${state.water_source === opt.id
                                ? 'bg-emerald-500/10 border-emerald-500/50 text-white shadow-lg shadow-emerald-900/20'
                                : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:border-white/10 hover:bg-zinc-900'
                                }`}
                        >
                            <span className="block font-medium">{opt.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Sewer Type */}
            <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                    <Waves className="h-4 w-4" />
                    Sewer Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                        { id: 'public', label: 'Public Sewer' },
                        { id: 'septic', label: 'Septic System' },
                        { id: 'none', label: 'None / Other' }
                    ].map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => updateState({ sewer_type: opt.id as any })}
                            className={`p-4 rounded-xl border text-left transition-all ${state.sewer_type === opt.id
                                ? 'bg-emerald-500/10 border-emerald-500/50 text-white shadow-lg shadow-emerald-900/20'
                                : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:border-white/10 hover:bg-zinc-900'
                                }`}
                        >
                            <span className="block font-medium">{opt.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Heating Fuels */}
            <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                    <Flame className="h-4 w-4" />
                    Fuel Sources (Select all that apply)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { id: 'natural_gas', label: 'Natural Gas' },
                        { id: 'propane', label: 'Propane' },
                        { id: 'oil', label: 'Heating Oil' },
                        { id: 'electric', label: 'Electric' }
                    ].map((fuel) => {
                        const isSelected = state.fuels_present.includes(fuel.id);
                        return (
                            <button
                                key={fuel.id}
                                onClick={() => {
                                    let next = [...state.fuels_present];
                                    if (isSelected) {
                                        next = next.filter(f => f !== fuel.id);
                                    } else {
                                        next.push(fuel.id);
                                    }

                                    // Auto-update primary if single fuel
                                    let nextPrimary = state.primary_heating_type;
                                    if (next.length === 1) {
                                        nextPrimary = next[0];
                                    } else if (next.length === 0) {
                                        nextPrimary = null;
                                    } else if (!next.includes(nextPrimary || '')) {
                                        // If current primary is removed, reset
                                        nextPrimary = null;
                                    }

                                    updateState({
                                        fuels_present: next,
                                        primary_heating_type: nextPrimary
                                    });
                                }}
                                className={`p-4 rounded-xl border text-left transition-all ${isSelected
                                    ? 'bg-emerald-500/10 border-emerald-500/50 text-white shadow-lg shadow-emerald-900/20'
                                    : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:border-white/10 hover:bg-zinc-900'
                                    }`}
                            >
                                <span className="block font-medium">{fuel.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Primary Heat Source - Conditional */}
            {state.fuels_present.length > 1 && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                >
                    <label className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                        <Flame className="h-4 w-4" />
                        Which is your PRIMARY heat source?
                    </label>
                    <div className="flex flex-wrap gap-3">
                        {state.fuels_present.map((fuelId) => {
                            const label = fuelId === 'natural_gas' ? 'Natural Gas' :
                                fuelId === 'propane' ? 'Propane' :
                                    fuelId === 'oil' ? 'Heating Oil' :
                                        'Electric';

                            return (
                                <button
                                    key={fuelId}
                                    onClick={() => updateState({ primary_heating_type: fuelId })}
                                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${state.primary_heating_type === fuelId
                                        ? 'bg-emerald-500 text-white border-emerald-500'
                                        : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:border-white/10'
                                        }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            <div className="pt-6">
                <button
                    onClick={onNext}
                    className="w-full py-4 text-center rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                    Continue
                </button>
            </div>
        </motion.div>
    );
}
