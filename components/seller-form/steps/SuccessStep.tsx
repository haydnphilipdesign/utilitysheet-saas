'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, PartyPopper } from 'lucide-react';

export function SuccessStep() {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center flex-1 text-center space-y-8 py-10"
        >
            <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl relative z-10">
                    <CheckCircle2 className="h-16 w-16 text-white" />
                </div>
            </div>

            <div className="space-y-4 max-w-md">
                <h2 className="text-3xl font-bold text-white">
                    All Done!
                </h2>
                <div className="p-4 bg-emerald-900/20 border border-emerald-500/20 rounded-xl">
                    <p className="text-emerald-200">
                        Thank you for providing this info. Your agent has been notified and the utility sheet is ready for the buyers.
                    </p>
                </div>
                <p className="text-sm text-zinc-500">
                    You can safely close this page now.
                </p>
            </div>
        </motion.div>
    );
}
