'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Bell, CheckCircle2, FileText, Link2, Clock, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';

const painToOutcome = [
    {
        icon: Link2,
        title: 'One permanent link, reused on every file',
        description: 'Share your seller link in texts, emails, or your signature. Sellers enter the address, then confirm or type their utility providers.',
        timeSaved: 'Reusable on every file',
    },
    {
        icon: Bell,
        title: 'Choose simple or advanced packet output',
        description: 'Keep simple utility sheets fast, or collect deeper transition details with Advanced Utility Packet modules (Pro/Teams).',
        timeSaved: 'Flexible output',
    },
    {
        icon: FileText,
        title: 'Review and correct submitted sheets',
        description: 'When a seller submits, Pro and Teams can fix formatting, provider names, addresses, and contact details in the dashboard before the sheet gets shared forward.',
        timeSaved: 'Reduces cleanup',
    },
] as const;

const tcWorkflow = [
    'Add your seller link to your email signature, listing email template, or text template once.',
    'When a new file opens, text or email the seller your link. They enter the property address, confirm suggested providers when available, or type their own answers.',
    'Your completion email can include the finished PDF automatically. If anything needs cleanup after submission, update the live sheet in the dashboard before you share the web link or PDF forward.',
] as const;

const painPoints = [
    { icon: XCircle, text: 'Repeating the same utility questions on every file' },
    { icon: AlertTriangle, text: 'Incomplete utility details right before closing' },
    { icon: Clock, text: 'Waiting days for sellers to respond' },
];

export function ForTcsSection() {
    return (
        <section id="for-tcs" className="scroll-mt-24 py-24 bg-background px-4 sm:px-6 lg:px-8 border-t border-border/50">
            <div className="mx-auto max-w-7xl">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-500/10 text-slate-600 text-sm font-medium mb-4">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Built by TCs, for TCs</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-4">
                        The seller-link process, built from real TC work.
                    </h2>
                    <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
                        Turn a messy, repeated task into one reusable link sellers can complete from their phone.
                    </p>
                </motion.div>

                {/* Pain Points Highlight */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="mb-12 max-w-2xl mx-auto"
                >
                    <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/20">
                        <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-4 uppercase tracking-wide text-center">
                            Sound familiar?
                        </p>
                        <div className="space-y-3">
                            {painPoints.map((pain, idx) => (
                                <div key={idx} className="flex items-center gap-3 text-red-800 dark:text-red-300">
                                    <pain.icon className="h-5 w-5 flex-shrink-0" />
                                    <span className="font-medium">{pain.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    {/* What You Get Card */}
                    <Card className="border-border bg-card/40">
                        <CardHeader className="pb-4">
                            <h4 className="text-xl font-bold text-foreground">What you get</h4>
                            <p className="text-muted-foreground">Built around real TC pain points.</p>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {painToOutcome.map((item, idx) => (
                                <motion.div
                                    key={item.title}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="flex gap-4"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center flex-shrink-0">
                                        <item.icon className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <div className="font-semibold text-foreground">{item.title}</div>
                                            <span className="inline-flex max-w-[9.5rem] shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium leading-tight text-emerald-700">
                                                {item.timeSaved}
                                            </span>
                                        </div>
                                        <div className="text-muted-foreground text-sm mt-1">{item.description}</div>
                                    </div>
                                </motion.div>
                            ))}

                            <div className="pt-4 flex flex-col sm:flex-row gap-3">
                                <Link href="/auth/signup" className="flex-1">
                                    <Button className="h-11 w-full !bg-slate-600 !text-white hover:!bg-slate-500">
                                        Create My Seller Link
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                                <Link href="/demo" className="flex-1">
                                    <Button variant="outline" className="w-full border-slate-500/50 text-slate-600 hover:text-slate-700 hover:bg-slate-500/10 h-11">
                                        Try the Seller Flow
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Workflow Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-80px" }}
                        transition={{ duration: 0.5 }}
                        className="h-full"
                    >
                        <Card className="border-border bg-card/20 h-full">
                            <CardHeader className="pb-4">
                                <h4 className="text-xl font-bold text-foreground">The TC process</h4>
                                <p className="text-muted-foreground">Drop the link into the messages you already send.</p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {tcWorkflow.map((step, idx) => (
                                    <motion.div
                                        key={step}
                                        initial={{ opacity: 0, x: 20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="flex gap-3"
                                    >
                                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-500/15 text-slate-700 dark:text-slate-200 flex items-center justify-center text-sm font-semibold">
                                            {idx + 1}
                                        </div>
                                        <div className="text-muted-foreground leading-relaxed">
                                            {step}
                                        </div>
                                    </motion.div>
                                ))}

                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.3 }}
                                    className="mt-6 rounded-2xl border border-border bg-background/40 p-5"
                                >
                                    <div className="flex items-start gap-3">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
                                        <div>
                                            <div className="font-semibold text-foreground">The dashboard stays out of your way</div>
                                            <div className="text-muted-foreground mt-1 text-sm">
                                                Paste your reusable link into email, text, Dotloop, Skyslope, Brokermint, or your TC checklist. Open UtilitySheet when you need to review a submission, fix a typo, update provider details, manage branding, or adjust settings.
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
