'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FormsWorkspace } from '@/components/seller-forms/FormsWorkspace';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReferralCreditCard } from '@/components/referrals/referral-credit-card';
import { AccountSecuritySettings } from '@/components/settings/account-security';
import { BillingSection } from './billing-section';
import { NotificationsSection, type NotificationStatus } from './notifications-section';
import { ProfileSection } from './profile-section';
import { WorkspaceTeam } from './workspace-team';
import type {
    ActiveOrganization,
    CheckoutReturn,
    InviteLink,
    LoadState,
    NotificationPreferences,
    OrganizationMemberRow,
    PendingOrganizationInvite,
    SeatUsage,
    SettingsUser,
    Usage,
} from './types';

const SETTINGS_TABS = ['account', 'link', 'notifications', 'workspace', 'billing', 'referrals'] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function isSettingsTab(value: string | null): value is SettingsTab {
    return value !== null && (SETTINGS_TABS as readonly string[]).includes(value);
}

function getInitialSettingsTab(): SettingsTab {
    if (typeof window === 'undefined') return 'account';
    const param = new URLSearchParams(window.location.search).get('tab');
    return isSettingsTab(param) ? param : 'account';
}

// Only used to fill in keys the stored preferences do not have yet. Nothing is
// shown or saved from these until the account has loaded.
const NOTIFICATION_DEFAULTS: NotificationPreferences = {
    seller_submissions: true,
    seller_submission_pdf_attachment: true,
    collect_electric_meter_number: true,
    collect_hoa_questions: true,
    contact_resolution: true,
    weekly_summary: false,
};

// The plan arrives by webhook, so it can trail the return from checkout.
const CHECKOUT_RECHECK_MS = 3000;
const CHECKOUT_MAX_RECHECKS = 5;

type AccountResponse = {
    account?: {
        id?: string;
        full_name?: string | null;
        email?: string | null;
        notification_preferences?: Partial<NotificationPreferences> | null;
        subscription_cancel_at?: string | null;
        subscription_trial_ends_at?: string | null;
    };
    usage?: Usage;
    activeOrganization?: ActiveOrganization | null;
};

