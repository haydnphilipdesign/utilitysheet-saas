'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@stackframe/stack';
import { format } from 'date-fns';
import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Clock3,
    Link2,
    Loader2,
    Megaphone,
    RotateCcw,
    Settings2,
} from 'lucide-react';
import { toast } from 'sonner';

import { ReusableLinkActions } from '@/components/dashboard/reusable-link-actions';
import { ReferralCreditCard } from '@/components/referrals/referral-credit-card';
import { RequestListActions } from '@/components/requests/RequestListActions';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardSkeleton } from '@/components/ui/dashboard-skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { generatePacketPdf } from '@/lib/pdf-generator';
import { trackEvent } from '@/lib/analytics/events';
import { mergeFeaturedProductUpdate } from '@/lib/product-updates';
import type { DashboardStats, ProductUpdate, Request } from '@/types';

type DashboardRequest = Request & { can_edit_submitted_sheet?: boolean };

type WorkListState = {
    requests: DashboardRequest[];
    total: number;
    error: string | null;
};

type WorkSectionProps = {
    title: string;
    description: string;
    href: string;
    linkLabel: string;
    requests: DashboardRequest[];
    total: number;
    error: string | null;
    emptyTitle: string;
    emptyDescription: string;
    onRetry: () => void;
    onCopySellerLink: (request: Request) => void;
    onSendReminder: (request: Request) => void;
    onDownloadPdf: (request: Request) => void;
    sendingReminderId: string | null;
    downloadingPdfToken: string | null;
};

const EMPTY_STATS: DashboardStats = {
    total_requests: 0,
    draft: 0,
    sent: 0,
    in_progress: 0,
    submitted: 0,
    needs_attention: 0,
};

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
    return response.json() as Promise<T>;
}

function DashboardRequestRow({
    request,
    onCopySellerLink,
    onSendReminder,
    onDownloadPdf,
    sendingReminder,
    downloadingPdf,
}: {
    request: DashboardRequest;
    onCopySellerLink: (request: Request) => void;
    onSendReminder: (request: Request) => void;
    onDownloadPdf: (request: Request) => void;
    sendingReminder: boolean;
    downloadingPdf: boolean;
}) {
    return (
        <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <Link
                href={`/dashboard/requests/${request.id}`}
                className="group min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-foreground group-hover:text-primary">
                        {request.property_address}
                    </span>
                    <StatusBadge status={request.status} locked={Boolean(request.is_locked)} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                    {request.seller_name || 'Seller not added'}
                    <span aria-hidden="true"> · </span>
                    Last activity {format(new Date(request.last_activity_at), 'MMM d')}
                </p>
            </Link>

            <div className="shrink-0 self-start sm:self-center">
                <RequestListActions
                    request={request}
                    layout="desktop"
                    onCopySellerLink={onCopySellerLink}
                    onSendReminder={onSendReminder}
                    onDownloadPdf={onDownloadPdf}
                    sendingReminder={sendingReminder}
                    downloadingPdf={downloadingPdf}
                />
            </div>
        </div>
    );
}

