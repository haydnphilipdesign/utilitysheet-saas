'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Copy } from 'lucide-react';

const PLACEHOLDERS = {
    sellerFirst: '[Seller First Name]',
    address: '[Property Address]',
    sellerLink: '[Seller Link]',
    sheetLink: '[Utility Sheet Link]',
} as const;

async function copyToClipboard(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    } catch {
        toast.error('Copy failed — please select and copy manually');
    }
}

export function CopyTemplatesSection() {
    const templates = useMemo(() => {
        const sellerText = `Hi ${PLACEHOLDERS.sellerFirst}! Quick favor — can you complete this utility info form for ${PLACEHOLDERS.address}? It should only take a couple minutes:\n\n${PLACEHOLDERS.sellerLink}\n\nThank you!`;

        const sellerReminderText = `Hi ${PLACEHOLDERS.sellerFirst}! Friendly reminder to complete the utility info form for ${PLACEHOLDERS.address} so we can prep everything for closing:\n\n${PLACEHOLDERS.sellerLink}\n\nThank you!`;

        const sellerEmailSubject = `Utility Info Needed for ${PLACEHOLDERS.address}`;

        const sellerEmailBody = `Hi ${PLACEHOLDERS.sellerFirst},\n\nAs part of the home sale process, we need to collect the utility providers for ${PLACEHOLDERS.address}.\n\nPlease complete this quick form (no login required):\n${PLACEHOLDERS.sellerLink}\n\nThank you!`;

        const buyerHandoff = `Utility Info Sheet for ${PLACEHOLDERS.address}\n\n${PLACEHOLDERS.sheetLink}`;

        return {
            sellerText,
            sellerReminderText,
            sellerEmailSubject,
            sellerEmailBody,
            buyerHandoff,
        };
    }, []);

    return (
        <section id="templates" className="py-24 bg-background px-4 sm:px-6 lg:px-8 border-t border-border/50">
            <div className="mx-auto max-w-7xl">
                <div className="text-center mb-16">
                    <h2 className="text-slate-600 font-bold text-sm tracking-wider uppercase mb-3">Copy/Paste Templates</h2>
                    <h3 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-4">
                        Send it fast (and consistently).
                    </h3>
                    <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
                        Use these messages for your texts and emails. Replace the placeholders, paste in your seller link, and you’re done.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <Card className="border-border bg-card/40">
                        <CardHeader className="pb-4">
                            <h4 className="text-xl font-bold text-foreground">Templates</h4>
                            <p className="text-muted-foreground">
                                Placeholders: {PLACEHOLDERS.sellerFirst}, {PLACEHOLDERS.address}, {PLACEHOLDERS.sellerLink}, {PLACEHOLDERS.sheetLink}
                            </p>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="seller-text" className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="seller-text">Seller text</TabsTrigger>
                                    <TabsTrigger value="seller-email">Seller email</TabsTrigger>
                                    <TabsTrigger value="buyer-handoff">Buyer handoff</TabsTrigger>
                                </TabsList>

                                <TabsContent value="seller-text" className="mt-4 space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="font-semibold text-foreground">Initial text</div>
                                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(templates.sellerText)}>
                                            <Copy className="h-4 w-4 mr-2" />
                                            Copy
                                        </Button>
                                    </div>
                                    <Textarea readOnly value={templates.sellerText} className="min-h-36 font-mono text-sm" />

                                    <div className="flex items-center justify-between gap-3 pt-2">
                                        <div className="font-semibold text-foreground">Reminder text</div>
                                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(templates.sellerReminderText)}>
                                            <Copy className="h-4 w-4 mr-2" />
                                            Copy
                                        </Button>
                                    </div>
                                    <Textarea readOnly value={templates.sellerReminderText} className="min-h-32 font-mono text-sm" />
                                </TabsContent>

                                <TabsContent value="seller-email" className="mt-4 space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="font-semibold text-foreground">Subject</div>
                                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(templates.sellerEmailSubject)}>
                                            <Copy className="h-4 w-4 mr-2" />
                                            Copy
                                        </Button>
                                    </div>
                                    <Textarea readOnly value={templates.sellerEmailSubject} className="min-h-16 font-mono text-sm" />

                                    <div className="flex items-center justify-between gap-3 pt-2">
                                        <div className="font-semibold text-foreground">Body</div>
                                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(templates.sellerEmailBody)}>
                                            <Copy className="h-4 w-4 mr-2" />
                                            Copy
                                        </Button>
                                    </div>
                                    <Textarea readOnly value={templates.sellerEmailBody} className="min-h-44 font-mono text-sm" />
                                </TabsContent>

                                <TabsContent value="buyer-handoff" className="mt-4 space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="font-semibold text-foreground">Share message</div>
                                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(templates.buyerHandoff)}>
                                            <Copy className="h-4 w-4 mr-2" />
                                            Copy
                                        </Button>
                                    </div>
                                    <Textarea readOnly value={templates.buyerHandoff} className="min-h-28 font-mono text-sm" />
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/20">
                        <CardHeader className="pb-4">
                            <h4 className="text-xl font-bold text-foreground">Where do I get the links?</h4>
                            <p className="text-muted-foreground">Two links in UtilitySheet: one for the seller intake, and one for the final utility sheet.</p>
                        </CardHeader>
                        <CardContent className="space-y-4 text-muted-foreground">
                            <div>
                                <div className="font-semibold text-foreground">Seller link</div>
                                <p className="mt-1">
                                    Create a request in your dashboard, then copy the seller link. That’s what you paste into the seller text/email templates.
                                </p>
                            </div>
                            <div>
                                <div className="font-semibold text-foreground">Utility sheet link</div>
                                <p className="mt-1">
                                    After the seller submits, you’ll get a shareable utility sheet link plus a one-click PDF download.
                                </p>
                            </div>
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
                </div>
            </div>
        </section>
    );
}