export function SettingsView({ user }: { user: SettingsUser | null }) {
    const [activeTab, setActiveTab] = useState<SettingsTab>(getInitialSettingsTab);
    const tabStripRef = useRef<HTMLDivElement>(null);
    // Set by "Start Teams" on the pricing page, carried through sign-up.
    const [arrivedForTeams] = useState(() => (
        typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('plan') === 'teams'
    ));

    const [accountState, setAccountState] = useState<LoadState>('loading');
    const [accountId, setAccountId] = useState<string | null>(null);
    const [savedName, setSavedName] = useState('');
    const [profileName, setProfileName] = useState('');
    const [email, setEmail] = useState('');
    const [usage, setUsage] = useState<Usage | null>(null);
    const [proCancelAt, setProCancelAt] = useState<string | null>(null);
    const [proTrialEndsAt, setProTrialEndsAt] = useState<string | null>(null);
    const [activeOrganization, setActiveOrganization] = useState<ActiveOrganization | null>(null);
    const [workspaceName, setWorkspaceName] = useState('');
    const [notifyAdmins, setNotifyAdmins] = useState(false);

    const [notifications, setNotifications] = useState<NotificationPreferences>(NOTIFICATION_DEFAULTS);
    const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>(null);
    const notificationsRef = useRef(notifications);
    const savedNotificationsRef = useRef(notifications);
    const notificationsSaveInFlightRef = useRef(false);
    const pendingNotificationsSaveRef = useRef<NotificationPreferences | null>(null);

    const [teamState, setTeamState] = useState<LoadState>('loading');
    const [orgMembers, setOrgMembers] = useState<OrganizationMemberRow[]>([]);
    const [orgSeatUsage, setOrgSeatUsage] = useState<SeatUsage | null>(null);
    const [pendingInvites, setPendingInvites] = useState<PendingOrganizationInvite[]>([]);
    const [inviteLink, setInviteLink] = useState<InviteLink | null>(null);

    const [checkoutPlan, setCheckoutPlan] = useState<'pro' | 'team' | null>(null);
    const [checkoutCompleted, setCheckoutCompleted] = useState(false);
    const [checkoutRechecks, setCheckoutRechecks] = useState(0);

    // Test doubles hand back a new user object on every render, so key on identity.
    const userKey = user ? user.id || user.primaryEmail || 'signed-in' : null;
    const displayName = user?.displayName || '';
    const primaryEmail = user?.primaryEmail || '';

    /** `refresh` re-reads plan and workspace without touching anything being edited. */
    const loadAccount = useCallback(async (refresh = false) => {
        if (!refresh) setAccountState('loading');
        try {
            const response = await fetch('/api/account');
            const data = (response.ok ? await response.json() : null) as AccountResponse | null;
            if (!data?.account) throw new Error('Account not loaded');

            setAccountId(data.account.id || null);
            setEmail(data.account.email || primaryEmail);
            setUsage(data.usage || null);
            setProCancelAt(data.account.subscription_cancel_at || null);
            setProTrialEndsAt(data.account.subscription_trial_ends_at || null);
            setActiveOrganization(data.activeOrganization || null);
            if (!refresh) {
                const name = data.account.full_name || displayName;
                setSavedName(name);
                setProfileName(name);
                const preferences = { ...NOTIFICATION_DEFAULTS, ...(data.account.notification_preferences || {}) };
                notificationsRef.current = preferences;
                savedNotificationsRef.current = preferences;
                setNotifications(preferences);
                setNotificationStatus(null);
                setWorkspaceName(data.activeOrganization?.name || '');
                setNotifyAdmins(data.activeOrganization?.notification_settings?.notify_admins_on_submission === true);
            }
            setAccountState('ready');
        } catch (error) {
            console.error('Error fetching account:', error);
            // A failed refresh keeps what is already on screen.
            if (!refresh) setAccountState('error');
        }
    }, [displayName, primaryEmail]);

    useEffect(() => {
        if (userKey) void loadAccount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userKey]);

    const orgIsTeam = activeOrganization?.subscription_status === 'team';
    const orgIsAdmin = activeOrganization?.role === 'admin';
    const organizationId = activeOrganization?.id || null;

    const refreshOrganization = useCallback(async () => {
        try {
            const response = await fetch('/api/organization/members');
            const data = await response.json().catch(() => ({})) as {
                error?: string;
                organization?: Partial<ActiveOrganization>;
                role?: 'admin' | 'member';
                members?: OrganizationMemberRow[];
                seatUsage?: { used?: number; pendingInvites?: number };
            };
            if (!response.ok) throw new Error(data?.error || 'Failed to load organization');

            if (data.organization) {
                setActiveOrganization((prev) => ({
                    ...(prev || { id: data.organization?.id || '' }),
                    ...data.organization,
                    role: data.role || prev?.role,
                }));
            }
            setOrgMembers(Array.isArray(data.members) ? data.members : []);
            setOrgSeatUsage(data.seatUsage ? {
                used: Number(data.seatUsage.used) || 0,
                pendingInvites: Number(data.seatUsage.pendingInvites) || 0,
            } : null);

            if (data.role === 'admin') {
                const inviteResponse = await fetch('/api/organization/invites');
                const inviteData = await inviteResponse.json().catch(() => ({})) as {
                    invites?: PendingOrganizationInvite[];
                };
                setPendingInvites(inviteResponse.ok && Array.isArray(inviteData.invites) ? inviteData.invites : []);
            } else {
                setPendingInvites([]);
            }
            setTeamState('ready');
        } catch (error) {
            console.error('Error fetching organization:', error);
            // After an action, a failed refresh keeps the last loaded list on screen.
            setTeamState((current) => (current === 'ready' ? current : 'error'));
        }
    }, []);

    useEffect(() => {
        setOrgMembers([]);
        setOrgSeatUsage(null);
        setPendingInvites([]);
        setInviteLink(null);
        setTeamState('loading');
        if (organizationId) void refreshOrganization();
    }, [organizationId, refreshOrganization]);

    const saveNotificationPreferences = async (nextNotifications: NotificationPreferences) => {
        // One save at a time; a change made meanwhile is sent next, and only the latest one.
        if (notificationsSaveInFlightRef.current) {
            pendingNotificationsSaveRef.current = nextNotifications;
            return;
        }

        notificationsSaveInFlightRef.current = true;
        let currentPreferences: NotificationPreferences | null = nextNotifications;
        try {
            while (currentPreferences) {
                pendingNotificationsSaveRef.current = null;
                const response = await fetch('/api/account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notification_preferences: currentPreferences }),
                });
                if (!response.ok) throw new Error('Failed to save notification settings');
                savedNotificationsRef.current = currentPreferences;
                currentPreferences = pendingNotificationsSaveRef.current;
            }
            setNotificationStatus((status) => (status ? { ...status, state: 'saved' } : status));
        } catch (error) {
            console.error('Error saving notification settings:', error);
            // Show what the server has, not what was attempted.
            pendingNotificationsSaveRef.current = null;
            notificationsRef.current = savedNotificationsRef.current;
            setNotifications(savedNotificationsRef.current);
            setNotificationStatus((status) => (status ? { ...status, state: 'error' } : status));
        } finally {
            notificationsSaveInFlightRef.current = false;
        }
    };

    const handleNotificationToggle = (key: keyof NotificationPreferences, checked: boolean) => {
        if (accountState !== 'ready' || notificationsRef.current[key] === checked) return;
        const next = { ...notificationsRef.current, [key]: checked };
        notificationsRef.current = next;
        setNotifications(next);
        setNotificationStatus({ key, state: 'saving' });
        void saveNotificationPreferences(next);
    };

    const handleTabChange = (value: unknown) => {
        if (typeof value !== 'string' || !isSettingsTab(value)) return;
        setActiveTab(value);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', value);
            window.history.replaceState(null, '', url.toString());
        }
    };

    // A return from Stripe checkout. The URL only says checkout ended; whether a
    // plan is active is read from the reloaded account below.
    useEffect(() => {
        const url = new URL(window.location.href);
        const teamOutcome = url.searchParams.get('team_checkout');
        const hasSession = url.searchParams.has('session_id');
        if (!teamOutcome && !hasSession) return;
        setCheckoutPlan(teamOutcome ? 'team' : 'pro');
        setCheckoutCompleted(teamOutcome ? teamOutcome === 'success' : true);
        url.searchParams.delete('team_checkout');
        url.searchParams.delete('session_id');
        window.history.replaceState(null, '', url.toString());
    }, []);

    const planVerified = accountState === 'ready'
        && (checkoutPlan === 'team' ? orgIsTeam : checkoutPlan === 'pro' ? usage?.plan === 'pro' : false);
    const checkout: CheckoutReturn | null = !checkoutPlan ? null : {
        plan: checkoutPlan,
        status: !checkoutCompleted
            ? 'not_completed'
            : planVerified
                ? 'confirmed'
                : accountState === 'error' || checkoutRechecks >= CHECKOUT_MAX_RECHECKS
                    ? 'unconfirmed'
                    : 'confirming',
    };
    const checkoutStatus = checkout?.status;

    useEffect(() => {
        if (checkoutStatus !== 'confirming' || accountState !== 'ready') return;
        const timer = setTimeout(() => {
            void loadAccount(true).then(() => setCheckoutRechecks((count) => count + 1));
        }, CHECKOUT_RECHECK_MS);
        return () => clearTimeout(timer);
    }, [checkoutStatus, accountState, checkoutRechecks, loadAccount]);

    // On a phone the tab strip scrolls sideways; keep the open tab's name in view.
    useEffect(() => {
        tabStripRef.current
            ?.querySelector('[aria-selected="true"]')
            ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }, [activeTab]);

    const retryAccount = () => void loadAccount();

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-10">
            <PageHeader title="Settings" description="Your account, seller forms, notifications, workspace and billing." />

            <Tabs value={activeTab} onValueChange={handleTabChange}>
                <div ref={tabStripRef} className="overflow-x-auto overflow-y-hidden">
                    <TabsList className="w-max">
                        <TabsTrigger value="account">Account</TabsTrigger>
                        <TabsTrigger value="link">Seller forms</TabsTrigger>
                        <TabsTrigger value="notifications">Notifications</TabsTrigger>
                        <TabsTrigger value="workspace">Workspace &amp; Team</TabsTrigger>
                        <TabsTrigger value="billing">Billing</TabsTrigger>
                        <TabsTrigger value="referrals">Referrals</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="account" className="mt-2 space-y-6 text-base">
                    <ProfileSection
                        state={accountState}
                        onRetry={retryAccount}
                        name={profileName}
                        savedName={savedName}
                        email={email}
                        onNameChange={setProfileName}
                        onSaved={(name) => {
                            setSavedName(name);
                            setProfileName(name);
                        }}
                        onSignOut={() => void user?.signOut()}
                    />
                    <AccountSecuritySettings />
                </TabsContent>

                <TabsContent value="notifications" className="mt-2 space-y-6 text-base">
                    <NotificationsSection
                        state={accountState}
                        onRetry={retryAccount}
                        notifications={notifications}
                        status={notificationStatus}
                        onToggle={handleNotificationToggle}
                        teamWorkspace={orgIsTeam}
                        onOpenWorkspace={() => handleTabChange('workspace')}
                    />
                </TabsContent>

                <TabsContent value="link" className="mt-2 space-y-6 text-base">
                    <FormsWorkspace embedded />
                </TabsContent>

                <TabsContent value="workspace" className="mt-2 space-y-6 text-base">
                    <WorkspaceTeam
                        accountState={accountState}
                        onRetryAccount={retryAccount}
                        accountId={accountId}
                        organization={activeOrganization}
                        isTeam={orgIsTeam}
                        isAdmin={orgIsAdmin}
                        workspaceName={workspaceName}
                        onWorkspaceNameChange={setWorkspaceName}
                        onOrganizationUpdated={(organization) => setActiveOrganization((current) => (
                            current ? { ...current, ...organization } : current
                        ))}
                        notifyAdmins={notifyAdmins}
                        onNotifyAdminsChange={(value, settings) => {
                            setNotifyAdmins(value);
                            if (settings) {
                                setActiveOrganization((current) => (
                                    current ? { ...current, notification_settings: settings } : current
                                ));
                            }
                        }}
                        teamState={teamState}
                        members={orgMembers}
                        seatUsage={orgSeatUsage}
                        invites={pendingInvites}
                        onRefresh={refreshOrganization}
                        inviteLink={inviteLink}
                        onInviteLink={setInviteLink}
                        onOpenBilling={() => handleTabChange('billing')}
                    />
                </TabsContent>

                <TabsContent value="referrals" className="mt-2 space-y-6 text-base">
                    <ReferralCreditCard userId={user?.id} />
                </TabsContent>

                <TabsContent value="billing" className="mt-2 space-y-6 text-base">
                    <BillingSection
                        state={accountState}
                        onRetry={retryAccount}
                        usage={usage}
                        planEndsAt={orgIsTeam ? activeOrganization?.subscription_cancel_at || null : proCancelAt}
                        trialEndsAt={proTrialEndsAt}
                        organization={activeOrganization}
                        isTeam={orgIsTeam}
                        isAdmin={orgIsAdmin}
                        seatUsage={teamState === 'ready' ? orgSeatUsage : null}
                        checkout={checkout}
                        onCheckAgain={() => {
                            setCheckoutRechecks(0);
                            void loadAccount(true);
                        }}
                        onDismissCheckout={() => setCheckoutPlan(null)}
                        onOpenWorkspace={() => handleTabChange('workspace')}
                        onSeatsChanged={refreshOrganization}
                        showTeamsFirst={arrivedForTeams}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
