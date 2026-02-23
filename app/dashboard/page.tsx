'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    FileText,
    Clock,
    CheckCircle2,
    AlertCircle,
    Send,
    Plus,
    Search,
    MoreHorizontal,
    Copy,
    Eye,
    Download,
    Mail,
    ExternalLink,
    Loader2,
    Trash2,
    Megaphone,
    Lock,
    X,
    Zap,
    Link2,
    Check,
} from 'lucide-react';
import type { Request, DashboardStats } from '@/types';
import { format } from 'date-fns';
import { generatePacketPdf } from '@/lib/pdf-generator';
import { toast } from 'sonner';
import type { ProductUpdate } from '@/types';
import { trackEvent } from '@/lib/analytics/events';

const statusConfig = {
    draft: { label: 'Draft', color: 'bg-muted text-muted-foreground border-border', icon: FileText },
    sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Send },
    in_progress: { label: 'In Progress', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
    submitted: { label: 'Submitted', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
};

import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';

export default function DashboardPage() {
    const [requests, setRequests] = useState<Request[]>([]);
    const [meta, setMeta] = useState({
        total: 0,
        page: 1,
        totalPages: 1,
        limit: 10
    });
    const [stats, setStats] = useState<DashboardStats>({
        total_requests: 0,
        draft: 0,
        sent: 0,
        in_progress: 0,
        submitted: 0,
        needs_attention: 0,
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [downloadingPdfToken, setDownloadingPdfToken] = useState<string | null>(null);
    const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [updates, setUpdates] = useState<ProductUpdate[]>([]);
    const [updatesLoading, setUpdatesLoading] = useState(true);
    const [dismissedUpdateId, setDismissedUpdateId] = useState<string | null>(null);
    const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number; plan: string } | null>(null);
    const [intakeLink, setIntakeLink] = useState<{ url: string; slug: string } | null>(null);
    const [intakeCanCustomize, setIntakeCanCustomize] = useState(false);
    const [intakeSlugDraft, setIntakeSlugDraft] = useState('');
    const [intakeSaving, setIntakeSaving] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [intakeLinkLoading, setIntakeLinkLoading] = useState(true);
    const [copiedDashboardLink, setCopiedDashboardLink] = useState(false);

    useEffect(() => {
        async function fetchRequests() {
            setLoading(true);
            try {
                const requestsRes = await fetch(`/api/requests?page=${currentPage}&limit=10`);
                if (requestsRes.ok) {
                    const data = await requestsRes.json();
                    setRequests(data.data);
                    setMeta({
                        total: data.total,
                        page: data.page,
                        totalPages: data.totalPages,
                        limit: data.limit
                    });
                }
            } catch (error) {
                console.error('Error fetching requests:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchRequests();
    }, [currentPage]);

    useEffect(() => {
        async function fetchStats() {
            try {
                const [statsRes, accountRes, intakeLinkRes] = await Promise.all([
                    fetch('/api/requests?stats=true'),
                    fetch('/api/account'),
                    fetch('/api/intake-link'),
                ]);
                if (statsRes.ok) {
                    const data = await statsRes.json();
                    setStats(data);
                }
                if (accountRes.ok) {
                    const accountData = await accountRes.json();
                    if (accountData.usage) {
                        setUsageInfo(accountData.usage);
                    }
                }
                if (intakeLinkRes.ok) {
                    const intakeData = await intakeLinkRes.json().catch(() => ({}));
                    if (intakeData.intakeLink?.url) {
                        setIntakeLink(intakeData.intakeLink);
                        setIntakeSlugDraft(intakeData.intakeLink.slug || '');
                    }
                    setIntakeCanCustomize(Boolean(intakeData.canCustomize));
                }
            } catch (error) {
                console.error('Error fetching dashboard stats:', error);
            } finally {
                setIntakeLinkLoading(false);
            }
        }

        fetchStats();
    }, []);

    useEffect(() => {
        // Load dismissed update ID from localStorage
        const savedDismissedId = localStorage.getItem('dismissedUpdateId');
        if (savedDismissedId) {
            setDismissedUpdateId(savedDismissedId);
        }
    }, []);

    useEffect(() => {
        async function fetchUpdates() {
            setUpdatesLoading(true);
            try {
                const res = await fetch('/api/updates?limit=3');
                if (res.ok) {
                    const data = await res.json();
                    setUpdates(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                console.error('Error fetching updates:', error);
            } finally {
                setUpdatesLoading(false);
            }
        }
        fetchUpdates();
    }, []);

    const filteredRequests = requests.filter((request) =>
        request.property_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.seller_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const copyLink = (token: string) => {
        if (!token) return;
        const link = `${window.location.origin}/s/${token}`;
        navigator.clipboard.writeText(link);
        toast.success('Link copied to clipboard');
    };

    const handleDownloadPdf = async (token: string) => {
        setDownloadingPdfToken(token);
        try {
            await generatePacketPdf(token);
            toast.success('PDF downloaded successfully');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Failed to generate PDF. Please try again.');
        } finally {
            setDownloadingPdfToken(null);
        }
    };

    const handleSendReminder = async (id: string, sellerName?: string) => {
        setSendingReminderId(id);
        try {
            const response = await fetch(`/api/requests/${id}/remind`, {
                method: 'POST',
            });
            const data = await response.json();

            if (response.ok) {
                toast.success(`Reminder sent to ${sellerName || 'seller'}`);
            } else {
                toast.error(data.error || 'Failed to send reminder');
            }
        } catch (error) {
            console.error('Error sending reminder:', error);
            toast.error('Failed to send reminder. Please try again.');
        } finally {
            setSendingReminderId(null);
        }
    };

    const handleDeleteRequest = async (id: string) => {
        if (!window.confirm('Delete this request? If it has already been sent, it will still count toward your monthly usage. This action cannot be undone.')) {
            return;
        }

        setDeletingId(id);
        try {
            const response = await fetch(`/api/requests/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Request deleted successfully');
                // Update local state to remove the request
                setRequests(prev => prev.filter(req => req.id !== id));
                // Update stats
                setStats(prev => ({
                    ...prev,
                    total_requests: prev.total_requests - 1,
                    // Note: We don't know exactly which status it was without more logic, 
                    // but usually total_requests is enough for the brief dashboard refresh.
                    // A full re-fetch of stats might be better if we want exact numbers.
                }));
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to delete request');
            }
        } catch (error) {
            console.error('Error deleting request:', error);
            toast.error('Failed to delete request. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleDismissUpdates = () => {
        if (updates.length > 0) {
            // Store the ID of the most recent update
            const latestUpdateId = updates[0].id;
            localStorage.setItem('dismissedUpdateId', latestUpdateId);
            setDismissedUpdateId(latestUpdateId);
        }
    };

    const handleCopyDashboardIntakeLink = async () => {
        if (!intakeLink?.url) return;
        try {
            await navigator.clipboard.writeText(intakeLink.url);
            setCopiedDashboardLink(true);
            setTimeout(() => setCopiedDashboardLink(false), 2000);
            trackEvent('dashboard_reusable_link_copied', {
                location: 'dashboard_reusable_link_card',
            });
        } catch {
            toast.error('Failed to copy link');
        }
    };

    const handleSaveDashboardSlug = async () => {
        if (!intakeCanCustomize) return;

        const slug = intakeSlugDraft.trim();
        if (slug.length < 3) {
            toast.error('Slug must be at least 3 characters.');
            return;
        }
        if (slug === intakeLink?.slug) {
            return;
        }

        setIntakeSaving(true);
        trackEvent('dashboard_reusable_slug_save_attempted', {
            location: 'dashboard_reusable_link_card',
        });
        try {
            const response = await fetch('/api/intake-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.message || data?.error || 'Failed to update link');
            }
            if (data.intakeLink?.url) {
                setIntakeLink(data.intakeLink);
                setIntakeSlugDraft(data.intakeLink.slug || slug);
            }
            toast.success('Reusable link updated');
            trackEvent('dashboard_reusable_slug_save_succeeded', {
                location: 'dashboard_reusable_link_card',
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to update link';
            toast.error(message);
        } finally {
            setIntakeSaving(false);
        }
    };

    const handleStartProCheckout = async () => {
        setCheckoutLoading(true);
        trackEvent('dashboard_reusable_upgrade_clicked', {
            location: 'dashboard_reusable_link_card',
        });
        try {
            const response = await fetch('/api/billing/checkout', { method: 'POST' });
            const data = await response.json().catch(() => ({}));
            if (data.url) {
                window.location.href = data.url;
                return;
            }
            toast.error(data.error || 'Failed to start checkout');
        } catch (error) {
            console.error('Error starting checkout:', error);
            toast.error('Failed to start checkout');
        } finally {
            setCheckoutLoading(false);
        }
    };

    // Check if there are new updates to show (updates not yet dismissed)
    const hasNewUpdates = updates.length > 0 && updates[0].id !== dismissedUpdateId;
    const intakeUrlPrefix = intakeLink?.url
        ? (() => {
            try {
                const parsed = new URL(intakeLink.url);
                return `${parsed.origin}/i/`;
            } catch {
                return '/i/';
            }
        })()
        : '/i/';
    const intakeSlugUnchanged = intakeLink ? intakeSlugDraft.trim() === intakeLink.slug : true;

    const statCards = [
        { label: 'Total Requests', value: stats.total_requests, icon: FileText, color: 'text-muted-foreground' },
        { label: 'Pending', value: stats.sent + stats.in_progress, icon: Clock, color: 'text-blue-400' },
        { label: 'Completed', value: stats.submitted, icon: CheckCircle2, color: 'text-slate-500' },
        { label: 'Needs Attention', value: stats.needs_attention, icon: AlertCircle, color: 'text-amber-400' },
    ];

    return (
        <div className="space-y-6 sm:space-y-8">
            {loading ? (
                <DashboardSkeleton />
            ) : (
                <>
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
                            <p className="text-sm sm:text-base text-muted-foreground mt-0.5 sm:mt-1">Send seller links, track responses, and download utility info sheets</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                            <Link href="/dashboard/requests/new" className="w-full sm:w-auto">
                                <Button
                                    variant="outline"
                                    data-testid="dashboard-new-request"
                                    className="w-full sm:w-auto border-border text-foreground hover:bg-muted active:scale-[0.98]"
                                    onClick={() =>
                                        trackEvent('new_request_started', {
                                            source: 'dashboard_header_button',
                                            location: 'dashboard',
                                        })
                                    }
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Request
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Reusable link hero */}
                    <Card className="relative overflow-hidden border-emerald-500/30 bg-card/60 backdrop-blur-sm">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.12),transparent_55%)]" />
                        <CardHeader className="relative px-4 sm:px-6 pb-4">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div>
                                    <CardTitle className="text-foreground text-lg sm:text-xl flex items-center gap-2">
                                        <Link2 className="h-5 w-5 text-emerald-500" />
                                        Reusable Seller Link
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground text-sm mt-1">
                                        This is your primary workflow: share one fixed link and sellers enter the property address themselves.
                                    </CardDescription>
                                </div>
                                <Badge className="w-fit bg-emerald-600 hover:bg-emerald-600 text-white">
                                    Primary Workflow
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="relative px-4 sm:px-6 pb-6 space-y-4">
                            {intakeLinkLoading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading your reusable link...
                                </div>
                            ) : intakeLink?.url ? (
                                <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
                                    <Input
                                        value={intakeLink.url}
                                        readOnly
                                        className="font-mono text-xs sm:text-sm bg-background/70 border-input text-foreground"
                                    />
                                    <div className="flex flex-col sm:flex-row gap-2 lg:shrink-0">
                                        <Button
                                            type="button"
                                            onClick={handleCopyDashboardIntakeLink}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98]"
                                        >
                                            {copiedDashboardLink ? (
                                                <Check className="mr-2 h-4 w-4" />
                                            ) : (
                                                <Copy className="mr-2 h-4 w-4" />
                                            )}
                                            {copiedDashboardLink ? 'Copied!' : 'Copy Link'}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="border-input text-foreground hover:bg-muted active:scale-[0.98]"
                                            onClick={() => window.open(intakeLink.url, '_blank', 'noopener,noreferrer')}
                                        >
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Open Link
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Unable to load your reusable link right now. Refresh and try again.
                                </p>
                            )}

                            <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2.5">
                                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">What happens next</p>
                                {[
                                    'Seller opens your link and enters the property address.',
                                    'They complete utility details in about 2 minutes.',
                                    'You receive the submission by email, with PDF attachment support.',
                                ].map((step) => (
                                    <div key={step} className="flex items-start gap-2">
                                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                        <p className="text-xs sm:text-sm text-muted-foreground">{step}</p>
                                    </div>
                                ))}
                            </div>

                            <Separator className="bg-border" />

                            {intakeCanCustomize ? (
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-foreground">Custom URL slug</p>
                                        <Badge variant="outline">Pro / Teams</Badge>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center rounded-md border border-input bg-background/60">
                                                <span className="px-3 text-xs text-muted-foreground whitespace-nowrap">{intakeUrlPrefix}</span>
                                                <Input
                                                    id="dashboard-intake-slug"
                                                    value={intakeSlugDraft}
                                                    onChange={(e) => setIntakeSlugDraft(e.target.value)}
                                                    placeholder="your-name"
                                                    className="border-0 bg-transparent text-foreground rounded-l-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                                    disabled={intakeSaving}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Lowercase letters, numbers, and dashes only.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={handleSaveDashboardSlug}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98]"
                                            disabled={intakeSaving || intakeSlugDraft.trim().length < 3 || intakeSlugUnchanged}
                                        >
                                            {intakeSaving ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : null}
                                            Save Slug
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                                <Lock className="h-4 w-4 text-amber-500" />
                                                Custom URL slug
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Upgrade to Pro or Teams to use a branded slug in your reusable seller link.
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                                            Pro / Teams
                                        </Badge>
                                    </div>
                                    <div className="rounded-md border border-border bg-background/60 px-3 py-2">
                                        <p className="text-xs text-muted-foreground">Current link</p>
                                        <p className="text-xs sm:text-sm font-mono text-foreground break-all">
                                            {intakeLink?.url || 'Loading your link...'}
                                        </p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <p className="text-xs text-muted-foreground max-w-lg">
                                            A custom slug looks cleaner in email templates, signatures, and SMS scripts.
                                        </p>
                                        <Button
                                            type="button"
                                            onClick={handleStartProCheckout}
                                            disabled={checkoutLoading}
                                            className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white"
                                        >
                                            {checkoutLoading ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Zap className="mr-2 h-4 w-4" />
                                            )}
                                            Upgrade to Pro
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {statCards.map((stat) => (
                            <Card key={stat.label} className="border-border bg-card/50 backdrop-blur-sm">
                                <CardContent className="p-4 sm:p-6">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.label}</p>
                                            <p className="text-2xl sm:text-3xl font-bold text-foreground mt-0.5 sm:mt-1">{stat.value}</p>
                                        </div>
                                        <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl bg-muted/50 shrink-0 ${stat.color}`}>
                                            <stat.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Free-tier usage nudge */}
                    {usageInfo && usageInfo.plan === 'free' && usageInfo.used >= Math.max(1, usageInfo.limit - 1) && (
                        <div className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl border px-4 py-3.5 ${
                            usageInfo.used >= usageInfo.limit
                                ? 'border-red-500/30 bg-red-500/8'
                                : 'border-amber-500/30 bg-amber-500/8'
                        }`}>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`p-1.5 rounded-lg shrink-0 ${usageInfo.used >= usageInfo.limit ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                                    <Zap className={`h-4 w-4 ${usageInfo.used >= usageInfo.limit ? 'text-red-400' : 'text-amber-400'}`} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground">
                                        {usageInfo.used >= usageInfo.limit
                                            ? `You've used all ${usageInfo.limit} free requests this month`
                                            : `${usageInfo.limit - usageInfo.used} free request${usageInfo.limit - usageInfo.used === 1 ? '' : 's'} remaining this month`}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Upgrade to Pro for unlimited requests at $9/month
                                    </p>
                                </div>
                            </div>
                            <Link href="/dashboard/settings" className="shrink-0">
                                <Button
                                    size="sm"
                                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 font-medium"
                                >
                                    Upgrade to Pro
                                </Button>
                            </Link>
                        </div>
                    )}

                    {/* Updates */}
                    {hasNewUpdates && (
                        <Card className="border-border bg-card/50 backdrop-blur-sm">
                            <CardHeader className="px-4 sm:px-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-foreground text-lg sm:text-xl flex items-center gap-2">
                                            <Megaphone className="h-5 w-5 text-muted-foreground" />
                                            What&apos;s new
                                        </CardTitle>
                                        <CardDescription className="text-muted-foreground text-xs sm:text-sm">
                                            Recent product updates and bugfixes
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link href="/dashboard/updates" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground">
                                            View all
                                        </Link>
                                        <button
                                            onClick={handleDismissUpdates}
                                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                            title="Dismiss"
                                            aria-label="Dismiss updates"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6 pb-6">
                                {updatesLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading updates...
                                    </div>
                                ) : updates.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No updates yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {updates.map((u) => {
                                            const preview = u.body.length > 180 ? `${u.body.slice(0, 180).trim()}…` : u.body;
                                            return (
                                                <div key={u.id} className="rounded-lg border border-border bg-background/40 p-3 sm:p-4">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-semibold text-foreground">{u.title}</span>
                                                        <Badge variant="secondary" className="capitalize">{u.category}</Badge>
                                                        <span className="text-xs text-muted-foreground">{format(new Date(u.published_at), 'MMM d, yyyy')}</span>
                                                    </div>
                                                    <p className="mt-1.5 text-sm text-muted-foreground whitespace-pre-line">{preview}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Requests Table */}
                    <Card className="border-border bg-card/50 backdrop-blur-sm">
                        <CardHeader className="px-4 sm:px-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                                <div>
                                    <CardTitle className="text-foreground text-lg sm:text-xl">Recent Requests</CardTitle>
                                    <CardDescription className="text-muted-foreground text-xs sm:text-sm">
                                        Your utility sheet requests and their status
                                    </CardDescription>
                                </div>
                                <div className="relative w-full sm:w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by address or name..."
                                        inputMode="search"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        data-testid="dashboard-request-search"
                                        className="pl-10 bg-background/50 border-input text-foreground placeholder:text-muted-foreground h-10 text-sm"
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 sm:px-6">
                            {filteredRequests.length > 0 && (
                                <div className="space-y-3 md:hidden mb-4">
                                    {filteredRequests.map((request) => {
                                        const status = statusConfig[request.status];
                                        const isLocked = Boolean(request.is_locked);

                                        return (
                                            <div key={request.id} className="rounded-lg border border-border bg-background/30 p-4 space-y-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-foreground text-base truncate">{request.property_address}</p>
                                                        <p className="text-sm text-muted-foreground truncate">{request.seller_name || 'No seller info'}</p>
                                                    </div>
                                                    <Badge variant="outline" className={`${status.color} border text-xs px-2 py-0.5 shrink-0`}>
                                                        {isLocked ? (
                                                            <Lock className="mr-1 h-3.5 w-3.5" />
                                                        ) : (
                                                            <status.icon className="mr-1 h-3.5 w-3.5" />
                                                        )}
                                                        {isLocked ? 'Locked' : status.label}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs text-muted-foreground">
                                                        Closing: {request.closing_date ? format(new Date(request.closing_date), 'MMM d, yyyy') : '—'}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => window.open(`/dashboard/requests/${request.id}`, '_self')}
                                                    >
                                                        <Eye className="mr-1.5 h-4 w-4" />
                                                        View
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className={`${filteredRequests.length > 0 ? 'hidden md:block' : ''} rounded-lg border border-border overflow-x-auto`}>
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-border hover:bg-transparent">
                                            <TableHead className="text-muted-foreground text-xs sm:text-sm">Property</TableHead>
                                            <TableHead className="text-muted-foreground text-xs sm:text-sm hidden md:table-cell">Seller</TableHead>
                                            <TableHead className="text-muted-foreground text-xs sm:text-sm hidden lg:table-cell">Closing</TableHead>
                                            <TableHead className="text-muted-foreground text-xs sm:text-sm">Status</TableHead>
                                            <TableHead className="text-muted-foreground text-xs sm:text-sm text-right w-12"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRequests.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-20 px-4">
                                                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                                                        <div className="relative mb-6">
                                                            <div className="absolute inset-0 bg-slate-600/20 blur-3xl rounded-full" />
                                                            <img
                                                                src="/utility_sheet_empty_state_illustration_1766440263415.png"
                                                                alt="No requests"
                                                                className="relative w-48 h-48 object-contain"
                                                            />
                                                        </div>
                                                        <h3 className="text-lg font-semibold text-foreground mb-2">
                                                            {searchQuery ? 'No matching requests' : 'Ready to streamline your workflow?'}
                                                        </h3>
                                                        <p className="text-sm text-muted-foreground mb-8">
                                                            {searchQuery
                                                                ? `We couldn't find any requests matching "${searchQuery}". Try a different search term.`
                                                                : "You haven't created any requests yet. Start by sending a link to your seller to collect their utility information."}
                                                        </p>
                                                        {!searchQuery && (
                                                            <Link href="/dashboard/requests/new">
                                                                <Button className="bg-slate-600 hover:bg-slate-700 text-white shadow-lg shadow-slate-500/20">
                                                                    <Plus className="mr-2 h-4 w-4" />
                                                                    Create First Request
                                                                </Button>
                                                            </Link>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredRequests.map((request) => {
                                                const status = statusConfig[request.status];
                                                const isLocked = Boolean(request.is_locked);
                                                return (
                                                    <TableRow key={request.id} className="border-border hover:bg-muted/30">
                                                        <TableCell className="py-3 sm:py-4">
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-foreground text-sm sm:text-base truncate max-w-[180px] sm:max-w-none">{request.property_address}</p>
                                                                <p className="text-xs sm:text-sm text-muted-foreground md:hidden truncate">
                                                                    {request.seller_name || 'No seller info'}
                                                                </p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                                                            {request.seller_name || '—'}
                                                        </TableCell>
                                                        <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                                                            {request.closing_date
                                                                ? format(new Date(request.closing_date), 'MMM d')
                                                                : '—'
                                                            }
                                                        </TableCell>
                                                        <TableCell className="py-3 sm:py-4">
                                                            <Badge variant="outline" className={`${status.color} border text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5`}>
                                                                {isLocked ? (
                                                                    <Lock className="mr-0.5 sm:mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                                ) : (
                                                                    <status.icon className="mr-0.5 sm:mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                                )}
                                                                <span className="hidden sm:inline">{isLocked ? 'Locked' : status.label}</span>
                                                                <span className="sm:hidden">{isLocked ? 'Locked' : status.label.split(' ')[0]}</span>
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right py-3 sm:py-4">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="bg-popover border-border">
                                                                    {!isLocked && (
                                                                        <DropdownMenuItem
                                                                            className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                                                                            onClick={() => copyLink(request.seller_token || request.public_token || '')}
                                                                        >
                                                                            <Copy className="mr-2 h-4 w-4" />
                                                                            Copy seller link
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuItem
                                                                        className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                                                                        onClick={() => window.open(`/dashboard/requests/${request.id}`, '_self')}
                                                                    >
                                                                        <Eye className="mr-2 h-4 w-4" />
                                                                        View details
                                                                    </DropdownMenuItem>
                                                                    {!isLocked && request.status === 'submitted' && (
                                                                        <>
                                                                            <DropdownMenuItem
                                                                                className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                                                                                onClick={() => window.open(`/packet/${request.public_token}`, '_blank')}
                                                                            >
                                                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                                                View info sheet
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem
                                                                                className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                                                                                onClick={() => handleDownloadPdf(request.public_token)}
                                                                                disabled={downloadingPdfToken === request.public_token}
                                                                            >
                                                                                {downloadingPdfToken === request.public_token ? (
                                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                                ) : (
                                                                                    <Download className="mr-2 h-4 w-4" />
                                                                                )}
                                                                                {downloadingPdfToken === request.public_token ? 'Generating...' : 'Download PDF'}
                                                                            </DropdownMenuItem>
                                                                        </>
                                                                    )}
                                                                    {!isLocked && ['sent', 'in_progress'].includes(request.status) && (
                                                                        <DropdownMenuItem
                                                                            className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
                                                                            disabled={sendingReminderId === request.id}
                                                                            onClick={() => handleSendReminder(request.id, request.seller_name || undefined)}
                                                                        >
                                                                            {sendingReminderId === request.id ? (
                                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                            ) : (
                                                                                <Mail className="mr-2 h-4 w-4" />
                                                                            )}
                                                                            {sendingReminderId === request.id ? 'Sending...' : 'Send reminder'}
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <Separator className="my-1 bg-border" />
                                                                    <DropdownMenuItem
                                                                        className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                                                                        disabled={deletingId === request.id}
                                                                        onClick={() => handleDeleteRequest(request.id)}
                                                                    >
                                                                        {deletingId === request.id ? (
                                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                                        )}
                                                                        {deletingId === request.id ? 'Deleting...' : 'Delete request'}
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {meta.totalPages > 1 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-4 border-t border-border mt-4">
                                    <div className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
                                        <span className="font-medium text-foreground">{((meta.page - 1) * meta.limit) + 1}</span>-<span className="font-medium text-foreground">{Math.min(meta.page * meta.limit, meta.total)}</span> of <span className="font-medium text-foreground">{meta.total}</span>
                                    </div>
                                    <div className="flex gap-2 order-1 sm:order-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="border-border text-foreground hover:bg-muted h-9 px-3 text-xs sm:text-sm active:scale-[0.98]"
                                        >
                                            Prev
                                        </Button>
                                        <div className="hidden sm:flex items-center gap-1">
                                            {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => {
                                                // Show first 5 pages or adjust based on current
                                                let pageNum = i + 1;
                                                if (meta.totalPages > 5 && currentPage > 3) {
                                                    pageNum = Math.min(currentPage - 2 + i, meta.totalPages - 4 + i);
                                                }
                                                return (
                                                    <Button
                                                        key={pageNum}
                                                        variant={currentPage === pageNum ? "secondary" : "ghost"}
                                                        size="sm"
                                                        onClick={() => setCurrentPage(pageNum)}
                                                        className={`w-8 h-8 p-0 ${currentPage === pageNum ? 'bg-slate-600/10 text-slate-500 border border-slate-500/30' : 'text-muted-foreground'}`}
                                                    >
                                                        {pageNum}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                        <span className="sm:hidden flex items-center text-sm text-muted-foreground px-2">
                                            {currentPage}/{meta.totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.min(meta.totalPages, prev + 1))}
                                            disabled={currentPage === meta.totalPages}
                                            className="border-border text-foreground hover:bg-muted h-9 px-3 text-xs sm:text-sm active:scale-[0.98]"
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
