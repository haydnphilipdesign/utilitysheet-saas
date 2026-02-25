'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Rocket, ArrowRight, FileDown, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { WizardState } from '../SellerWizard';

interface SuccessStepProps {
    isDemo?: boolean;
    demoData?: {
        address: string;
        state: WizardState;
    };
}

export function SuccessStep({ isDemo = false, demoData }: SuccessStepProps) {
    const [downloading, setDownloading] = useState(false);
    const [downloaded, setDownloaded] = useState(false);

    const handleDownloadPdf = async () => {
        if (!demoData) return;

        setDownloading(true);
        try {
            const { generateDemoPdf } = await import('@/lib/demo-pdf-generator');
            await generateDemoPdf(demoData);
            setDownloaded(true);
        } catch (err) {
            console.error('Failed to generate demo PDF:', err);
        } finally {
            setDownloading(false);
        }
    };

    if (isDemo) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center flex-1 text-center space-y-6 sm:space-y-8 py-6 sm:py-10 px-2"
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full" />
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl relative z-10">
                        <Rocket className="h-12 w-12 sm:h-16 sm:w-16 text-white" />
                    </div>
                </div>

                <div className="space-y-4 max-w-md w-full">
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                        That's How Easy It Is!
                    </h2>
                    <div className="p-3 sm:p-4 bg-slate-500/10 border border-slate-500/20 rounded-xl">
                        <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base">
                            Your sellers complete this in under 2 minutes. You get a
                            <span className="font-semibold text-foreground"> branded PDF</span> with all their utility info.
                        </p>
                    </div>

                    {/* Demo PDF Download */}
                    {demoData && (
                        <button
                            onClick={handleDownloadPdf}
                            disabled={downloading}
                            className="w-full py-3 sm:py-3.5 px-4 sm:px-6 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:from-amber-600 disabled:to-orange-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] text-sm sm:text-base"
                        >
                            {downloading ? (
                                <>
                                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                                    <span className="hidden sm:inline">Generating Preview PDF...</span>
                                    <span className="sm:hidden">Generating...</span>
                                </>
                            ) : downloaded ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                                    <span className="hidden sm:inline">Downloaded! Check your downloads</span>
                                    <span className="sm:hidden">Downloaded!</span>
                                </>
                            ) : (
                                <>
                                    <FileDown className="h-4 w-4 sm:h-5 sm:w-5" />
                                    Download Sample PDF
                                </>
                            )}
                        </button>
                    )}

                    <p className="text-xs text-muted-foreground">
                        {downloaded ? 'The PDF includes a demo watermark' : 'See what your buyers receive'}
                    </p>

                    <div className="pt-3 sm:pt-4 border-t border-border">
                        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                            Ready to use this for your own transactions?
                        </p>
                        <Link
                            href="/auth/signup"
                            className="inline-flex items-center justify-center gap-2 w-full py-3 sm:py-4 px-4 sm:px-6 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-slate-900/30 text-base sm:text-lg active:scale-[0.98]"
                        >
                            Get Started Free
                            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Link>
                    </div>

                    <Link
                        href="/"
                        className="block text-xs sm:text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                        Back to home
                    </Link>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center flex-1 text-center space-y-6 sm:space-y-8 py-6 sm:py-10 px-2"
        >
            <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-2xl relative z-10">
                    <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 text-white" />
                </div>
            </div>

            <div className="space-y-4 max-w-md w-full">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                    All Done!
                </h2>
                <div className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <p className="text-emerald-700 dark:text-emerald-300 text-sm sm:text-base">
                        Thank you for providing this info. Your agent has been notified and the utility sheet is ready for the buyers.
                    </p>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                    You can safely close this page now.
                </p>
            </div>
        </motion.div>
    );
}
