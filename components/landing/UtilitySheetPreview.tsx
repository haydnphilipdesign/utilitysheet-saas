'use client';

import { motion } from 'framer-motion';
import { Zap, Droplets, Wifi, Flame, Check, Building2, Calendar, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

export function UtilitySheetPreview() {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ y: 50, opacity: 0, rotateX: 20 }}
                animate={{ y: 0, opacity: 1, rotateX: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="w-full max-w-[420px] bg-white rounded-lg shadow-xl shadow-black/10 overflow-hidden text-[10px] md:text-xs font-sans text-neutral-800 border border-neutral-100"
            >
                {/* Header - Branding */}
                <div className="bg-neutral-50 border-b border-neutral-100 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center text-white font-bold text-xs">
                            U
                        </div>
                        <span className="font-semibold text-neutral-900 tracking-tight">UtilitySheet</span>
                    </div>
                    <div className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium text-[10px]">
                        READY FOR TRANSFER
                    </div>
                </div>

                {/* Property Info */}
                <div className="p-4 bg-white border-b border-neutral-100/50">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-md">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm text-neutral-900">123 Main St, Springfield</h3>
                            <div className="flex gap-2 text-neutral-500 mt-1">
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Closing: Oct 24</span>

                            </div>
                        </div>
                    </div>
                </div>

                {/* Utility List */}
                <div className="divide-y divide-neutral-100">
                    <UtilityRow
                        icon={<Zap className="w-3.5 h-3.5" />}
                        color="bg-yellow-100 text-yellow-700"
                        label="Electricity"
                        provider="National Grid"
                        status="Scheduled"
                        delay={0.1}
                    />
                    <UtilityRow
                        icon={<Flame className="w-3.5 h-3.5" />}
                        color="bg-orange-100 text-orange-700"
                        label="Gas"
                        provider="Eversource"
                        status="Active"
                        delay={0.2}
                    />
                    <UtilityRow
                        icon={<Droplets className="w-3.5 h-3.5" />}
                        color="bg-blue-100 text-blue-700"
                        label="Water"
                        provider="Springfield Water"
                        status="In Review"
                        delay={0.3}
                    />
                    <UtilityRow
                        icon={<Wifi className="w-3.5 h-3.5" />}
                        color="bg-purple-100 text-purple-700"
                        label="Internet"
                        provider="Xfinity / Verizon"
                        status="Options Ready"
                        delay={0.4}
                    />
                </div>

                {/* Footer Actions */}
                <div className="p-3 bg-neutral-50 flex justify-end gap-2 border-t border-neutral-100">
                    <div className="h-6 w-20 bg-neutral-200 rounded animate-pulse" />
                    <div className="h-6 w-24 bg-emerald-500 rounded shadow-sm opacity-90" />
                </div>
            </motion.div>
        </div>
    );
}

function UtilityRow({ icon, color, label, provider, status, delay }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + delay }}
            className="flex items-center justify-between p-3 hover:bg-neutral-50 transition-colors"
        >
            <div className="flex items-center gap-3">
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", color)}>
                    {icon}
                </div>
                <div className="flex flex-col">
                    <span className="font-medium text-neutral-900">{label}</span>
                    <span className="text-neutral-500 text-[10px]">{provider}</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-neutral-600 font-medium">{status}</span>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
            </div>
        </motion.div>
    )
}
