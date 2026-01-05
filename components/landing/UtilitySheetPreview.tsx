'use client';

import { motion } from 'framer-motion';
import { Calendar, Droplets, ExternalLink, Flame, MapPin, Phone, Trash2, Wifi, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const previewRows = [
    {
        label: 'Electric',
        provider: 'Springfield Electric',
        phone: '(800) 555-0100',
        website: 'springfieldelectric.com',
        icon: Zap,
        color: 'bg-yellow-100 text-yellow-700',
    },
    {
        label: 'Gas',
        provider: 'County Gas Co.',
        phone: '(800) 555-0101',
        website: 'countygas.com',
        icon: Flame,
        color: 'bg-orange-100 text-orange-700',
    },
    {
        label: 'Water',
        provider: 'Springfield Water',
        phone: '(800) 555-0102',
        website: 'springfieldwater.gov',
        icon: Droplets,
        color: 'bg-blue-100 text-blue-700',
    },
    {
        label: 'Trash',
        provider: 'Waste Services',
        phone: '(800) 555-0103',
        website: 'wasteservices.com',
        icon: Trash2,
        color: 'bg-emerald-100 text-emerald-700',
    },
    {
        label: 'Internet',
        provider: 'Xfinity',
        phone: '(800) 555-0104',
        website: 'xfinity.com',
        icon: Wifi,
        color: 'bg-purple-100 text-purple-700',
    },
] as const;

export function UtilitySheetPreview() {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ y: 50, opacity: 0, rotateX: 20 }}
                animate={{ y: 0, opacity: 1, rotateX: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="w-full max-w-[420px] bg-white rounded-lg shadow-xl shadow-black/10 overflow-hidden text-[10px] md:text-xs font-sans text-neutral-800 border border-neutral-100"
            >
                {/* Header */}
                <div className="bg-neutral-50 border-b border-neutral-100 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-slate-600 flex items-center justify-center text-white font-bold text-xs p-1">
                            <img src="/logo-sm.png" alt="UtilitySheet Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="font-semibold text-neutral-900 tracking-tight">UtilitySheet</span>
                    </div>
                    <div className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium text-[10px]">
                        UTILITY INFO SHEET
                    </div>
                </div>

                {/* Property Info */}
                <div className="p-4 bg-white border-b border-neutral-100/50">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-slate-50 text-slate-600 rounded-md border border-slate-100">
                            <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm text-neutral-900">123 Main St, Springfield</h3>
                            <div className="flex gap-2 text-neutral-500 mt-1">
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Generated today</span>

                            </div>
                        </div>
                    </div>
                </div>

                {/* Utility Table */}
                <div className="p-4">
                    <div className="rounded-md border border-neutral-100 overflow-hidden">
                        <div className="grid grid-cols-[1fr_1.4fr_1.2fr] bg-neutral-50 px-3 py-2 text-[10px] font-medium text-neutral-600">
                            <span>Utility</span>
                            <span>Provider</span>
                            <span>Contact</span>
                        </div>
                        <div className="divide-y divide-neutral-100">
                            {previewRows.map((row, idx) => (
                                <UtilityRow key={row.label} row={row} delay={0.1 + idx * 0.08} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 bg-neutral-50 flex justify-end gap-2 border-t border-neutral-100">
                    <div className="h-6 w-20 bg-neutral-200 rounded animate-pulse" />
                    <div className="h-6 w-24 bg-slate-500 rounded shadow-sm opacity-90" />
                </div>
            </motion.div>
        </div>
    );
}

type PreviewRow = (typeof previewRows)[number];

function UtilityRow({ row, delay }: { row: PreviewRow; delay: number }) {
    const Icon = row.icon;
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + delay }}
            className="grid grid-cols-[1fr_1.4fr_1.2fr] gap-3 px-3 py-2 hover:bg-neutral-50 transition-colors items-center"
        >
            <div className="flex items-center gap-2 min-w-0">
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0", row.color)}>
                    <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-neutral-900 truncate">{row.label}</span>
            </div>
            <div className="text-neutral-700 font-medium truncate">{row.provider}</div>
            <div className="flex flex-col gap-1 text-neutral-500">
                <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {row.phone}
                </span>
                <span className="inline-flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    {row.website}
                </span>
            </div>
        </motion.div>
    )
}
