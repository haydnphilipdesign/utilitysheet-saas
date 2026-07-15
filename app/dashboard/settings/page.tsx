'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@stackframe/stack';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { AdvancedModuleConfigurator } from '@/components/advanced-modules/AdvancedModuleConfigurator';
import { ReferralCreditCard } from '@/components/referrals/referral-credit-card';
import { Link as LinkIcon, User, Bell, Check, Copy, CreditCard, ExternalLink, Loader2, Save, Shield, Sparkles, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
    ADVANCED_MODULE_DEFAULTS,
    ADVANCED_MODULE_KEYS,
    getAdvancedModuleIncludedFieldCount,
    normalizeAdvancedModuleExclusions,
    normalizeAdvancedModules,
} from '@/lib/packet/modules';
import type { AdvancedModuleExclusions, AdvancedModuleKey, PacketMode } from '@/types';
import { trackEvent } from '@/lib/analytics/events';

type NotificationPreferences = {
    seller_submissions: boolean;
    seller_submission_pdf_attachment: boolean;
    collect_electric_meter_number: boolean;
    contact_resolution: boolean;
    weekly_summary: boolean;
};

type ActiveOrganization = {
    id: string;
    name?: string;
    slug?: string;
    role?: 'admin' | 'member';
    subscription_status?: 'free' | 'team' | 'canceled' | null;
    subscription_id?: string | null;
    subscription_ends_at?: string | null;
    seat_quantity?: number | null;
};

type OrganizationMemberRow = {
    account_id: string;
    email: string;
    full_name: string | null;
    member_role: 'admin' | 'member';
};

const SETTINGS_TABS = ['account', 'link', 'notifications', 'billing', 'referrals'] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function isSettingsTab(value: string | null): value is SettingsTab {
    return value !== null && (SETTINGS_TABS as readonly string[]).includes(value);
}

function getInitialSettingsTab(): SettingsTab {
    if (typeof window === 'undefined') return 'account';
    const param = new URLSearchParams(window.location.search).get('tab');
    return isSettingsTab(param) ? param : 'account';
}

