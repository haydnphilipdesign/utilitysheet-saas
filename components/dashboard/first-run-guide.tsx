'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    ArrowUpRight,
    Check,
    Download,
    FileText,
    Loader2,
    MailWarning,
    Palette,
    RotateCcw,
} from 'lucide-react';

import { ReusableLinkActions } from '@/components/dashboard/reusable-link-actions';
import { SampleSheetDialog } from '@/components/test-drive/SampleSheetDialog';
import { TestDriveAreaForm } from '@/components/test-drive/TestDriveAreaForm';
import { useTestDrive } from '@/components/test-drive/use-test-drive';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trackEvent } from '@/lib/analytics/events';
import { REQUEST_NEEDS_ATTENTION_DAYS } from '@/lib/requests/listing';
import { cn } from '@/lib/utils';

export type FirstRunSellerLink = {
    url: string;
    isActive?: boolean;
};

type FirstRunGuideProps = {
    totalRequests: number;
    submittedRequests: number;
    sellerLink: FirstRunSellerLink | null;
    sellerLinkError: boolean;
    copied: boolean;
    onCopyLink: () => void;
    onCopySms: () => void;
    onOpenEmail: () => void;
    onOpenLink: () => void;
    onRetrySellerLink: () => void;
    onHide: (completedSteps: number) => void;
};

type StepStatus = 'done' | 'current' | 'upcoming';

const newTabHint = <span className="sr-only"> (opens in a new tab)</span>;

function outlineLinkClass(className?: string) {
    return cn(buttonVariants({ variant: 'outline', size: 'sm', className }));
}

function StepMarker({ index, status }: { index: number; status: StepStatus }) {
    if (status === 'done') {
        return (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500" aria-hidden="true">
                <Check className="h-4 w-4" />
            </span>
        );
    }
    return (
        <span
            className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                status === 'current'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-background text-muted-foreground'
            )}
            aria-hidden="true"
        >
            {index}
        </span>
    );
}

function Step({
    index,
    status,
    title,
    doneSummary,
    children,
}: {
    index: number;
    status: StepStatus;
    title: string;
    doneSummary?: ReactNode;
    children?: ReactNode;
}) {
    const statusLabel = status === 'done' ? 'Done' : status === 'current' ? 'Next step' : 'Not started';
    return (
        <li className="relative flex gap-3 sm:gap-4">
            <StepMarker index={index} status={status} />
            <div className="min-w-0 flex-1 pb-1">
                <h3 className="flex flex-wrap items-center gap-x-2 text-base font-semibold text-foreground">
                    {title}{' '}
                    <span className="sr-only">({statusLabel})</span>
                </h3>
                <div className="mt-1 space-y-3 text-sm text-muted-foreground">
                    {status === 'done' && doneSummary ? doneSummary : children}
                </div>
            </div>
        </li>
    );
}

function InlineNotice({ children }: { children: ReactNode }) {
    return (
        <p role="status" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <MailWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{children}</span>
        </p>
    );
}

/**
 * Dashboard first-run guide: three steps from sign-up to a first finished
 * sheet. Shown until the workspace has a submitted real sheet. Step 1 is the
 * private seller test, step 2 the reusable link, step 3 the first submission.
 */
