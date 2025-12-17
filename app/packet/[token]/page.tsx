'use client';

import { useRef, useState, use } from 'react';
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
import { Download, Copy, Check, Phone, ExternalLink, Zap, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';

// Mock packet data (would come from API in real app)
const mockPacket = {
    property_address: '123 Oak Street, Charlotte, NC 28202',
    generated_at: new Date().toISOString(),
    brand: {
        name: 'Haydn Real Estate Group',
        logo_url: null,
        primary_color: '#10b981',
        contact_name: 'Haydn Watters',
        contact_phone: '(555) 123-4567',
        contact_email: 'haydn@haydnrealty.com',
        contact_website: 'haydnrealty.com',
    },
    utilities: [
        {
            category: 'Electric',
            icon: '⚡',
            provider_name: 'Duke Energy',
            phone: '1-800-777-9898',
            website: 'https://www.duke-energy.com/start-stop-move',
        },
        {
            category: 'Natural Gas',
            icon: '🔥',
            provider_name: 'Piedmont Natural Gas',
            phone: '1-800-752-7504',
            website: 'https://www.piedmontng.com/start-service',
        },
        {
            category: 'Water',
            icon: '💧',
            provider_name: 'Charlotte Water',
            phone: '311',
            website: 'https://charlottenc.gov/water',
        },
        {
            category: 'Sewer',
            icon: '🚰',
            provider_name: 'Charlotte Water',
            phone: '311',
            website: null,
        },
        {
            category: 'Trash',
            icon: '🗑️',
            provider_name: 'Waste Management',
            phone: '1-800-963-4776',
            website: 'https://www.wm.com',
        },
    ],
};

export default function PacketPage({ params }: { params: Promise<{ token: string }> }) {
    const resolvedParams = use(params);
    const packetRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadPdf = async () => {
        setDownloading(true);

        // Dynamic import for PDF generation
        const html2canvas = (await import('html2canvas')).default;
        const jsPDF = (await import('jspdf')).default;

        try {
            const element = packetRef.current;
            if (!element) return;

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#18181b',
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height],
            });

            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`utility-packet-${mockPacket.property_address.split(',')[0].replace(/\s/g, '-')}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">
            {/* Header Actions */}
            <header className="sticky top-0 z-50 border-b border-zinc-800/50 bg-zinc-900/80 backdrop-blur-xl">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
                            <Zap className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold text-white">UtilitySheet</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
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
                <div ref={packetRef} className="space-y-6 p-8 bg-zinc-900 rounded-xl">
                    {/* Branding Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
                        <div className="flex items-center gap-4">
                            {mockPacket.brand.logo_url ? (
                                <img
                                    src={mockPacket.brand.logo_url}
                                    alt={mockPacket.brand.name}
                                    className="h-12 w-auto"
                                />
                            ) : (
                                <div
                                    className="h-12 w-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                                    style={{ backgroundColor: mockPacket.brand.primary_color }}
                                >
                                    {mockPacket.brand.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                </div>
                            )}
                            <div>
                                <h2 className="font-semibold text-white">{mockPacket.brand.name}</h2>
                                <p className="text-sm text-zinc-400">{mockPacket.brand.contact_phone}</p>
                            </div>
                        </div>
                        <div className="text-left sm:text-right">
                            <p className="text-sm text-zinc-400">{mockPacket.brand.contact_email}</p>
                            <p className="text-sm text-zinc-400">{mockPacket.brand.contact_website}</p>
                        </div>
                    </div>

                    {/* Title Section */}
                    <div className="text-center py-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                            Utility Handoff Packet
                        </h1>
                        <div className="inline-flex items-center gap-2 bg-zinc-800/50 px-4 py-2 rounded-lg">
                            <MapPin className="h-4 w-4 text-emerald-400" />
                            <span className="text-white font-medium">{mockPacket.property_address}</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-3 text-sm text-zinc-400">
                            <Calendar className="h-4 w-4" />
                            Generated {format(new Date(mockPacket.generated_at), 'MMMM d, yyyy')}
                        </div>
                    </div>

                    {/* Utility Table */}
                    <Card className="border-zinc-800 bg-zinc-800/30">
                        <CardHeader className="pb-2">
                            <h3 className="text-lg font-semibold text-white">Utility Providers</h3>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-lg border border-zinc-700 overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-zinc-700 hover:bg-transparent">
                                            <TableHead className="text-zinc-400">Utility</TableHead>
                                            <TableHead className="text-zinc-400">Provider</TableHead>
                                            <TableHead className="text-zinc-400 hidden sm:table-cell">Contact</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {mockPacket.utilities.map((utility, index) => (
                                            <TableRow key={index} className="border-zinc-700 hover:bg-zinc-800/50">
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xl">{utility.icon}</span>
                                                        <span className="font-medium text-white">{utility.category}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-zinc-300">
                                                    {utility.provider_name}
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell">
                                                    <div className="flex items-center gap-3">
                                                        {utility.phone && (
                                                            <a
                                                                href={`tel:${utility.phone}`}
                                                                className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"
                                                            >
                                                                <Phone className="h-3 w-3" />
                                                                {utility.phone}
                                                            </a>
                                                        )}
                                                        {utility.website && (
                                                            <a
                                                                href={utility.website}
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
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Next Steps */}
                    <Card className="border-zinc-800 bg-zinc-800/30">
                        <CardHeader className="pb-2">
                            <h3 className="text-lg font-semibold text-white">Buyer Next Steps</h3>
                        </CardHeader>
                        <CardContent>
                            <ol className="space-y-3 text-zinc-300">
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
                    <div className="text-center pt-6 border-t border-zinc-800">
                        <p className="text-sm text-zinc-500">
                            Generated by UtilitySheet • {mockPacket.brand.contact_email}
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
