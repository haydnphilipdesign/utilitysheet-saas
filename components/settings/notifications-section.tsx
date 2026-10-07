'use client';

import type { ReactNode } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { InlineStatus, LoadError, LoadingRows, SettingsSection } from './settings-ui';
import type { LoadState, NotificationPreferences, SaveState } from './types';

export type NotificationStatus = { key: keyof NotificationPreferences; state: SaveState } | null;

function SaveFeedback({ state }: { state: SaveState }) {
    if (state === 'error') {
        return (
            <InlineStatus tone="error" className="mt-1">
                We couldn’t save that, so it’s back to what was saved. Try again.
            </InlineStatus>
        );
    }
    return (
        <InlineStatus tone={state} className="mt-1">
            {state === 'saving' ? 'Saving…' : 'Saved'}
        </InlineStatus>
    );
}

function ToggleRow({ id, label, description, checked, disabled = false, dimmed = false, onChange, status }: {
    id: string;
    label: string;
    description: ReactNode;
    checked: boolean;
    disabled?: boolean;
    dimmed?: boolean;
    onChange: (checked: boolean) => void;
    status: SaveState | null;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className={cn('min-w-0', dimmed && 'opacity-60')}>
                <p id={`${id}-label`} className="text-sm font-medium text-foreground">{label}</p>
                <p id={`${id}-desc`} className="text-sm text-muted-foreground">{description}</p>
                {status && <SaveFeedback state={status} />}
            </div>
            <Switch
                className="mt-1"
                aria-labelledby={`${id}-label`}
                aria-describedby={`${id}-desc`}
                disabled={disabled}
                checked={checked}
                onCheckedChange={onChange}
            />
        </div>
    );
}

export function NotificationsSection({ state, onRetry, notifications, status, onToggle, teamWorkspace, onOpenWorkspace }: {
    state: LoadState;
    onRetry: () => void;
    notifications: NotificationPreferences;
    status: NotificationStatus;
    onToggle: (key: keyof NotificationPreferences, checked: boolean) => void;
    teamWorkspace: boolean;
    onOpenWorkspace: () => void;
}) {
    const statusFor = (key: keyof NotificationPreferences) => (status?.key === key ? status.state : null);
    return (
        <SettingsSection
            icon={Bell}
            title="Email notifications"
            description="Choose which emails UtilitySheet sends you. Each change saves as soon as you make it."
        >
            {state === 'loading' ? (
                <LoadingRows label="Loading your notification settings…" rows={3} />
            ) : state === 'error' ? (
                <LoadError message="We couldn’t load your notification settings. Nothing was changed." onRetry={onRetry} />
            ) : (
                <div className="space-y-4">
                    <ToggleRow
                        id="notif-seller-submissions"
                        label="Seller submissions"
                        description="Emails you when a seller completes a form."
                        checked={notifications.seller_submissions}
                        onChange={(checked) => onToggle('seller_submissions', checked)}
                        status={statusFor('seller_submissions')}
                    />
                    {/* PDF attachment is nested under and dependent on submission emails:
                        no submission email is sent when Seller submissions is off, so no PDF can be attached. */}
                    <div className="ml-4 border-l border-border pl-4">
                        <ToggleRow
                            id="notif-pdf-attachment"
                            label="Attach PDF to submission emails"
                            description={notifications.seller_submissions
                                ? 'Adds the utility sheet PDF as it is when the seller submits. If you edit the sheet later, new downloads change but the copy already emailed does not.'
                                : 'Turn on Seller submissions to attach the utility sheet PDF to those emails.'}
                            dimmed={!notifications.seller_submissions}
                            disabled={!notifications.seller_submissions}
                            checked={notifications.seller_submissions && notifications.seller_submission_pdf_attachment}
                            onChange={(checked) => onToggle('seller_submission_pdf_attachment', checked)}
                            status={statusFor('seller_submission_pdf_attachment')}
                        />
                    </div>
                    <Separator />
                    <ToggleRow
                        id="notif-contact-resolution"
                        label="Missing provider contact alerts"
                        description="Emails you when a seller names a utility provider and we can’t find a phone number or website for it, so you can look it up."
                        checked={notifications.contact_resolution}
                        onChange={(checked) => onToggle('contact_resolution', checked)}
                        status={statusFor('contact_resolution')}
                    />
                    {/* Weekly summary is intentionally not exposed. The cron route, query, and email
                        exist, but /api/cron/weekly-summary is not registered in vercel.json (only the
                        activation crons are), so no scheduling infrastructure runs it. Do not surface
                        this preference until a dependable weekly schedule is wired. */}
                    {teamWorkspace && (
                        <>
                            <Separator />
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    These are your own emails. Whether workspace admins are also emailed
                                    about every team submission is set in Workspace &amp; Team.
                                </p>
                                <Button variant="outline" className="shrink-0" onClick={onOpenWorkspace}>
                                    Open Workspace &amp; Team
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </SettingsSection>
    );
}