export function FirstRunGuide({
    totalRequests,
    submittedRequests,
    sellerLink,
    sellerLinkError,
    copied,
    onCopyLink,
    onCopySms,
    onOpenEmail,
    onOpenLink,
    onRetrySellerLink,
    onHide,
}: FirstRunGuideProps) {
    const headingId = useId();
    const testDrive = useTestDrive('dashboard');
    const [sampleOpen, setSampleOpen] = useState(false);
    const viewedRef = useRef(false);

    const testDone = testDrive.state?.status === 'completed' || testDrive.state?.status === 'ineligible';
    const sentDone = totalRequests > 0;
    const submittedDone = submittedRequests > 0;
    const completedSteps = [testDone, sentDone, submittedDone].filter(Boolean).length;
    // Steps are not strictly ordered: the test is recommended, not required.
    const currentStep = !testDone && !sentDone ? 1 : !sentDone ? 2 : !submittedDone ? 3 : null;
    const statusFor = (step: number, done: boolean): StepStatus =>
        done ? 'done' : currentStep === step ? 'current' : 'upcoming';

    useEffect(() => {
        if (viewedRef.current || testDrive.loading) return;
        viewedRef.current = true;
        trackEvent('first_run_guide_viewed', { completed_steps: completedSteps });
    }, [completedSteps, testDrive.loading]);

    const sellerLinkUsable = Boolean(sellerLink?.url) && sellerLink?.isActive !== false;

    const anotherAreaForm = (testDrive.state?.status === 'ready' || testDrive.state?.status === 'completed')
        && testDrive.state.canStartAnother ? (
            <TestDriveAreaForm
                mode="another"
                starting={testDrive.starting}
                error={testDrive.areaError}
                onStart={testDrive.start}
                onClearError={testDrive.clearAreaError}
                buttonClassName="min-h-11 sm:min-h-8"
            />
        ) : null;

    const renderTestStep = () => {
        if (testDrive.error) {
            return (
                <>
                    <p role="alert">{testDrive.error}</p>
                    <Button type="button" variant="outline" size="sm" onClick={testDrive.load} disabled={testDrive.loading} className="min-h-11 sm:min-h-8">
                        {testDrive.loading ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                        Try again
                    </Button>
                </>
            );
        }

        if (!testDrive.state) {
            return (
                <p aria-busy="true" className="flex items-center gap-2 text-xs">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Checking your seller test…
                </p>
            );
        }

        if (testDrive.state.status === 'ready') {
            const { sellerUrl, invitationDelivery } = testDrive.state;
            return (
                <>
                    <p>
                        Your test is started. Pick up where you left off
                        {invitationDelivery === 'sent' ? ', or open the test link we emailed you to try it on your phone' : ''}.
                    </p>
                    {invitationDelivery === 'failed' ? (
                        <InlineNotice>We could not email you the test link. You can still open it here.</InlineNotice>
                    ) : null}
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Link
                            href={sellerUrl}
                            onClick={() => trackEvent('test_drive_opened', { source: 'dashboard', action: 'resume' })}
                            className={cn(buttonVariants({ size: 'sm' }), 'min-h-11 sm:min-h-8')}
                        >
                            <ArrowRight />
                            Resume seller test
                        </Link>
                    </div>
                    {anotherAreaForm}
                </>
            );
        }

        return (
            <>
                <p>
                    Fill in a test request with made-up answers on the same short form your sellers use. You get
                    the finished sheet and PDF they would create. It does not count toward your plan.
                </p>
                <TestDriveAreaForm
                    mode="first"
                    starting={testDrive.starting}
                    error={testDrive.areaError}
                    onStart={testDrive.start}
                    onClearError={testDrive.clearAreaError}
                    buttonVariant={currentStep === 1 ? 'default' : 'outline'}
                    buttonClassName="min-h-11 sm:min-h-8"
                >
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                            trackEvent('first_run_guide_action', { action: 'sample_sheet' });
                            setSampleOpen(true);
                        }}
                        className="min-h-11 sm:min-h-8"
                    >
                        <FileText />
                        Or view a sample sheet
                    </Button>
                </TestDriveAreaForm>
            </>
        );
    };

    const testDoneSummary = testDrive.state?.status === 'completed' ? (
        <>
            <p>
                {testDrive.state.delivery === 'sent'
                    ? 'Your test sheet is ready. We also emailed it, with the PDF, to your account email.'
                    : 'Your test sheet is ready. Real seller submissions arrive the same way.'}
            </p>
            {testDrive.state.delivery === 'failed' ? (
                <InlineNotice>We could not email your copy, but your test sheet is saved. Open it here.</InlineNotice>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <a
                    href={testDrive.state.reviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent('test_drive_output_opened', { source: 'dashboard', output: 'web' })}
                    className={outlineLinkClass('min-h-11 sm:min-h-8')}
                >
                    <ArrowUpRight />
                    Open test sheet
                    {newTabHint}
                </a>
                <a
                    href={testDrive.state.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent('test_drive_output_opened', { source: 'dashboard', output: 'pdf' })}
                    className={outlineLinkClass('min-h-11 sm:min-h-8')}
                >
                    <Download />
                    Download PDF
                    {newTabHint}
                </a>
            </div>
            {anotherAreaForm}
        </>
    ) : (
        <p>You have already seen the seller side.</p>
    );

    const renderSendStep = () => (
        <>
            <p>
                Sellers open your link, enter the property address, and answer a short form on their phone. They do
                not need an account. Use the same link for every property.
            </p>
            {sellerLinkUsable && sellerLink ? (
                <ReusableLinkActions
                    url={sellerLink.url}
                    copied={copied}
                    onCopyLink={onCopyLink}
                    onCopySms={onCopySms}
                    onOpenEmail={onOpenEmail}
                    onOpenLink={onOpenLink}
                />
            ) : sellerLink?.isActive === false ? (
                <p role="status" className="rounded-lg border border-border bg-muted/20 p-3">
                    Your seller form is paused.{' '}
                    <Link href="/dashboard/forms" className="font-medium text-primary hover:underline">
                        Resume it in Seller forms
                    </Link>{' '}
                    to share it.
                </p>
            ) : (
                <div role={sellerLinkError ? 'alert' : 'status'} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
                    <p>We could not load your seller link right now.</p>
                    <Button type="button" variant="outline" size="sm" onClick={onRetrySellerLink}>
                        <RotateCcw />
                        Retry
                    </Button>
                </div>
            )}
            <p className="text-xs">
                Have a property but want to fill in the address and seller yourself?{' '}
                <Link
                    href="/dashboard/requests/new"
                    onClick={() => trackEvent('first_run_guide_action', { action: 'new_request' })}
                    className="font-medium text-primary hover:underline"
                >
                    Create a request for one property
                </Link>
                .
            </p>
            <p className="text-xs">
                No seller to send it to today? Add the link to your email signature, listing checklist, or text
                templates so it is ready for the next one.
            </p>
        </>
    );

    return (
        <Card aria-labelledby={headingId} className="gap-0 border-primary/25 bg-card/70 py-0 backdrop-blur-sm">
            <CardHeader className="border-b border-border/60 py-4 sm:py-5">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">Getting started</p>
                <CardTitle>
                    <h2 id={headingId} className="mt-1 text-lg font-semibold text-foreground">
                        Get your first utility sheet
                    </h2>
                </CardTitle>
                <CardDescription className="mt-1 max-w-2xl">
                    Your seller fills in the details. You get a finished sheet and PDF to share with the buyer.
                </CardDescription>
                <div className="mt-4 flex items-center gap-3">
                    <div
                        role="progressbar"
                        aria-label="Getting started progress"
                        aria-valuemin={0}
                        aria-valuemax={3}
                        aria-valuenow={completedSteps}
                        aria-valuetext={`${completedSteps} of 3 steps done`}
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                    >
                        <div
                            className="h-full rounded-full bg-primary transition-[width] duration-500"
                            style={{ width: `${(completedSteps / 3) * 100}%` }}
                        />
                    </div>
                    <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                        {completedSteps} of 3 done
                    </span>
                </div>
            </CardHeader>

            <CardContent className="py-5">
                <ol className="space-y-6">
                    <Step
                        index={1}
                        status={statusFor(1, testDone)}
                        title="Try it as your seller"
                        doneSummary={testDoneSummary}
                    >
                        {renderTestStep()}
                    </Step>
                    <Step
                        index={2}
                        status={statusFor(2, sentDone)}
                        title="Send your link to a seller"
                        doneSummary={
                            <p>
                                Your first request is in.{' '}
                                <Link
                                    href="/dashboard/requests"
                                    onClick={() => trackEvent('first_run_guide_action', { action: 'view_requests' })}
                                    className="font-medium text-primary hover:underline"
                                >
                                    View requests
                                </Link>
                            </p>
                        }
                    >
                        {renderSendStep()}
                    </Step>
                    <Step index={3} status={statusFor(3, submittedDone)} title="Get your first finished sheet">
                        {sentDone ? (
                            <>
                                <p>
                                    Waiting on your seller. As soon as they submit, the finished sheet appears in
                                    Requests, ready to review, download as a PDF, and share with the buyer.
                                </p>
                                <p>
                                    Most sellers finish the same day. If yours has not after {REQUEST_NEEDS_ATTENTION_DAYS} days,
                                    the request moves to Needs your attention, where you can send the link again.
                                </p>
                                <Link
                                    href="/dashboard/requests"
                                    onClick={() => trackEvent('first_run_guide_action', { action: 'view_requests' })}
                                    className={outlineLinkClass('min-h-11 w-fit sm:min-h-8')}
                                >
                                    View requests
                                </Link>
                            </>
                        ) : (
                            <p>
                                When your seller submits, the finished sheet appears here, ready to review, download as
                                a PDF, and share with the buyer.
                            </p>
                        )}
                    </Step>
                </ol>

                <div className="mt-6 flex flex-col gap-2 border-t border-border/70 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-start gap-2 text-muted-foreground">
                        <Palette className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        Optional: put your name, colors, and contact details on every sheet.
                    </p>
                    <Link
                        href="/onboarding"
                        onClick={() => trackEvent('first_run_guide_action', { action: 'branding' })}
                        className="shrink-0 font-medium text-primary hover:underline"
                    >
                        Add your branding
                    </Link>
                </div>
                <div className="mt-3 flex justify-end">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onHide(completedSteps)}
                        className="text-xs text-muted-foreground"
                    >
                        Hide this guide
                    </Button>
                </div>
            </CardContent>

            <SampleSheetDialog open={sampleOpen} onOpenChange={setSampleOpen} source="dashboard" />
        </Card>
    );
}