export default function SettingsPage() {
    const stackUser = useUser();
    const [activeTab, setActiveTab] = useState<SettingsTab>(getInitialSettingsTab);
    const [accountId, setAccountId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState({
        full_name: '',
        email: '',
    });
    const [notifications, setNotifications] = useState<NotificationPreferences>({
        seller_submissions: true,
        seller_submission_pdf_attachment: true,
        collect_electric_meter_number: true,
        contact_resolution: true,
        weekly_summary: false,
    });
    const notificationsSaveInFlightRef = useRef(false);
    const pendingNotificationsSaveRef = useRef<NotificationPreferences | null>(null);
    const [usage, setUsage] = useState({
        used: 0,
        limit: 3,
        plan: 'free'
    });
    const [billingLoading, setBillingLoading] = useState(false);
    const [activeOrganization, setActiveOrganization] = useState<ActiveOrganization | null>(null);
    const [orgMembers, setOrgMembers] = useState<OrganizationMemberRow[]>([]);
    const [orgSeatUsage, setOrgSeatUsage] = useState<{ used: number; pendingInvites: number }>({ used: 0, pendingInvites: 0 });
    const [orgLoading, setOrgLoading] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
    const [inviteCopied, setInviteCopied] = useState(false);
    const [teamSeats, setTeamSeats] = useState(3);
    const [teamBillingLoading, setTeamBillingLoading] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{
        title: string;
        description: string;
        confirmLabel: string;
        destructive?: boolean;
        onConfirm: () => Promise<void> | void;
    } | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);

    const [intakeLink, setIntakeLink] = useState<{
        slug: string;
        url: string;
        is_active: boolean;
        defaultPacketMode?: PacketMode;
        advancedModules?: AdvancedModuleKey[];
        advancedModuleExclusions?: AdvancedModuleExclusions;
    } | null>(null);
    const [intakeCanCustomize, setIntakeCanCustomize] = useState(false);
    const [intakeSlugDraft, setIntakeSlugDraft] = useState('');
    const [intakeDefaultPacketMode, setIntakeDefaultPacketMode] = useState<PacketMode>('simple');
    const [intakeAdvancedModules, setIntakeAdvancedModules] = useState<AdvancedModuleKey[]>([...ADVANCED_MODULE_DEFAULTS]);
    const [intakeAdvancedModuleExclusions, setIntakeAdvancedModuleExclusions] = useState<AdvancedModuleExclusions>({});
    const [intakeSaving, setIntakeSaving] = useState(false);

    const TEAM_MIN_SEATS = 3;
    const TEAM_PRICE_PER_SEAT_USD = 7;

    const teamSeatCount = useMemo(() => {
        const normalized = Number.isFinite(teamSeats) ? Math.floor(teamSeats) : TEAM_MIN_SEATS;
        return Math.max(TEAM_MIN_SEATS, normalized);
    }, [teamSeats]);

    const teamsMonthlyTotal = useMemo(() => teamSeatCount * TEAM_PRICE_PER_SEAT_USD, [teamSeatCount]);

    const usdNoCents = useMemo(
        () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
        []
    );

    // Update profile when Stack user loads, but prefer fetching from DB
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch('/api/account');
                if (response.ok) {
                    const data = await response.json();
                    if (data.account) {
                        setAccountId(data.account.id || null);
                        setProfile({
                            full_name: data.account.full_name || stackUser?.displayName || '',
                            email: data.account.email || stackUser?.primaryEmail || '',
                        });
                        if (data.account.notification_preferences) {
                            setNotifications(prev => ({ ...prev, ...data.account.notification_preferences }));
                        }
                        if (data.usage) {
                            setUsage(data.usage);
                        }
                        setActiveOrganization(data.activeOrganization || null);
                        return;
                    }
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            }

            // Fallback to Stack user if API fails or no fetching happened yet
            if (stackUser) {
                setProfile(prev => ({
                    full_name: prev.full_name || stackUser.displayName || '',
                    email: prev.email || stackUser.primaryEmail || '',
                }));
            }
        };

        if (stackUser) {
            fetchProfile();
        }
    }, [stackUser]);

    useEffect(() => {
        const fetchIntakeLink = async () => {
            try {
                const response = await fetch('/api/intake-link');
                const data = await response.json().catch(() => ({}));
                if (!response.ok) return;

                if (data.intakeLink) {
                    const nextModules = Array.isArray(data.intakeLink.advancedModules) && data.intakeLink.advancedModules.length > 0
                        ? normalizeAdvancedModules(data.intakeLink.advancedModules)
                        : [...ADVANCED_MODULE_DEFAULTS];
                    setIntakeLink(data.intakeLink);
                    setIntakeSlugDraft(data.intakeLink.slug || '');
                    setIntakeDefaultPacketMode(data.intakeLink.defaultPacketMode || 'simple');
                    setIntakeAdvancedModules(nextModules);
                    setIntakeAdvancedModuleExclusions(
                        normalizeAdvancedModuleExclusions(
                            data.intakeLink.advancedModuleExclusions || {},
                            nextModules
                        )
                    );
                }
                setIntakeCanCustomize(Boolean(data.canCustomize));
            } catch (error) {
                console.error('Error fetching intake link:', error);
            }
        };

        if (stackUser) {
            fetchIntakeLink();
        }
    }, [stackUser]);

    const orgIsTeam = useMemo(() => activeOrganization?.subscription_status === 'team', [activeOrganization]);
    const orgIsAdmin = useMemo(() => activeOrganization?.role === 'admin', [activeOrganization]);
    const intakeSavedAdvancedModules = useMemo(
        () => intakeLink?.advancedModules && intakeLink.advancedModules.length > 0
            ? normalizeAdvancedModules(intakeLink.advancedModules)
            : ADVANCED_MODULE_DEFAULTS,
        [intakeLink?.advancedModules]
    );
    const intakeSavedAdvancedModuleExclusions = useMemo(
        () => normalizeAdvancedModuleExclusions(
            intakeLink?.advancedModuleExclusions || {},
            intakeSavedAdvancedModules
        ),
        [intakeLink?.advancedModuleExclusions, intakeSavedAdvancedModules]
    );
    const intakeModeSettingsUnchanged = useMemo(() => {
        if (!intakeLink) return true;
        const currentKey = [...intakeAdvancedModules].sort().join('|');
        const savedKey = [...intakeSavedAdvancedModules].sort().join('|');
        const currentExclusionKey = JSON.stringify(
            normalizeAdvancedModuleExclusions(intakeAdvancedModuleExclusions, intakeAdvancedModules)
        );
        const savedExclusionKey = JSON.stringify(intakeSavedAdvancedModuleExclusions);
        return intakeDefaultPacketMode === (intakeLink.defaultPacketMode || 'simple')
            && currentKey === savedKey
            && currentExclusionKey === savedExclusionKey;
    }, [
        intakeAdvancedModuleExclusions,
        intakeAdvancedModules,
        intakeDefaultPacketMode,
        intakeLink,
        intakeSavedAdvancedModuleExclusions,
        intakeSavedAdvancedModules,
    ]);
    const intakeHasAdvancedModuleWithNoFields = useMemo(() => (
        intakeAdvancedModules.some((moduleKey) => getAdvancedModuleIncludedFieldCount(moduleKey, intakeAdvancedModuleExclusions) === 0)
    ), [intakeAdvancedModuleExclusions, intakeAdvancedModules]);

    const refreshOrganization = async () => {
        if (!activeOrganization?.id) return;
        setOrgLoading(true);
        try {
            const response = await fetch('/api/organization/members');
            const data = await response.json().catch(() => ({})) as {
                error?: string;
                organization?: Partial<ActiveOrganization>;
                role?: 'admin' | 'member';
                members?: OrganizationMemberRow[];
                seatUsage?: { used?: number; pendingInvites?: number };
            };
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to load organization');
            }

            if (data.organization) {
                setActiveOrganization((prev) => ({
                    ...(prev || { id: data.organization?.id || '' }),
                    ...data.organization,
                    role: data.role || prev?.role,
                }));
            }
            if (Array.isArray(data.members)) {
                setOrgMembers(data.members);
            }
            if (data.seatUsage) {
                setOrgSeatUsage({
                    used: Number(data.seatUsage.used) || 0,
                    pendingInvites: Number(data.seatUsage.pendingInvites) || 0,
                });
            }
        } catch (error) {
            console.error('Error fetching organization:', error);
        } finally {
            setOrgLoading(false);
        }
    };

    useEffect(() => {
        if (activeOrganization?.id) {
            refreshOrganization();
        } else {
            setOrgMembers([]);
            setOrgSeatUsage({ used: 0, pendingInvites: 0 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeOrganization?.id]);

    const saveNotificationPreferences = async (nextNotifications: NotificationPreferences) => {
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
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        notification_preferences: currentPreferences,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to save notification settings');
                }

                currentPreferences = pendingNotificationsSaveRef.current;
            }
        } catch (error) {
            console.error('Error auto-saving notification settings:', error);
            toast.error('Failed to save notification settings');
        } finally {
            notificationsSaveInFlightRef.current = false;
        }
    };

    const handleNotificationToggle = (key: keyof NotificationPreferences, checked: boolean) => {
        setNotifications((prev) => {
            if (prev[key] === checked) return prev;
            const next = { ...prev, [key]: checked };
            void saveNotificationPreferences(next);
            return next;
        });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    full_name: profile.full_name,
                    notification_preferences: notifications,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save changes');
            }

            toast.success('Settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        if (stackUser) {
            await stackUser.signOut();
        }
    };

    const handleCopyIntakeLink = async () => {
        if (!intakeLink?.url) return;
        try {
            await navigator.clipboard.writeText(intakeLink.url);
            trackEvent('seller_link_copied', {
                source: 'settings_reusable_link',
            });
            toast.success('Link copied');
        } catch {
            toast.error('Failed to copy link');
        }
    };

    const handleSaveIntakeSlug = async () => {
        const slug = intakeSlugDraft.trim();
        if (!slug) return;

        setIntakeSaving(true);
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
            if (data.intakeLink) {
                setIntakeLink(data.intakeLink);
                setIntakeSlugDraft(data.intakeLink.slug || slug);
            }
            toast.success('Branded link updated');
        } catch (error: unknown) {
            console.error(error);
            const message = error instanceof Error ? error.message : 'Failed to update link';
            toast.error(message);
        } finally {
            setIntakeSaving(false);
        }
    };

    const toggleIntakeAdvancedModule = (moduleKey: AdvancedModuleKey) => {
        setIntakeAdvancedModules((prev) => (
            prev.includes(moduleKey)
                ? prev.filter((m) => m !== moduleKey)
                : ADVANCED_MODULE_KEYS.filter((candidate) => candidate === moduleKey || prev.includes(candidate))
        ));
    };

    const toggleIntakeAdvancedModuleField = (moduleKey: AdvancedModuleKey, fieldKey: string) => {
        setIntakeAdvancedModuleExclusions((prev) => {
            const current = new Set(prev[moduleKey] || []);
            if (current.has(fieldKey)) {
                current.delete(fieldKey);
            } else {
                current.add(fieldKey);
            }

            const next: AdvancedModuleExclusions = { ...prev };
            if (current.size === 0) {
                delete next[moduleKey];
            } else {
                next[moduleKey] = Array.from(current);
            }

            return normalizeAdvancedModuleExclusions(next, intakeAdvancedModules);
        });
    };

    const handleSaveDefaultPacketMode = async () => {
        if (intakeDefaultPacketMode === 'advanced' && intakeAdvancedModules.length === 0) {
            toast.error('Enable at least one module for Advanced Utility Packet mode.');
            return;
        }
        if (intakeDefaultPacketMode === 'advanced' && intakeHasAdvancedModuleWithNoFields) {
            toast.error('Each enabled module must include at least one question.');
            return;
        }
        setIntakeSaving(true);
        try {
            const normalizedExclusions = normalizeAdvancedModuleExclusions(
                intakeAdvancedModuleExclusions,
                intakeAdvancedModules
            );
            const response = await fetch('/api/intake-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    defaultPacketMode: intakeDefaultPacketMode,
                    advancedModules: intakeAdvancedModules,
                    advancedModuleExclusions: normalizedExclusions,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.message || data?.error || 'Failed to update default mode');
            }
            if (data.intakeLink) {
                const nextModules = Array.isArray(data.intakeLink.advancedModules) && data.intakeLink.advancedModules.length > 0
                    ? normalizeAdvancedModules(data.intakeLink.advancedModules)
                    : [...ADVANCED_MODULE_DEFAULTS];
                setIntakeLink(data.intakeLink);
                setIntakeDefaultPacketMode(data.intakeLink.defaultPacketMode || intakeDefaultPacketMode);
                setIntakeAdvancedModules(nextModules);
                setIntakeAdvancedModuleExclusions(
                    normalizeAdvancedModuleExclusions(
                        data.intakeLink.advancedModuleExclusions || {},
                        nextModules
                    )
                );
            }
            toast.success('Reusable link mode settings updated');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to update default mode';
            toast.error(message);
        } finally {
            setIntakeSaving(false);
        }
    };

    const handleTeamCheckout = async () => {
        setTeamBillingLoading(true);
        try {
            const response = await fetch('/api/organization/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seats: teamSeatCount }),
            });
            const data = await response.json().catch(() => ({}));
            if (data.url) {
                window.location.href = data.url;
                return;
            }
            toast.error(data.error || 'Failed to start Teams checkout');
        } catch (error) {
            console.error(error);
            toast.error('Failed to start Teams checkout');
        } finally {
            setTeamBillingLoading(false);
        }
    };

    const handleTeamPortal = async () => {
        setTeamBillingLoading(true);
        try {
            const response = await fetch('/api/organization/billing/portal', { method: 'POST' });
            const data = await response.json().catch(() => ({}));
            if (data.url) {
                window.location.href = data.url;
                return;
            }
            toast.error(data.error || 'Failed to open Teams billing portal');
        } catch (error) {
            console.error(error);
            toast.error('Failed to open Teams billing portal');
        } finally {
            setTeamBillingLoading(false);
        }
    };

    const handleInvite = async () => {
        const email = inviteEmail.trim();
        if (!email) return;

        setInviteLoading(true);
        setLastInviteUrl(null);
        try {
            const response = await fetch('/api/organization/invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.message || data?.error || 'Failed to create invite');
            }

            if (data.inviteUrl) {
                setLastInviteUrl(data.inviteUrl);
                try {
                    await navigator.clipboard.writeText(data.inviteUrl);
                    toast.success('Invite created and copied to clipboard');
                } catch {
                    toast.success('Invite created');
                }
            } else {
                toast.success('Invite created');
            }

            setInviteEmail('');
            await refreshOrganization();
        } catch (error: unknown) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to invite member');
        } finally {
            setInviteLoading(false);
        }
    };

    const handleCopyInviteUrl = async () => {
        if (!lastInviteUrl) return;
        try {
            await navigator.clipboard.writeText(lastInviteUrl);
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 2000);
        } catch {
            toast.error('Failed to copy invite link');
        }
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

    const handleConfirmDialog = async () => {
        if (!confirmDialog) return;
        setConfirmLoading(true);
        try {
            await confirmDialog.onConfirm();
        } finally {
            setConfirmLoading(false);
            setConfirmDialog(null);
        }
    };

    const performRemoveMember = async (accountId: string) => {
        try {
            const response = await fetch(`/api/organization/members/${accountId}`, { method: 'DELETE' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to remove member');
            }
            toast.success('Member removed');
            await refreshOrganization();
        } catch (error: unknown) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to remove member');
        }
    };

    const requestRemoveMember = (member: OrganizationMemberRow) => {
        setConfirmDialog({
            title: 'Remove member',
            description: `Remove ${member.full_name || member.email} from your organization? They will lose access immediately.`,
            confirmLabel: 'Remove member',
            destructive: true,
            onConfirm: () => performRemoveMember(member.account_id),
        });
    };

    const performToggleMemberRole = async (accountId: string, nextRole: 'admin' | 'member') => {
        try {
            const response = await fetch(`/api/organization/members/${accountId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: nextRole }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to update role');
            }
            toast.success('Role updated');
            await refreshOrganization();
        } catch (error: unknown) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Failed to update role');
        }
    };

    const requestToggleMemberRole = (member: OrganizationMemberRow) => {
        const nextRole = member.member_role === 'admin' ? 'member' : 'admin';
        setConfirmDialog({
            title: nextRole === 'admin' ? 'Make admin' : 'Change to member',
            description: `Change ${member.full_name || member.email}'s role to ${nextRole}?`,
            confirmLabel: 'Update role',
            onConfirm: () => performToggleMemberRole(member.account_id, nextRole),
        });
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-10">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">Settings</h1>
                <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange}>
                <div className="overflow-x-auto">
                    <TabsList className="w-max">
                        <TabsTrigger value="account">Account</TabsTrigger>
                        <TabsTrigger value="link">Seller Link</TabsTrigger>
                        <TabsTrigger value="notifications">Notifications</TabsTrigger>
                        <TabsTrigger value="billing">Billing &amp; Team</TabsTrigger>
                        <TabsTrigger value="referrals">Referrals</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="account" className="mt-2 space-y-6 text-base">
            {/* Profile Section */}
            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        Profile
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Your personal information
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName" className="text-foreground">Full Name</Label>
                            <Input
                                id="fullName"
                                value={profile.full_name}
                                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                className="bg-background/50 border-input text-foreground"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-foreground">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={profile.email}
                                disabled
                                className="bg-muted border-input text-muted-foreground"
                            />
                        </div>
                    </div>

                    <Separator className="bg-border" />

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <Button
                            variant="outline"
                            onClick={handleSignOut}
                            className="border-input text-foreground hover:bg-muted"
                        >
                            Sign Out
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
                </TabsContent>

                <TabsContent value="notifications" className="mt-2 space-y-6 text-base">
            {/* Notifications Section */}
            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Bell className="h-5 w-5 text-primary" />
                        Notifications
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Email notification preferences. Changes save automatically.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-foreground text-sm font-medium">Seller submissions</p>
                                <p className="text-sm text-muted-foreground">Get notified when a seller completes a form</p>
                            </div>
                            <Switch
                                checked={notifications.seller_submissions}
                                onCheckedChange={(checked) => handleNotificationToggle('seller_submissions', checked)}
                            />
                        </div>
                        <Separator className="bg-border" />
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-foreground text-sm font-medium">Attach PDF to submission emails</p>
                                <p className="text-sm text-muted-foreground">Automatically include the current utility sheet PDF. Later dashboard edits update the live sheet and future downloads, but already-sent attachments stay unchanged.</p>
                            </div>
                            <Switch
                                checked={notifications.seller_submission_pdf_attachment}
                                onCheckedChange={(checked) => handleNotificationToggle('seller_submission_pdf_attachment', checked)}
                            />
                        </div>
                        <Separator className="bg-border" />
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-foreground text-sm font-medium">Contact resolution alerts</p>
                                <p className="text-sm text-muted-foreground">Get notified about unresolved provider contacts</p>
                            </div>
                            <Switch
                                checked={notifications.contact_resolution}
                                onCheckedChange={(checked) => handleNotificationToggle('contact_resolution', checked)}
                            />
                        </div>
                        {/* Weekly summary disabled - requires Vercel cron upgrade
                        <Separator className="bg-border" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-foreground">Weekly summary</p>
                                <p className="text-sm text-muted-foreground">Receive a weekly activity report</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notifications.weekly_summary}
                                onChange={(e) => setNotifications({ ...notifications, weekly_summary: e.target.checked })}
                                className="h-5 w-5 rounded bg-background border-input text-emerald-500 focus:ring-emerald-500 focus:ring-offset-background"
                            />
                        </div>
                        */}
                    </div>
                </CardContent>
            </Card>
                </TabsContent>

                <TabsContent value="link" className="mt-2 space-y-6 text-base">
            {/* Reusable Link Section */}
            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <LinkIcon className="h-5 w-5 text-primary" />
                        Reusable Seller Link
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Share one fixed link; sellers enter the property address at the start.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {intakeLink?.url ? (
                        <div className="space-y-2">
                            <Label className="text-foreground">Your link</Label>
                            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                <Input
                                    value={intakeLink.url}
                                    readOnly
                                    className="bg-muted border-input text-muted-foreground"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-input text-foreground hover:bg-muted"
                                    onClick={handleCopyIntakeLink}
                                >
                                    Copy
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                    )}

                    <Separator className="bg-border" />

                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <Label htmlFor="intakeSlug" className="text-foreground">Branded link</Label>
                            {!intakeCanCustomize && (
                                <Badge variant="outline">Pro / Teams</Badge>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                            <div className="flex-1 space-y-1">
                                <Input
                                    id="intakeSlug"
                                    value={intakeSlugDraft}
                                    onChange={(e) => setIntakeSlugDraft(e.target.value)}
                                    placeholder="your-name"
                                    className="bg-background/50 border-input text-foreground"
                                    disabled={!intakeCanCustomize || intakeSaving}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Lowercase letters, numbers, and dashes only.
                                </p>
                            </div>
                            <Button
                                type="button"
                                onClick={handleSaveIntakeSlug}
                                disabled={!intakeCanCustomize || intakeSaving || intakeSlugDraft.trim().length < 3}
                            >
                                {intakeSaving ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="mr-2 h-4 w-4" />
                                )}
                                Save
                            </Button>
                        </div>
                    </div>

                    <Separator className="bg-border" />

                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <Label htmlFor="defaultPacketMode" className="text-foreground">Reusable link default mode</Label>
                            {!intakeCanCustomize && <Badge variant="outline">Pro / Teams</Badge>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                                <p className="text-sm font-semibold text-foreground">Simple Utility Sheet</p>
                                <p className="text-xs text-muted-foreground">Fast utility list only, ideal for straightforward handoffs.</p>
                                <p className="text-xs text-muted-foreground">
                                    Example: Electric, gas, water, and internet provider contacts.
                                </p>
                            </div>
                            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                                <p className="text-sm font-semibold text-foreground">Advanced Utility Packet</p>
                                <p className="text-xs text-muted-foreground">Adds modular seller transition details beyond utility providers.</p>
                                <p className="text-xs text-muted-foreground">
                                    Example: Mailbox access, lawn care contacts, and smart home notes.
                                </p>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                                <div className="flex-1">
                                    <select
                                        id="defaultPacketMode"
                                        value={intakeDefaultPacketMode}
                                        onChange={(e) => setIntakeDefaultPacketMode(e.target.value as PacketMode)}
                                        className="h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm text-foreground"
                                        disabled={!intakeCanCustomize || intakeSaving}
                                    >
                                        <option value="simple">Simple Utility Sheet</option>
                                        <option value="advanced">Advanced Utility Packet</option>
                                    </select>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Controls which mode sellers get when they start from your reusable link.
                            </p>
                            {!intakeCanCustomize && (
                                <p className="text-xs text-amber-500">
                                    Advanced mode defaults are read-only on Free. Upgrade to Pro or Teams to edit.
                                </p>
                            )}
                        </div>
                    </div>

                    {intakeDefaultPacketMode === 'advanced' && (
                        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <Label className="text-foreground">Advanced Modules</Label>
                                <span className="text-xs text-muted-foreground">{intakeAdvancedModules.length} enabled</span>
                            </div>
                            <AdvancedModuleConfigurator
                                enabledModules={intakeAdvancedModules}
                                exclusions={intakeAdvancedModuleExclusions}
                                onToggleModule={toggleIntakeAdvancedModule}
                                onToggleField={toggleIntakeAdvancedModuleField}
                                disabled={!intakeCanCustomize || intakeSaving}
                            />
                            {intakeAdvancedModules.length === 0 && (
                                <p className="text-xs text-amber-500">Enable at least one module for Advanced Utility Packet mode.</p>
                            )}
                            {intakeHasAdvancedModuleWithNoFields && intakeAdvancedModules.length > 0 && (
                                <p className="text-xs text-amber-500">Each enabled module must include at least one question.</p>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                        <div className="flex-1 space-y-1">
                            <p className="text-xs text-muted-foreground">
                                Save both default mode and module settings together.
                            </p>
                        </div>
                        <Button
                            type="button"
                            onClick={handleSaveDefaultPacketMode}
                            disabled={
                                intakeSaving ||
                                !intakeCanCustomize ||
                                intakeModeSettingsUnchanged ||
                                (intakeDefaultPacketMode === 'advanced' && (
                                    intakeAdvancedModules.length === 0 || intakeHasAdvancedModuleWithNoFields
                                ))
                            }
                        >
                            {intakeSaving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="mr-2 h-4 w-4" />
                            )}
                            Save Mode Settings
                        </Button>
                    </div>

                    <Separator className="bg-border" />

                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-foreground text-sm font-medium">Collect electric meter number</p>
                            <p className="text-sm text-muted-foreground">Show an optional meter number field for electric utility entries. Saves automatically.</p>
                        </div>
                        <Switch
                            checked={notifications.collect_electric_meter_number}
                            onCheckedChange={(checked) => handleNotificationToggle('collect_electric_meter_number', checked)}
                        />
                    </div>
                </CardContent>
            </Card>
                </TabsContent>

                <TabsContent value="referrals" className="mt-2 space-y-6 text-base">
                    <ReferralCreditCard userId={stackUser?.id} />
                </TabsContent>

                <TabsContent value="billing" className="mt-2 space-y-6 text-base">
            {/* Subscription Section */}
            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-primary" />
                        Subscription
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Manage your plan and billing
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                        <div>
                            <p className="text-foreground font-medium">
                                {orgIsTeam ? 'Teams Plan' : usage.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {orgIsTeam
                                    ? `Unlimited requests • ${orgSeatUsage.used}/${activeOrganization?.seat_quantity || '?'} seats used`
                                    : usage.plan === 'pro'
                                        ? 'Unlimited requests'
                                        : `${usage.limit} requests per month`}
                            </p>
                        </div>
                        {orgIsTeam ? (
                            orgIsAdmin ? (
                                <Button
                                    variant="outline"
                                    className="border-input text-foreground hover:bg-muted"
                                    onClick={handleTeamPortal}
                                    disabled={teamBillingLoading}
                                >
                                    {teamBillingLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                    )}
                                    Manage Teams Billing
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    className="border-input text-muted-foreground"
                                    disabled
                                >
                                    Managed by Admin
                                </Button>
                            )
                        ) : usage.plan === 'pro' ? (
                            <Button
                                variant="outline"
                                className="border-input text-foreground hover:bg-muted"
                                onClick={async () => {
                                    setBillingLoading(true);
                                    try {
                                        const response = await fetch('/api/billing/portal', { method: 'POST' });
                                        const data = await response.json();
                                        if (data.url) {
                                            window.location.href = data.url;
                                        } else {
                                            toast.error('Failed to open billing portal');
                                        }
                                    } catch {
                                        toast.error('Failed to open billing portal');
                                    } finally {
                                        setBillingLoading(false);
                                    }
                                }}
                                disabled={billingLoading}
                            >
                                {billingLoading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                )}
                                Manage Subscription
                            </Button>
                        ) : (
                            <Button
                                className="font-semibold px-6"
                                onClick={async () => {
                                    setBillingLoading(true);
                                    try {
                                        const response = await fetch('/api/billing/checkout', { method: 'POST' });
                                        const data = await response.json();
                                        if (data.url) {
                                            window.location.href = data.url;
                                        } else {
                                            toast.error(data.error || 'Failed to start checkout');
                                        }
                                    } catch {
                                        toast.error('Failed to start checkout');
                                    } finally {
                                        setBillingLoading(false);
                                    }
                                }}
                                disabled={billingLoading}
                            >
                                {billingLoading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Sparkles className="mr-2 h-4 w-4" />
                                )}
                                Upgrade to Pro, $9/mo
                            </Button>
                        )}
                    </div>

                    {/* Usage Progress - only show for free plan */}
                    {!orgIsTeam && usage.plan === 'free' && (
                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm text-muted-foreground">Monthly Usage</p>
                                <p className="text-sm font-medium text-foreground">{usage.used} of {usage.limit} requests</p>
                            </div>
                            <div className="w-full h-3 bg-background rounded-full overflow-hidden border border-border shadow-inner">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)] ${usage.used >= usage.limit
                                        ? 'bg-red-500'
                                        : usage.used >= usage.limit * 0.8
                                            ? 'bg-amber-500'
                                            : 'bg-emerald-500'
                                        }`}
                                    style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
                                />
                            </div>
                            {usage.used >= usage.limit && (
                                <p className="text-sm text-red-400 mt-2">
                                    You&apos;ve reached your monthly limit. Upgrade to continue creating requests.
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Team Section */}
            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Teams
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Invite teammates, manage seats, and learn how Teams billing works
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!activeOrganization ? (
                        <p className="text-sm text-muted-foreground">No active organization found.</p>
                    ) : (
                        <>
                            <div className="flex items-start justify-between gap-4 p-4 bg-muted/50 rounded-lg border border-border">
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-foreground font-medium">{activeOrganization.name}</p>
                                        {orgIsAdmin ? (
                                            <Badge variant="secondary">Admin</Badge>
                                        ) : (
                                            <Badge variant="outline">Member</Badge>
                                        )}
                                        {orgIsTeam ? (
                                            <Badge>Teams</Badge>
                                        ) : (
                                            <Badge variant="outline">Single-seat</Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {orgIsTeam
                                            ? `Seats: ${orgSeatUsage.used}/${activeOrganization?.seat_quantity || '?'} used (${orgSeatUsage.pendingInvites} pending invite${orgSeatUsage.pendingInvites === 1 ? '' : 's'})`
                                            : 'Upgrade to Teams to invite additional members.'}
                                    </p>
                                </div>
                                {orgIsAdmin && orgIsTeam && (
                                    <Button
                                        variant="outline"
                                        className="border-input text-foreground hover:bg-muted"
                                        onClick={handleTeamPortal}
                                        disabled={teamBillingLoading}
                                    >
                                        {teamBillingLoading ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                        )}
                                        Manage Seats
                                    </Button>
                                )}
                            </div>

                            {!orgIsTeam && (
                                <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-medium text-foreground">Teams (multi-seat)</p>
                                                <Badge variant="secondary">{usdNoCents.format(TEAM_PRICE_PER_SEAT_USD)}/seat/mo</Badge>
                                                <Badge variant="outline">{TEAM_MIN_SEATS} seat minimum</Badge>
                                                {!orgIsAdmin && <Badge variant="outline">Admin only</Badge>}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Best for 3+ users who want one shared organization, centralized billing, and teammate access to submitted-sheet editing. (Pro is single-seat.)
                                            </p>
                                        </div>
                                    </div>

                                    <Accordion className="border-border bg-background/20">
                                        <AccordionItem value="included">
                                            <AccordionTrigger>What&apos;s included in Teams?</AccordionTrigger>
                                            <AccordionContent>
                                                <ul className="space-y-1.5">
                                                    <li className="flex items-start gap-2">
                                                        <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                                                        Everything in Pro, including submitted-sheet editing
                                                    </li>
                                                    <li className="flex items-start gap-2">
                                                        <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                                                        Shared organization workspace with admin + member roles
                                                    </li>
                                                    <li className="flex items-start gap-2">
                                                        <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                                                        Centralized billing + seat management (1 seat = 1 active user; pending invites count toward the limit)
                                                    </li>
                                                </ul>
                                            </AccordionContent>
                                        </AccordionItem>
                                        <AccordionItem value="billing">
                                            <AccordionTrigger>How does Teams billing work?</AccordionTrigger>
                                            <AccordionContent>
                                                <p>
                                                    Teams is billed monthly per seat. Your estimated total is{' '}
                                                    <span className="font-medium text-foreground">{usdNoCents.format(teamsMonthlyTotal)}/mo</span>{' '}
                                                    for <span className="font-medium text-foreground">{teamSeatCount}</span> seat{teamSeatCount === 1 ? '' : 's'}.
                                                </p>
                                            </AccordionContent>
                                        </AccordionItem>
                                        <AccordionItem value="change-seats">
                                            <AccordionTrigger>Can I change seats later?</AccordionTrigger>
                                            <AccordionContent>
                                                <p>Yes. Admins can manage seats any time from the Teams billing portal.</p>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>

                                    {orgIsAdmin ? (
                                        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                                            <div className="flex-1 space-y-2">
                                                <Label htmlFor="teamSeats" className="text-foreground">Seats (users)</Label>
                                                <Input
                                                    id="teamSeats"
                                                    type="number"
                                                    min={TEAM_MIN_SEATS}
                                                    step={1}
                                                    value={teamSeatCount}
                                                    onChange={(e) => {
                                                        const parsed = Number.parseInt(e.target.value, 10);
                                                        setTeamSeats(Number.isFinite(parsed) ? Math.max(TEAM_MIN_SEATS, parsed) : TEAM_MIN_SEATS);
                                                    }}
                                                    className="bg-background/50 border-input text-foreground"
                                                    disabled={teamBillingLoading}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    {usdNoCents.format(TEAM_PRICE_PER_SEAT_USD)}/seat/mo • Estimated{' '}
                                                    <span className="text-foreground">{usdNoCents.format(teamsMonthlyTotal)}/mo</span>
                                                </p>
                                            </div>
                                            <Button
                                                onClick={handleTeamCheckout}
                                                disabled={teamBillingLoading}
                                            >
                                                {teamBillingLoading ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Sparkles className="mr-2 h-4 w-4" />
                                                )}
                                                Start Teams
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/20 p-3">
                                            <p className="text-xs text-muted-foreground">
                                                Only organization admins can start Teams. Ask an admin to upgrade and set seat quantity.
                                            </p>
                                            <Button variant="outline" className="border-input text-muted-foreground" disabled>
                                                Managed by Admin
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {orgIsTeam && (
                                <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-foreground">Invite members</p>
                                        {!orgIsAdmin && (
                                            <Badge variant="outline">Admin only</Badge>
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                                        <div className="flex-1 space-y-2">
                                            <Label htmlFor="inviteEmail" className="text-foreground">Email</Label>
                                            <Input
                                                id="inviteEmail"
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                placeholder="teammate@company.com"
                                                className="bg-background/50 border-input text-foreground"
                                                disabled={!orgIsAdmin || inviteLoading}
                                            />
                                        </div>
                                        <Button
                                            onClick={handleInvite}
                                            disabled={!orgIsAdmin || inviteLoading || !inviteEmail.trim()}
                                        >
                                            {inviteLoading ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <UserPlus className="mr-2 h-4 w-4" />
                                            )}
                                            Invite
                                        </Button>
                                    </div>
                                    {lastInviteUrl && (
                                        <div className="space-y-1.5">
                                            <Label htmlFor="inviteUrl" className="text-foreground text-xs">Invite link</Label>
                                            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                                <Input
                                                    id="inviteUrl"
                                                    value={lastInviteUrl}
                                                    readOnly
                                                    onFocus={(e) => e.currentTarget.select()}
                                                    className="bg-background/60 border-input text-foreground font-mono text-xs"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="border-input text-foreground hover:bg-muted shrink-0"
                                                    onClick={handleCopyInviteUrl}
                                                >
                                                    {inviteCopied ? (
                                                        <Check className="mr-2 h-4 w-4" />
                                                    ) : (
                                                        <Copy className="mr-2 h-4 w-4" />
                                                    )}
                                                    {inviteCopied ? 'Copied' : 'Copy'}
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Copy this link and send it to your teammate directly.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <Separator />

                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-foreground">Members</p>
                                {orgLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            </div>

                            {orgMembers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No members found.</p>
                            ) : (
                                <div className="rounded-md border border-border overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Member</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Role</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {orgMembers.map((member) => (
                                                <TableRow key={member.account_id}>
                                                    <TableCell className="font-medium">
                                                        {member.full_name || member.email}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {member.email}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={member.member_role === 'admin' ? 'secondary' : 'outline'}>
                                                            {member.member_role === 'admin' ? (
                                                                <>
                                                                    <Shield className="mr-1 h-3 w-3" />
                                                                    Admin
                                                                </>
                                                            ) : (
                                                                'Member'
                                                            )}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {orgIsAdmin && member.account_id !== accountId ? (
                                                            <div className="flex justify-end gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    aria-label={member.member_role === 'admin' ? 'Change to member' : 'Make admin'}
                                                                    onClick={() => requestToggleMemberRole(member)}
                                                                >
                                                                    <Shield className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                                    aria-label="Remove member"
                                                                    onClick={() => requestRemoveMember(member)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
                </TabsContent>
            </Tabs>

            {/* Confirmation dialog for destructive team actions */}
            <Dialog
                open={confirmDialog !== null}
                onOpenChange={(open) => {
                    if (!open && !confirmLoading) {
                        setConfirmDialog(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{confirmDialog?.title}</DialogTitle>
                        <DialogDescription>{confirmDialog?.description}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose render={<Button variant="outline" disabled={confirmLoading} />}>
                            Cancel
                        </DialogClose>
                        <Button
                            variant={confirmDialog?.destructive ? 'destructive' : 'default'}
                            onClick={handleConfirmDialog}
                            disabled={confirmLoading}
                        >
                            {confirmLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {confirmDialog?.confirmLabel}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
