'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Edit2, Loader2, ArrowRight } from 'lucide-react';
import { WizardState } from '../SellerWizard';
import { UtilityCategory } from '@/types';
import { Button } from '@/components/ui/button';

interface ReviewStepProps {
    state: WizardState;
    visibleUtilities: UtilityCategory[];
    onBack: () => void;
    onSubmit: () => Promise<void>;
    submitting: boolean;
}

export function ReviewStep({
    state,
    visibleUtilities,
    onBack,
    onSubmit,
    submitting
}: ReviewStepProps) {

    // Group utilities for display
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
        >
            <div className="space-y-2">
                <h3 className="text-2xl font-bold text-foreground">Review & Submit</h3>
                <p className="text-muted-foreground">Please verify your information below.</p>
            </div>

            <div className="space-y-6">
                {/* Home Basics Summary */}
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                        <h4 className="font-semibold text-foreground">Home Basics</h4>
                        <button onClick={onBack} className="text-xs text-emerald-400 hover:text-emerald-300">Edit</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground mb-1">Water</p>
                            <p className="text-foreground capitalize">{state.water_source.replace('_', ' ')}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground mb-1">Sewer</p>
                            <p className="text-foreground capitalize">{state.sewer_type.replace('_', ' ')}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-muted-foreground mb-1">Fuels Present</p>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {state.fuels_present.length > 0 ? (
                                    state.fuels_present.map(f => (
                                        <span key={f} className="px-2 py-1 rounded bg-muted text-foreground text-xs capitalize">
                                            {f.replace('_', ' ')}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-muted-foreground italic">None selected</span>
                                )}
                            </div>
                            {state.primary_heating_type && (
                                <div>
                                    <p className="text-muted-foreground mb-1 text-xs">Primary Heat</p>
                                    <span className="text-foreground text-sm capitalize font-medium">
                                        {state.primary_heating_type.replace('_', ' ')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Utilities Summary */}
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                        <h4 className="font-semibold text-foreground">Utility Providers</h4>
                    </div>
                    <div className="space-y-4">
                        {visibleUtilities.map(cat => {
                            const utilState = state.utilities[cat];
                            const label = cat.charAt(0).toUpperCase() + cat.slice(1);

                            return (
                                <div key={cat} className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
                                        <p className="text-lg text-foreground font-medium">
                                            {utilState.display_name || <span className="italic text-muted-foreground">Not sure/unknown</span>}
                                        </p>
                                    </div>
                                    {utilState.entry_mode !== null && (
                                        <div className="p-1 rounded-full bg-slate-500/10">
                                            <Check className="h-4 w-4 text-slate-600" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="pt-4 flex gap-3">
                <button
                    onClick={onBack}
                    className="flex-1 py-4 text-center rounded-xl font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    disabled={submitting}
                >
                    Back
                </button>
                <button
                    onClick={onSubmit}
                    disabled={submitting}
                    className="flex-[2] py-4 text-center rounded-xl font-bold bg-slate-700 hover:bg-slate-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {submitting ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        <>
                            Submit Information
                            <ArrowRight className="h-5 w-5" />
                        </>
                    )}
                </button>
            </div>
        </motion.div>
    );
}
