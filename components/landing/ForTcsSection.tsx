'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Bell, CheckCircle2, FileText, Link2 } from 'lucide-react';

const painToOutcome = [
    {
        icon: Link2,
        title: 'One link to the seller',
        description: 'Send a guided intake link—no login, no back-and-forth, no “who’s your gas company?” texts.',
    },
    {
        icon: Bell,
        title: 'Track + remind',
        description: 'See which listings are still pending and send a reminder when sellers forget.',
    },
    {
        icon: FileText,
        title: 'Buyer-ready utility sheet',
        description: 'Get a clean web sheet + PDF you can drop into your buyer packet or share to anyone.',
    },
] as const;

const tcWorkflow = [
    'Create the request when the file opens (takes ~30 seconds).',
    'Paste the seller link into your normal text/email (templates below).',
    'When submitted, download the PDF or share the sheet link to buyers/title.',
] as const;

export function ForTcsSection() {
    return (
        <section id="for-tcs" className="py-24 bg-background px-4 sm:px-6 lg:px-8 border-t border-border/50">
            <div className="mx-auto max-w-7xl">
                <div className="text-center mb-16">
                    <h2 className="text-slate-600 font-bold text-sm tracking-wider uppercase mb-3">For Transaction Coordinators</h2>
                    <h3 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-4">
                        The utility handoff, standardized.
                    </h3>
                    <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
                        UtilitySheet turns a messy, repeated task into a simple workflow you can run on every file—without chasing sellers.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <Card className="border-border bg-card/40">
                        <CardHeader className="pb-4">
                            <h4 className="text-xl font-bold text-foreground">What you get</h4>
                            <p className="text-muted-foreground">Built around real TC pain points.</p>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {painToOutcome.map((item) => (
                                <div key={item.title} className="flex gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center flex-shrink-0">
                                        <item.icon className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-foreground">{item.title}</div>
                                        <div className="text-muted-foreground">{item.description}</div>
                                    </div>
                                </div>
                            ))}

                            <div className="pt-2 flex flex-col sm:flex-row gap-3">
                                <Link href="/demo">
                                    <Button variant="outline" className="w-full sm:w-auto border-slate-500/50 text-slate-500 hover:text-slate-600 hover:bg-slate-500/10">
                                        Try the Demo
                                    </Button>
                                </Link>
                                <Link href="/auth/signup">
                                    <Button className="w-full sm:w-auto bg-slate-600 text-white hover:bg-slate-700">
                                        Start Free
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-80px" }}
                        transition={{ duration: 0.5 }}
                        className="h-full"
                    >
                        <Card className="border-border bg-card/20 h-full">
                            <CardHeader className="pb-4">
                                <h4 className="text-xl font-bold text-foreground">The TC workflow</h4>
                                <p className="text-muted-foreground">Drop it into whatever system you already use.</p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {tcWorkflow.map((step, idx) => (
                                    <div key={step} className="flex gap-3">
                                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-500/15 text-slate-700 dark:text-slate-200 flex items-center justify-center text-sm font-semibold">
                                            {idx + 1}
                                        </div>
                                        <div className="text-muted-foreground leading-relaxed">
                                            {step}
                                        </div>
                                    </div>
                                ))}

                                <div className="mt-6 rounded-2xl border border-border bg-background/40 p-5">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle2 className="h-5 w-5 text-slate-600 mt-0.5" />
                                        <div>
                                            <div className="font-semibold text-foreground">Works with your process</div>
                                            <div className="text-muted-foreground mt-1">
                                                Copy/paste the link into email, text, Dotloop, Skyslope, Brokermint, or your TC checklist—no integrations required.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