function WorkSection({
    title,
    description,
    href,
    linkLabel,
    requests,
    total,
    error,
    emptyTitle,
    emptyDescription,
    onRetry,
    onCopySellerLink,
    onSendReminder,
    onDownloadPdf,
    sendingReminderId,
    downloadingPdfToken,
}: WorkSectionProps) {
    return (
        <Card className="gap-0 border-border bg-card/60 py-0 backdrop-blur-sm">
            <CardHeader className="border-b border-border/70 py-4 sm:py-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <CardTitle>
                            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                        </CardTitle>
                        <CardDescription className="mt-1">{description}</CardDescription>
                    </div>
                    <Link
                        href={href}
                        className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {linkLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            </CardHeader>

            <CardContent className="px-0">
                {error ? (
                    <div role="alert" className="flex min-h-52 flex-col items-center justify-center px-6 py-8 text-center">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                        </div>
                        <p className="font-medium text-foreground">{error}</p>
                        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                            Try again, or open the full Requests workspace.
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            aria-label="Retry dashboard work"
                            onClick={onRetry}
                        >
                            <RotateCcw />
                            Retry
                        </Button>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="flex min-h-52 flex-col items-center justify-center px-6 py-8 text-center">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="font-medium text-foreground">{emptyTitle}</p>
                        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{emptyDescription}</p>
                    </div>
                ) : (
                    <div>
                        {requests.map((request) => (
                            <DashboardRequestRow
                                key={request.id}
                                request={request}
                                onCopySellerLink={onCopySellerLink}
                                onSendReminder={onSendReminder}
                                onDownloadPdf={onDownloadPdf}
                                sendingReminder={sendingReminderId === request.id}
                                downloadingPdf={downloadingPdfToken === request.public_token}
                            />
                        ))}
                        {total > requests.length ? (
                            <div className="border-t border-border/70 px-4 py-3 text-center text-xs text-muted-foreground">
                                Showing {requests.length} of {total}
                            </div>
                        ) : null}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function MetricLink({
    href,
    label,
    value,
    icon: Icon,
    tone,
    ariaLabel,
}: {
    href: string;
    label: string;
    value: number;
    icon: typeof Clock3;
    tone: string;
    ariaLabel?: string;
}) {
    return (
        <Link
            href={href}
            aria-label={ariaLabel}
            className="group rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
            <Card className="h-full border-border bg-card/50 transition-colors group-hover:bg-card group-focus-visible:bg-card">
                <CardContent className="flex items-center justify-between gap-3 px-4 py-1 sm:py-2">
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
                    </div>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/70 ${tone}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

export default function DashboardPage() {
    const stackUser = useUser();
    const firstRunLinkViewedRef = useRef(false);
    const [attentionWork, setAttentionWork] = useState<WorkListState>({
        requests: [],
        total: 0,
        error: null,
    });
    const [recentWork, setRecentWork] = useState<WorkListState>({
        requests: [],
        total: 0,
        error: null,
    });
    const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
    const [statsLoaded, setStatsLoaded] = useState(false);
    const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number; plan: string } | null>(null);
    const [showSetupPrompt, setShowSetupPrompt] = useState(false);
    const [intakeLink, setIntakeLink] = useState<{ url: string; slug: string } | null>(null);
    const [intakeError, setIntakeError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [copiedDashboardLink, setCopiedDashboardLink] = useState(false);
    const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
    const [downloadingPdfToken, setDownloadingPdfToken] = useState<string | null>(null);
    const [updates, setUpdates] = useState<ProductUpdate[]>([]);
    const [updatesLoading, setUpdatesLoading] = useState(true);
    const [dismissedUpdateId, setDismissedUpdateId] = useState<string | null>(null);

    const loadDashboardData = useCallback(async () => {
        setLoading(true);
        setAttentionWork((current) => ({ ...current, error: null }));
        setRecentWork((current) => ({ ...current, error: null }));
        setIntakeError(false);

        const [attentionResult, recentResult, statsResult, accountResult, intakeResult] = await Promise.allSettled([
            fetchJson<{ data: DashboardRequest[]; total: number }>(
                '/api/requests?status=needs_attention&sort=last_activity_desc&page=1&limit=4'
            ),
            fetchJson<{ data: DashboardRequest[]; total: number }>(
                '/api/requests?status=submitted&sort=last_activity_desc&page=1&limit=4'
            ),
            fetchJson<DashboardStats>('/api/requests?stats=true'),
            fetchJson<{
                usage?: { used: number; limit: number; plan: string };
                account?: { onboarding_completed_at?: string | null };
            }>('/api/account'),
            fetchJson<{ intakeLink?: { url: string; slug: string } }>('/api/intake-link'),
        ]);

        if (attentionResult.status === 'fulfilled') {
            setAttentionWork({
                requests: attentionResult.value.data,
                total: attentionResult.value.total,
                error: null,
            });
        } else {
            console.error('Error fetching requests needing attention:', attentionResult.reason);
            setAttentionWork({
                requests: [],
                total: 0,
                error: 'We could not load requests needing attention.',
            });
        }

        if (recentResult.status === 'fulfilled') {
            setRecentWork({
                requests: recentResult.value.data,
                total: recentResult.value.total,
                error: null,
            });
        } else {
            console.error('Error fetching recently submitted requests:', recentResult.reason);
            setRecentWork({
                requests: [],
                total: 0,
                error: 'We could not load recently submitted requests.',
            });
        }

        if (statsResult.status === 'fulfilled') {
            setStats(statsResult.value);
            setStatsLoaded(true);
        } else {
            console.error('Error fetching dashboard stats:', statsResult.reason);
            setStatsLoaded(false);
        }

        if (accountResult.status === 'fulfilled') {
            setUsageInfo(accountResult.value.usage || null);
            setShowSetupPrompt(!accountResult.value.account?.onboarding_completed_at);
        } else {
            console.error('Error fetching dashboard account context:', accountResult.reason);
            setUsageInfo(null);
        }

        if (intakeResult.status === 'fulfilled' && intakeResult.value.intakeLink?.url) {
            setIntakeLink(intakeResult.value.intakeLink);
        } else {
            if (intakeResult.status === 'rejected') {
                console.error('Error fetching reusable seller link:', intakeResult.reason);
            }
            setIntakeError(true);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        void loadDashboardData();
    }, [loadDashboardData]);

    useEffect(() => {
        const savedDismissedId = localStorage.getItem('dismissedUpdateId');
        if (savedDismissedId) {
            setDismissedUpdateId(savedDismissedId);
        }

        async function fetchUpdates() {
            setUpdatesLoading(true);
            try {
                const data = await fetchJson<ProductUpdate[]>('/api/updates?limit=3');
                setUpdates(mergeFeaturedProductUpdate(Array.isArray(data) ? data : []));
            } catch (error) {
                console.error('Error fetching updates:', error);
                setUpdates(mergeFeaturedProductUpdate([]));
            } finally {
                setUpdatesLoading(false);
            }
        }

        void fetchUpdates();
    }, []);

    useEffect(() => {
        if (!showSetupPrompt || !intakeLink?.url || firstRunLinkViewedRef.current) {
            return;
        }

        firstRunLinkViewedRef.current = true;
        trackEvent('dashboard_first_run_link_viewed', {
            source: 'dashboard_first_run_card',
        });
    }, [intakeLink?.url, showSetupPrompt]);

    const handleCopyDashboardIntakeLink = useCallback(async () => {
        if (!intakeLink?.url) return;
        try {
            await navigator.clipboard.writeText(intakeLink.url);
            setCopiedDashboardLink(true);
            setTimeout(() => setCopiedDashboardLink(false), 2000);
            trackEvent('seller_link_copied', {
                source: showSetupPrompt ? 'dashboard_first_run_card' : 'dashboard_reusable_link_card',
            });
        } catch {
            toast.error('Failed to copy link');
        }
    }, [intakeLink?.url, showSetupPrompt]);

    const handleCopyReusableLinkSms = useCallback(async () => {
        if (!intakeLink?.url) return;
        try {
            await navigator.clipboard.writeText(
                `Hi, please use this link to fill in the utility providers for your property. It takes about 2 minutes and no account is needed: ${intakeLink.url}`
            );
            trackEvent('seller_link_sms_copied', {
                source: showSetupPrompt ? 'dashboard_first_run_card' : 'dashboard_reusable_link_card',
            });
            toast.success('SMS text copied');
        } catch {
            toast.error('Failed to copy SMS text');
        }
    }, [intakeLink?.url, showSetupPrompt]);

    const handleOpenReusableLinkEmail = useCallback(() => {
        if (!intakeLink?.url) return;
        const subject = encodeURIComponent('Utility Information Request');
        const body = encodeURIComponent(
            `Hi,\n\nPlease use the link below to fill in the utility providers for your property. It takes about 2 minutes and no account is needed.\n\n${intakeLink.url}\n\nThank you.`
        );

        trackEvent('seller_link_email_opened', {
            source: showSetupPrompt ? 'dashboard_first_run_card' : 'dashboard_reusable_link_card',
        });
        window.open(`mailto:?subject=${subject}&body=${body}`);
    }, [intakeLink?.url, showSetupPrompt]);

    const handleCopySellerLink = useCallback(async (request: Request) => {
        const token = request.seller_token || request.public_token;
        if (!token) return;
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
            toast.success('Seller link copied');
        } catch {
            toast.error('Failed to copy seller link');
        }
    }, []);

    const handleSendReminder = useCallback(async (request: Request) => {
        setSendingReminderId(request.id);
        try {
            const response = await fetch(`/api/requests/${request.id}/remind`, { method: 'POST' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || 'Failed to send reminder');
            }
            toast.success(`Reminder sent to ${request.seller_name || 'seller'}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to send reminder');
        } finally {
            setSendingReminderId(null);
        }
    }, []);

    const handleDownloadPdf = useCallback(async (request: Request) => {
        setDownloadingPdfToken(request.public_token);
        try {
            await generatePacketPdf(request.public_token);
            toast.success('PDF downloaded successfully');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Failed to generate PDF. Please try again.');
        } finally {
            setDownloadingPdfToken(null);
        }
    }, []);

    const handleDismissUpdates = () => {
        if (updates.length === 0) return;
        localStorage.setItem('dismissedUpdateId', updates[0].id);
        setDismissedUpdateId(updates[0].id);
    };

    if (loading) {
        return <DashboardSkeleton />;
    }

    const hasAnyRequests = stats.total_requests > 0
        || attentionWork.requests.length > 0
        || recentWork.requests.length > 0;
    const hasNewUpdates = updates.length > 0 && updates[0].id !== dismissedUpdateId;
    const hasFiniteUsage = Boolean(
        usageInfo
        && Number.isFinite(usageInfo.limit)
        && usageInfo.limit > 0
        && usageInfo.limit < 999999
    );
    const usageRemaining = hasFiniteUsage && usageInfo
        ? Math.max(usageInfo.limit - usageInfo.used, 0)
        : null;

    return (
        <div className="space-y-6 sm:space-y-8">
            <PageHeader
                title="Dashboard"
                description="Share your seller link, follow up on active work, and review completed sheets."
            />

            <Card className="gap-0 border-primary/25 bg-card/70 py-0 backdrop-blur-sm">
                <CardHeader className="border-b border-border/60 py-4 sm:py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <CardTitle>
                                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                                    <Link2 className="h-5 w-5 text-primary" />
                                    {showSetupPrompt ? 'Your seller link is ready' : 'Reusable seller link'}
                                </h2>
                            </CardTitle>
                            <CardDescription className="mt-1 max-w-3xl">
                                Share one fixed link. Sellers enter the property address and complete the utility details themselves.
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="w-fit border-primary/30 text-primary">
                            Primary workflow
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4 py-4 sm:py-5">
                    {intakeLink?.url ? (
                        <ReusableLinkActions
                            url={intakeLink.url}
                            copied={copiedDashboardLink}
                            onCopyLink={handleCopyDashboardIntakeLink}
                            onCopySms={handleCopyReusableLinkSms}
                            onOpenEmail={handleOpenReusableLinkEmail}
                            onOpenLink={() => window.open(intakeLink.url, '_blank', 'noopener,noreferrer')}
                        />
                    ) : (
                        <div role={intakeError ? 'alert' : 'status'} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-4">
                            <p className="text-sm text-muted-foreground">
                                Unable to load your reusable link right now.
                            </p>
                            <Button type="button" variant="outline" size="sm" onClick={loadDashboardData}>
                                <RotateCcw />
                                Retry
                            </Button>
                        </div>
                    )}

                    {showSetupPrompt ? (
                        <div className="rounded-lg border border-border bg-background/45 p-4">
                            <div className="grid gap-3 sm:grid-cols-3">
                                {[
                                    'Seller enters the property address',
                                    'Utility details are collected for you',
                                    'You review the completed sheet',
                                ].map((step, index) => (
                                    <div key={step} className="flex items-start gap-2 text-xs text-muted-foreground">
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                                            {index + 1}
                                        </span>
                                        <span className="pt-0.5">{step}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs text-muted-foreground">
                                    Branding and contact details are optional before your first share.
                                </p>
                                <Link href="/onboarding" className="text-xs font-medium text-primary hover:underline">
                                    Finish optional setup
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <Accordion className="border-border bg-background/35">
                            <AccordionItem value="reusable-link-help">
                                <AccordionTrigger className="min-h-10 px-3 py-2.5 text-sm">
                                    How the reusable link works
                                </AccordionTrigger>
                                <AccordionContent className="px-3 pb-3">
                                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                                        <p>Seller opens your link and enters the property address.</p>
                                        <p>They complete utility details in about 2 minutes.</p>
                                        <p>You receive the submission by email and can review it here.</p>
                                        <p>Pro and Teams can edit a submitted sheet without reopening the seller link.</p>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    )}

                    <div className="flex justify-end">
                        <Link
                            href="/dashboard/settings?tab=link"
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Settings2 className="h-3.5 w-3.5" />
                            Manage seller link settings
                        </Link>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
                <WorkSection
                    title="Needs your attention"
                    description="Sent requests that have been waiting more than three days."
                    href="/dashboard/requests?status=needs_attention"
                    linkLabel="View all"
                    requests={attentionWork.requests}
                    total={attentionWork.total}
                    error={attentionWork.error}
                    emptyTitle="Nothing needs attention"
                    emptyDescription="You are caught up. Requests that need follow-up will appear here."
                    onRetry={loadDashboardData}
                    onCopySellerLink={handleCopySellerLink}
                    onSendReminder={handleSendReminder}
                    onDownloadPdf={handleDownloadPdf}
                    sendingReminderId={sendingReminderId}
                    downloadingPdfToken={downloadingPdfToken}
                />

                <WorkSection
                    title="Recently submitted"
                    description="The latest utility sheets ready for review."
                    href="/dashboard/requests?status=submitted"
                    linkLabel="View all"
                    requests={recentWork.requests}
                    total={recentWork.total}
                    error={recentWork.error}
                    emptyTitle="No submitted sheets yet"
                    emptyDescription="Completed seller responses will appear here as soon as they are submitted."
                    onRetry={loadDashboardData}
                    onCopySellerLink={handleCopySellerLink}
                    onSendReminder={handleSendReminder}
                    onDownloadPdf={handleDownloadPdf}
                    sendingReminderId={sendingReminderId}
                    downloadingPdfToken={downloadingPdfToken}
                />
            </div>

            {statsLoaded && hasAnyRequests ? (
                <section aria-labelledby="dashboard-work-summary" className="space-y-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 id="dashboard-work-summary" className="text-sm font-semibold text-foreground">
                                Work summary
                            </h2>
                            <p className="text-xs text-muted-foreground">Open the matching Requests view to take action.</p>
                        </div>
                        {usageRemaining !== null && usageInfo ? (
                            <Link
                                href="/dashboard/settings?tab=billing"
                                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                            >
                                {usageRemaining} of {usageInfo.limit} requests remaining this month
                            </Link>
                        ) : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <MetricLink
                            href="/dashboard/requests?status=sent"
                            label="Waiting on seller"
                            value={stats.sent}
                            icon={Clock3}
                            tone="text-blue-600 dark:text-blue-400"
                        />
                        <MetricLink
                            href="/dashboard/requests?status=submitted"
                            label="Ready to review"
                            value={stats.submitted}
                            icon={CheckCircle2}
                            tone="text-emerald-600 dark:text-emerald-400"
                        />
                        <MetricLink
                            href="/dashboard/requests?status=needs_attention"
                            label="Needs attention"
                            value={stats.needs_attention}
                            icon={AlertCircle}
                            tone="text-amber-600 dark:text-amber-400"
                            ariaLabel={`Needs attention summary: ${stats.needs_attention} requests`}
                        />
                    </div>
                </section>
            ) : null}

            {hasAnyRequests ? (
                <ReferralCreditCard userId={stackUser?.id} location="dashboard" compact />
            ) : null}

            {hasNewUpdates && hasAnyRequests ? (
                <Card className="border-border bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardTitle>
                                    <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                                        <Megaphone className="h-4 w-4 text-muted-foreground" />
                                        What&apos;s new
                                    </h2>
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    Recent product updates and workflow improvements.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-1">
                                <Link href="/dashboard/updates" className="min-h-9 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                                    View all
                                </Link>
                                <Button type="button" variant="ghost" size="icon-sm" aria-label="Dismiss updates" onClick={handleDismissUpdates}>
                                    <span aria-hidden="true">×</span>
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {updatesLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading updates…
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-3">
                                {updates.map((update) => (
                                    <div key={update.id} className="rounded-lg border border-border bg-background/40 p-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium text-foreground">{update.title}</span>
                                            <Badge variant="secondary" className="capitalize">{update.category}</Badge>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {format(new Date(update.published_at), 'MMM d, yyyy')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
