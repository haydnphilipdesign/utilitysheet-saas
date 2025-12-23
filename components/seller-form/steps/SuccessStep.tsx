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
                className="flex flex-col items-center justify-center flex-1 text-center space-y-8 py-10"
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full" />
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl relative z-10">
                        <Rocket className="h-16 w-16 text-white" />
                    </div>
                </div>

                <div className="space-y-4 max-w-md">
                    <h2 className="text-3xl font-bold text-foreground">
                        That's How Easy It Is!
                    </h2>
                    <div className="p-4 bg-slate-500/10 border border-slate-500/20 rounded-xl">
                        <p className="text-slate-600 dark:text-slate-300">
                            Your sellers complete this in under 2 minutes. You get a
                            <span className="font-semibold text-foreground"> branded PDF</span> with all their utility info.
                        </p>
                    </div>

                    {/* Demo PDF Download */}
                    {demoData && (
                        <button
                            onClick={handleDownloadPdf}
                            disabled={downloading}
                            className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:from-amber-600 disabled:to-orange-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
                        >
                            {downloading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Generating Preview PDF...
                                </>
                            ) : downloaded ? (
                                <>
                                    <CheckCircle2 className="h-5 w-5" />
                                    Downloaded! Check your downloads
                                </>
                            ) : (
                                <>
                                    <FileDown className="h-5 w-5" />
                                    Download Sample PDF
                                </>
                            )}
                        </button>
                    )}

                    <p className="text-xs text-muted-foreground">
                        {downloaded ? 'The PDF includes a demo watermark' : 'See what your buyers receive'}
                    </p>

                    <div className="pt-4 border-t border-border">
                        <p className="text-sm text-muted-foreground mb-4">
                            Ready to use this for your own transactions?
                        </p>
                        <Link
                            href="/auth/signup"
                            className="inline-flex items-center justify-center gap-2 w-full py-4 px-6 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-slate-900/30 text-lg"
                        >
                            Get Started Free
                            <ArrowRight className="h-5 w-5" />
                        </Link>
                    </div>

                    <Link
                        href="/"
                        className="block text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
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
            className="flex flex-col items-center justify-center flex-1 text-center space-y-8 py-10"
        >
            <div className="relative">
                <div className="absolute inset-0 bg-slate-500/20 blur-3xl rounded-full" />
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-2xl relative z-10">
                    <CheckCircle2 className="h-16 w-16 text-white" />
                </div>
            </div>

            <div className="space-y-4 max-w-md">
                <h2 className="text-3xl font-bold text-foreground">
                    All Done!
                </h2>
                <div className="p-4 bg-slate-500/10 border border-slate-500/20 rounded-xl">
                    <p className="text-slate-600 dark:text-slate-300">
                        Thank you for providing this info. Your agent has been notified and the utility sheet is ready for the buyers.
                    </p>
                </div>
                <p className="text-sm text-muted-foreground">
                    You can safely close this page now.
                </p>
            </div>
        </motion.div>
    );
}


