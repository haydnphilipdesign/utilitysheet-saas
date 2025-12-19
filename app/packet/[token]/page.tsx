'use client';

import { useState, use, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Download, Copy, Check, Phone, ExternalLink, Zap, Calendar, MapPin, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { UTILITY_CATEGORIES } from '@/lib/constants';
import { generatePacketPdf } from '@/lib/pdf-generator';
import { toast } from 'sonner';

export default function PacketPage({ params }: { params: Promise<{ token: string }> }) {
    const resolvedParams = use(params);
    const [copied, setCopied] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [data, setData] = useState<{ request: any, brand: any, utilities: any[] } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPacket() {
            try {
                const response = await fetch(`/api/packet/${resolvedParams.token}`);
                if (response.ok) {
                    const result = await response.json();
                    setData(result);
                }
            } catch (error) {
                console.error('Error fetching packet data:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchPacket();
    }, [resolvedParams.token]);

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadPdf = async () => {
        if (!data) return;
        setDownloading(true);

        try {
            await generatePacketPdf(resolvedParams.token);
            toast.success('PDF downloaded successfully');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Failed to generate PDF. Please try again.');
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-foreground mb-2">Packet Not Found</h1>
                    <p className="text-muted-foreground">The link may be invalid or expired.</p>
                </div>
            </div>
        );
    }

    const { request, brand, utilities } = data;
    const primaryColor = brand?.primary_color || '#10b981';

    return (
        <div className="min-h-screen bg-background">
            {/* Header Actions */}
            <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
                            <Zap className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold text-foreground">UtilitySheet</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-input text-foreground hover:bg-muted"
                            onClick={copyLink}
                        >
                            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                            {copied ? 'Copied!' : 'Copy Link'}
                        </Button>
                        <Button
                            size="sm"
                            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                            onClick={downloadPdf}
                            disabled={downloading}
                        >
                            <Download className="h-4 w-4 mr-1" />
                            {downloading ? 'Generating...' : 'Download PDF'}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Packet Content */}
            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="space-y-6 p-8 bg-card rounded-xl border border-border">
                    {/* Branding Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
                        <div className="flex items-center gap-4">
                            {brand?.logo_url ? (
                                <img
                                    src={brand.logo_url}
                                    alt={brand.name}
                                    className="h-12 w-auto"
                                />
                            ) : (
                                <div
                                    className="h-12 w-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    {brand?.name ? brand.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2) : 'US'}
                                </div>
                            )}
                            <div>
                                <h2 className="font-semibold text-foreground">{brand?.name || 'Real Estate Group'}</h2>
                                <p className="text-sm text-muted-foreground">{brand?.contact_phone || ''}</p>
                            </div>
                        </div>
                        <div className="text-left sm:text-right">
                            <p className="text-sm text-muted-foreground">{brand?.contact_email || ''}</p>
                            <p className="text-sm text-muted-foreground">{brand?.contact_website || ''}</p>
                        </div>
                    </div>

                    {/* Title Section */}
                    <div className="text-center py-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                            Utility Handoff Packet
                        </h1>
                        <div className="inline-flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
                            <MapPin className="h-4 w-4 text-emerald-400" />
                            <span className="text-foreground font-medium">{request.property_address}</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            Generated {format(new Date(request.created_at), 'MMMM d, yyyy')}
                        </div>
                    </div>

                    {/* Utility Table */}
                    <Card className="border-border bg-card/50">
                        <CardHeader className="pb-2">
                            <h3 className="text-lg font-semibold text-foreground">Utility Providers</h3>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-lg border border-border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-border hover:bg-transparent">
                                            <TableHead className="text-muted-foreground">Utility</TableHead>
                                            <TableHead className="text-muted-foreground">Provider</TableHead>
                                            <TableHead className="text-muted-foreground hidden sm:table-cell">Contact</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {utilities.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                    No utility information provided yet.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            utilities.map((utility: any, index: number) => (
                                                <TableRow key={index} className="border-border hover:bg-muted/50">
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl">
                                                                {UTILITY_CATEGORIES.find(c => c.key === utility.category)?.icon || '🏢'}
                                                            </span>
                                                            <span className="font-medium text-foreground capitalize">{utility.category}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {utility.provider_name}
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell">
                                                        <div className="flex items-center gap-3">
                                                            {utility.provider_phone && (
                                                                <a
                                                                    href={`tel:${utility.provider_phone}`}
                                                                    className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"
                                                                >
                                                                    <Phone className="h-3 w-3" />
                                                                    {utility.provider_phone}
                                                                </a>
                                                            )}
                                                            {utility.provider_website && (
                                                                <a
                                                                    href={utility.provider_website}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                                                                >
                                                                    <ExternalLink className="h-3 w-3" />
                                                                    Website
                                                                </a>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Next Steps */}
                    <Card className="border-border bg-card/50">
                        <CardHeader className="pb-2">
                            <h3 className="text-lg font-semibold text-foreground">Buyer Next Steps</h3>
                        </CardHeader>
                        <CardContent>
                            <ol className="space-y-3 text-muted-foreground">
                                <li className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-medium">1</span>
                                    <span>Contact each utility provider above to set up new service in your name.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-medium">2</span>
                                    <span>Schedule service to begin on your closing date or the following business day.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-medium">3</span>
                                    <span>Have your closing documents handy — providers may ask for verification of ownership.</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-medium">4</span>
                                    <span>If transferring internet service, contact your provider at least 1-2 weeks in advance.</span>
                                </li>
                            </ol>
                        </CardContent>
                    </Card>

                    {/* Footer */}
                    <div className="text-center pt-6 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                            Generated by UtilitySheet {brand?.contact_email ? `• ${brand.contact_email}` : ''}
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
