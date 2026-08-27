'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@stackframe/stack';
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
import { PageHeader } from '@/components/ui/page-header';
import { ReferralCreditCard } from '@/components/referrals/referral-credit-card';
import { AccountSecuritySettings } from '@/components/settings/account-security';
import { Link as LinkIcon, User, Bell, Check, Copy, CreditCard, ExternalLink, Loader2, RefreshCw, Save, Shield, Sparkles, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
    ADVANCED_MODULE_DEFAULTS,
    ADVANCED_MODULE_KEYS,
    getAdvancedModuleIncludedFieldCount,
    normalizeAdvancedModuleExclusions,
    normalizeAdvancedModules,
} from '@/lib/packet/modules';
import { UTILITY_CATEGORIES, UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import type { AdvancedModuleExclusions, AdvancedModuleKey, PacketMode, UtilityCategory } from '@/types';
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
    notification_settings?: Record<string, unknown> | null;
};

type OrganizationMemberRow = {
    account_id: string;
    email: string;
    full_name: string | null;
    member_role: 'admin' | 'member';
};

type PendingOrganizationInvite = {
    id: string;
    email: string;
    role: 'admin' | 'member';
    expires_at: string;
    created_at?: string;
};

type BrandProfileSummary = {
    id: string;
    name: string;
    isDefault: boolean;
};

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

function normalizeSettingsUtilityCategories(value: unknown): UtilityCategory[] {
    if (!Array.isArray(value)) return [...UTILITY_CATEGORY_KEYS];
    const selected = new Set(value.filter((candidate): candidate is string => typeof candidate === 'string'));
    const normalized = UTILITY_CATEGORY_KEYS.filter((category) => selected.has(category));
    return normalized.length > 0 ? normalized : [...UTILITY_CATEGORY_KEYS];
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
    const [workspaceName, setWorkspaceName] = useState('');
    const [workspaceSaving, setWorkspaceSaving] = useState(false);
    const [notifyAdminsOnSubmission, setNotifyAdminsOnSubmission] = useState(false);
    const [workspaceNotificationsSaving, setWorkspaceNotificationsSaving] = useState(false);
    const [pendingInvites, setPendingInvites] = useState<PendingOrganizationInvite[]>([]);
    const [pendingInviteAction, setPendingInviteAction] = useState<string | null>(null);
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
        defaultBrandProfileId?: string | null;
        defaultUtilityCategories?: UtilityCategory[];
        defaultPacketMode?: PacketMode;
        advancedModules?: AdvancedModuleKey[];
        advancedModuleExclusions?: AdvancedModuleExclusions;
    } | null>(null);
    const [intakeCanCustomize, setIntakeCanCustomize] = useState(false);
    const [intakeBrandProfiles, setIntakeBrandProfiles] = useState<BrandProfileSummary[]>([]);
    const [intakeSlugDraft, setIntakeSlugDraft] = useState('');
    const [intakeDefaultBrandProfileId, setIntakeDefaultBrandProfileId] = useState('');
    const [intakeUtilityCategories, setIntakeUtilityCategories] = useState<UtilityCategory[]>([...UTILITY_CATEGORY_KEYS]);
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
                        setWorkspaceName(data.activeOrganization?.name || '');
                        setNotifyAdminsOnSubmission(
                            data.activeOrganization?.notification_settings?.notify_admins_on_submission === true
                        );
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
                    setIntakeDefaultBrandProfileId(data.intakeLink.defaultBrandProfileId || '');
                    setIntakeUtilityCategories(normalizeSettingsUtilityCategories(data.intakeLink.defaultUtilityCategories));
                    setIntakeDefaultPacketMode(data.intakeLink.defaultPacketMode || 'simple');
                    setIntakeAdvancedModules(nextModules);
                    setIntakeAdvancedModuleExclusions(
                        normalizeAdvancedModuleExclusions(
                            data.intakeLink.advancedModuleExclusions || {},
                            nextModules
                        )
                    );
                }
                setIntakeBrandProfiles(Array.isArray(data.brandProfiles) ? data.brandProfiles : []);
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
    const intakeFormDefaultsUnchanged = useMemo(() => {
        if (!intakeLink) return true;
        const savedCategories = normalizeSettingsUtilityCategories(intakeLink.defaultUtilityCategories);
        return intakeDefaultBrandProfileId === (intakeLink.defaultBrandProfileId || '')
            && intakeUtilityCategories.join('|') === savedCategories.join('|');
    }, [intakeDefaultBrandProfileId, intakeLink, intakeUtilityCategories]);
    const intakeSettingsUnchanged = intakeFormDefaultsUnchanged && intakeModeSettingsUnchanged;
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
                setWorkspaceName(data.organization.name || '');
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

            if (data.role === 'admin') {
                const inviteResponse = await fetch('/api/organization/invites');
                const inviteData = await inviteResponse.json().catch(() => ({})) as {
                    invites?: PendingOrganizationInvite[];
                };
                setPendingInvites(inviteResponse.ok && Array.isArray(inviteData.invites) ? inviteData.invites : []);
            } else {
                setPendingInvites([]);
            }
        } catch (error) {
            console.error('Error fetching organization:', error);
        } finally {
            setOrgLoading(false);
        }
    };

    useEffect(() => {
        if (activeOrganization?.id) {
            setOrgMembers([]);
            setPendingInvites([]);
            refreshOrganization();
        } else {
            setOrgMembers([]);
            setOrgSeatUsage({ used: 0, pendingInvites: 0 });
            setPendingInvites([]);
            setWorkspaceName('');
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
            toast.success('Form URL copied');
        } catch {
            toast.error('Failed to copy form URL');
        }
    };

    const handlePreviewIntakeLink = () => {
        if (!intakeLink?.url) return;
        trackEvent('seller_form_preview_opened', {
            source: 'settings_reusable_link',
        });
        window.open(intakeLink.url, '_blank', 'noopener,noreferrer');
    };

    const updateIntakeLinkFromResponse = (nextIntakeLink: typeof intakeLink) => {
        if (!nextIntakeLink) return;
        const nextModules = Array.isArray(nextIntakeLink.advancedModules) && nextIntakeLink.advancedModules.length > 0
            ? normalizeAdvancedModules(nextIntakeLink.advancedModules)
            : [...ADVANCED_MODULE_DEFAULTS];
        setIntakeLink(nextIntakeLink);
        setIntakeSlugDraft(nextIntakeLink.slug || '');
        setIntakeDefaultBrandProfileId(nextIntakeLink.defaultBrandProfileId || '');
        setIntakeUtilityCategories(normalizeSettingsUtilityCategories(nextIntakeLink.defaultUtilityCategories));
        setIntakeDefaultPacketMode(nextIntakeLink.defaultPacketMode || 'simple');
        setIntakeAdvancedModules(nextModules);
        setIntakeAdvancedModuleExclusions(
            normalizeAdvancedModuleExclusions(nextIntakeLink.advancedModuleExclusions || {}, nextModules)
        );
    };

    const handleToggleIntakeActive = async (isActive: boolean) => {
        setIntakeSaving(true);
        try {
            const response = await fetch('/api/intake-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.message || data?.error || 'Failed to update seller form status');
            }
            updateIntakeLinkFromResponse(data.intakeLink || null);
            toast.success(isActive ? 'Seller form reactivated' : 'Seller form paused');
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Failed to update seller form status');
        } finally {
            setIntakeSaving(false);
        }
    };

    const toggleIntakeUtilityCategory = (category: UtilityCategory) => {
        setIntakeUtilityCategories((current) => (
            current.includes(category)
                ? current.filter((candidate) => candidate !== category)
                : UTILITY_CATEGORY_KEYS.filter((candidate) => candidate === category || current.includes(candidate))
        ));
    };

    const handleSaveSellerFormSettings = async () => {
        if (intakeUtilityCategories.length === 0) {
            toast.error('Select at least one utility category.');
            return;
        }
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
                    defaultBrandProfileId: intakeDefaultBrandProfileId || null,
                    defaultUtilityCategories: intakeUtilityCategories,
                    defaultPacketMode: intakeDefaultPacketMode,
                    advancedModules: intakeAdvancedModules,
                    advancedModuleExclusions: normalizedExclusions,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.message || data?.error || 'Failed to update seller form settings');
            }
            updateIntakeLinkFromResponse(data.intakeLink || null);
            toast.success('Seller form settings saved');
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Failed to update seller form settings');
        } finally {
            setIntakeSaving(false);
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
                throw new Error(data?.message || data?.error || 'Failed to update form URL');
            }
            if (data.intakeLink) {
                updateIntakeLinkFromResponse(data.intakeLink);
            }
            toast.success('Custom form URL updated');
        } catch (error: unknown) {
            console.error(error);
            const message = error instanceof Error ? error.message : 'Failed to update form URL';
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

    const handleResetSellerFormSettings = () => {
        if (!intakeLink) return;
        const nextModules = intakeLink.advancedModules && intakeLink.advancedModules.length > 0
            ? normalizeAdvancedModules(intakeLink.advancedModules)
            : [...ADVANCED_MODULE_DEFAULTS];
        setIntakeDefaultBrandProfileId(intakeLink.defaultBrandProfileId || '');
        setIntakeUtilityCategories(normalizeSettingsUtilityCategories(intakeLink.defaultUtilityCategories));
        setIntakeDefaultPacketMode(intakeLink.defaultPacketMode || 'simple');
        setIntakeAdvancedModules(nextModules);
        setIntakeAdvancedModuleExclusions(
            normalizeAdvancedModuleExclusions(intakeLink.advancedModuleExclusions || {}, nextModules)
        );
    };

    const handleSaveWorkspaceName = async () => {
        const name = workspaceName.trim();
        if (name.length < 2 || name.length > 100) {
            toast.error('Workspace name must be between 2 and 100 characters');
            return;
        }

        setWorkspaceSaving(true);
        try {
            const response = await fetch('/api/organization', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to update workspace name');
            }

            if (data.organization) {
                setActiveOrganization((current) => current ? { ...current, ...data.organization } : data.organization);
                setWorkspaceName(data.organization.name || name);
            }
            toast.success('Workspace name updated');
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Failed to update workspace name');
        } finally {
            setWorkspaceSaving(false);
        }
    };

    const handleToggleAdminNotifications = async (checked: boolean) => {
        const previous = notifyAdminsOnSubmission;
        // Optimistic update; revert on failure.
        setNotifyAdminsOnSubmission(checked);
        setWorkspaceNotificationsSaving(true);
        try {
            const response = await fetch('/api/organization/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notify_admins_on_submission: checked }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to update team notifications');
            }

            const nextValue = data?.notification_settings?.notify_admins_on_submission === true;
            setNotifyAdminsOnSubmission(nextValue);
            setActiveOrganization((current) =>
                current
                    ? { ...current, notification_settings: data?.notification_settings ?? current.notification_settings }
                    : current
            );
            toast.success('Team notification settings updated');
        } catch (error: unknown) {
            setNotifyAdminsOnSubmission(previous);
            toast.error(error instanceof Error ? error.message : 'Failed to update team notifications');
        } finally {
            setWorkspaceNotificationsSaving(false);
        }
    };

    const handleResendInvite = async (invite: PendingOrganizationInvite) => {
        setPendingInviteAction(`resend:${invite.id}`);
        try {
            const response = await fetch(`/api/organization/invites/${invite.id}`, { method: 'PATCH' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to resend invitation');
            }

            if (data.inviteUrl) {
                setLastInviteUrl(data.inviteUrl);
            }
            toast.success(data.emailSent ? 'Invitation resent' : 'Invitation refreshed; copy the new link to send it manually');
            await refreshOrganization();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Failed to resend invitation');
        } finally {
            setPendingInviteAction(null);
        }
    };

    const performCancelInvite = async (invite: PendingOrganizationInvite) => {
        setPendingInviteAction(`cancel:${invite.id}`);
        try {
            const response = await fetch(`/api/organization/invites/${invite.id}`, { method: 'DELETE' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to cancel invitation');
            }

            toast.success('Invitation cancelled');
            await refreshOrganization();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Failed to cancel invitation');
        } finally {
            setPendingInviteAction(null);
        }
    };

    const requestCancelInvite = (invite: PendingOrganizationInvite) => {
        setConfirmDialog({
            title: 'Cancel invitation',
            description: `Cancel the pending invitation for ${invite.email}? The reserved Team seat will become available immediately.`,
            confirmLabel: 'Cancel invitation',
            destructive: true,
            onConfirm: () => performCancelInvite(invite),
        });
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
            <PageHeader title="Settings" description="Manage your account, seller form, workspace, notifications, and billing" />

            <Tabs value={activeTab} onValueChange={handleTabChange}>
                <div className="overflow-x-auto overflow-y-hidden">
                    <TabsList className="w-max">
                        <TabsTrigger value="account">Account</TabsTrigger>
                        <TabsTrigger value="link">Seller Form</TabsTrigger>
                        <TabsTrigger value="notifications">Notifications</TabsTrigger>
                        <TabsTrigger value="workspace">Workspace &amp; Team</TabsTrigger>
                        <TabsTrigger value="billing">Billing</TabsTrigger>
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
                                autoComplete="name"
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
                                    Saving…
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
            <AccountSecuritySettings />
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
                                <p id="notif-seller-submissions-label" className="text-foreground text-sm font-medium">Seller submissions</p>
                                <p id="notif-seller-submissions-desc" className="text-sm text-muted-foreground">Get notified when a seller completes a form</p>
                            </div>
                            <Switch
                                aria-labelledby="notif-seller-submissions-label"
                                aria-describedby="notif-seller-submissions-desc"
                                checked={notifications.seller_submissions}
                                onCheckedChange={(checked) => handleNotificationToggle('seller_submissions', checked)}
                            />
                        </div>
                        {/* PDF attachment is nested under and dependent on submission emails:
                            no submission email is sent when Seller submissions is off, so no PDF can be attached. */}
                        <div className="ml-4 border-l border-border pl-4">
                            <div className={`flex items-center justify-between gap-4 ${notifications.seller_submissions ? '' : 'opacity-50'}`}>
                                <div>
                                    <p id="notif-pdf-attachment-label" className="text-foreground text-sm font-medium">Attach PDF to submission emails</p>
                                    <p id="notif-pdf-attachment-desc" className="text-sm text-muted-foreground">
                                        {notifications.seller_submissions
                                            ? 'Automatically include the current utility sheet PDF. Later dashboard edits update the live sheet and future downloads, but already-sent attachments stay unchanged.'
                                            : 'Turn on Seller submissions to attach the utility sheet PDF to those emails.'}
                                    </p>
                                </div>
                                <Switch
                                    aria-labelledby="notif-pdf-attachment-label"
                                    aria-describedby="notif-pdf-attachment-desc"
                                    disabled={!notifications.seller_submissions}
                                    checked={notifications.seller_submissions && notifications.seller_submission_pdf_attachment}
                                    onCheckedChange={(checked) => handleNotificationToggle('seller_submission_pdf_attachment', checked)}
                                />
                            </div>
                        </div>
                        <Separator className="bg-border" />
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p id="notif-contact-resolution-label" className="text-foreground text-sm font-medium">Contact resolution alerts</p>
                                <p id="notif-contact-resolution-desc" className="text-sm text-muted-foreground">Get notified about unresolved provider contacts</p>
                            </div>
                            <Switch
                                aria-labelledby="notif-contact-resolution-label"
                                aria-describedby="notif-contact-resolution-desc"
                                checked={notifications.contact_resolution}
                                onCheckedChange={(checked) => handleNotificationToggle('contact_resolution', checked)}
                            />
                        </div>
                        {/* Weekly summary is intentionally not exposed. The cron route, query, and email
                            exist, but /api/cron/weekly-summary is not registered in vercel.json (only the
                            activation crons are), so no scheduling infrastructure runs it. Do not surface
                            this preference until a dependable weekly schedule is wired. */}
                    </div>
                </CardContent>
            </Card>
                </TabsContent>

                <TabsContent value="link" className="mt-2 space-y-6 text-base">
                    <Card className="border-border bg-card/50">
                        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1.5">
                                <CardTitle className="flex items-center gap-2 text-foreground">
                                    <LinkIcon className="h-5 w-5 text-primary" />
                                    Seller Form
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    Control access, choose what sellers are asked, and set the completed packet style.
                                </CardDescription>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full border-input sm:w-auto"
                                onClick={handlePreviewIntakeLink}
                                disabled={!intakeLink?.url}
                            >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Preview form
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <section className="space-y-4" aria-labelledby="seller-form-access-heading">
                                <div className="space-y-1">
                                    <h3 id="seller-form-access-heading" className="text-base font-semibold text-foreground">
                                        Form access & sharing
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Manage who can start the reusable form and how you share it.
                                    </p>
                                </div>

                                <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-medium text-foreground">Accept new seller form starts</p>
                                                <Badge variant={intakeLink?.is_active === false ? 'outline' : 'default'}>
                                                    {intakeLink?.is_active === false ? 'Paused' : 'Active'}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Pause new starts without changing existing request links.
                                            </p>
                                        </div>
                                        <Switch
                                            aria-label="Accept new seller form starts"
                                            checked={intakeLink?.is_active !== false}
                                            onCheckedChange={handleToggleIntakeActive}
                                            disabled={!intakeLink || intakeSaving}
                                        />
                                    </div>

                                    {intakeLink?.is_active === false && (
                                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                                            This form is paused. Visitors cannot create new requests until you reactivate it.
                                        </div>
                                    )}

                                    {intakeLink?.url ? (
                                        <div className="space-y-2">
                                            <Label className="text-foreground">Seller form URL</Label>
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                <Input
                                                    value={intakeLink.url}
                                                    readOnly
                                                    className="bg-muted text-muted-foreground"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="border-input"
                                                    onClick={handleCopyIntakeLink}
                                                >
                                                    <Copy className="mr-2 h-4 w-4" />
                                                    Copy
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Loading…</p>
                                    )}

                                    <div className="space-y-2 border-t border-border pt-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <Label htmlFor="intakeSlug" className="text-foreground">Custom form URL</Label>
                                            {!intakeCanCustomize && <Badge variant="outline">Pro / Teams</Badge>}
                                        </div>
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                            <div className="flex-1 space-y-1">
                                                <Input
                                                    id="intakeSlug"
                                                    value={intakeSlugDraft}
                                                    onChange={(e) => setIntakeSlugDraft(e.target.value)}
                                                    placeholder="your-name"
                                                    className="bg-background/50"
                                                    disabled={!intakeCanCustomize || intakeSaving}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Lowercase letters, numbers, and dashes only. Saved separately from form defaults.
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                onClick={handleSaveIntakeSlug}
                                                disabled={!intakeCanCustomize || intakeSaving || intakeSlugDraft.trim().length < 3}
                                            >
                                                {intakeSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                Save URL
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <Separator className="bg-border" />

                            <section className="space-y-5" aria-labelledby="seller-questions-heading">
                                <div className="space-y-1">
                                    <h3 id="seller-questions-heading" className="text-base font-semibold text-foreground">
                                        What sellers are asked
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        These defaults are copied into new requests started from your reusable form.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-foreground">Form & packet type</p>
                                        {!intakeCanCustomize && <Badge variant="outline">Pro / Teams</Badge>}
                                    </div>
                                    <div
                                        role="radiogroup"
                                        aria-label="Form and packet type"
                                        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                                    >
                                        {([
                                            {
                                                value: 'simple' as const,
                                                title: 'Simple Utility Sheet',
                                                description: 'A focused form for utility providers and essential home basics.',
                                                example: 'Best for straightforward handoffs.',
                                            },
                                            {
                                                value: 'advanced' as const,
                                                title: 'Advanced Utility Packet',
                                                description: 'Adds selectable lawn, access, security, and home-service questions.',
                                                example: 'Best for a complete closing handoff.',
                                            },
                                        ]).map((option) => {
                                            const selected = intakeDefaultPacketMode === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={selected}
                                                    onClick={() => setIntakeDefaultPacketMode(option.value)}
                                                    disabled={!intakeCanCustomize || intakeSaving}
                                                    className={`relative rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-65 ${
                                                        selected
                                                            ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/20'
                                                            : 'border-border bg-muted/20 hover:border-input hover:bg-muted/35'
                                                    }`}
                                                >
                                                    <span className="flex items-start justify-between gap-3">
                                                        <span className="space-y-1.5">
                                                            <span className="block text-sm font-semibold text-foreground">{option.title}</span>
                                                            <span className="block text-sm leading-relaxed text-muted-foreground">{option.description}</span>
                                                            <span className="block text-xs font-medium text-muted-foreground">{option.example}</span>
                                                        </span>
                                                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                                            selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                                                        }`}>
                                                            {selected && <Check className="h-3.5 w-3.5" />}
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {!intakeCanCustomize && (
                                        <p className="text-sm text-amber-600 dark:text-amber-300">
                                            Advanced form defaults are read-only on Free. Upgrade to Pro or Teams to edit.
                                        </p>
                                    )}
                                </div>

                                <fieldset className="space-y-3">
                                    <legend className="text-sm font-medium text-foreground">Utility categories</legend>
                                    <p className="text-sm text-muted-foreground">Choose which utility sections sellers see.</p>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {UTILITY_CATEGORIES.map((category) => {
                                            const checked = intakeUtilityCategories.includes(category.key);
                                            return (
                                                <label
                                                    key={category.key}
                                                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm text-foreground transition-colors hover:bg-muted/40"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleIntakeUtilityCategory(category.key)}
                                                        disabled={intakeSaving}
                                                        className="h-4 w-4 rounded border-input accent-primary"
                                                    />
                                                    <span aria-hidden="true">{category.icon}</span>
                                                    <span>{category.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    {intakeUtilityCategories.length === 0 && (
                                        <p className="text-sm text-destructive">Select at least one utility category.</p>
                                    )}
                                </fieldset>

                                <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-foreground">Collect electric meter number</p>
                                        <p className="text-sm text-muted-foreground">
                                            Show an optional meter-number field when Electric is included. This preference saves automatically.
                                        </p>
                                    </div>
                                    <Switch
                                        aria-label="Collect electric meter number"
                                        checked={notifications.collect_electric_meter_number}
                                        onCheckedChange={(checked) => handleNotificationToggle('collect_electric_meter_number', checked)}
                                    />
                                </div>

                                {intakeDefaultPacketMode === 'advanced' && (
                                    <div className="space-y-3 rounded-xl border border-border bg-muted/15 p-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-semibold text-foreground">Advanced questions</p>
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    {intakeAdvancedModules.length} modules enabled
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Enable the sections you need, then open one to choose its individual questions.
                                            </p>
                                        </div>
                                        <AdvancedModuleConfigurator
                                            enabledModules={intakeAdvancedModules}
                                            exclusions={intakeAdvancedModuleExclusions}
                                            onToggleModule={toggleIntakeAdvancedModule}
                                            onToggleField={toggleIntakeAdvancedModuleField}
                                            disabled={!intakeCanCustomize || intakeSaving}
                                        />
                                        {intakeAdvancedModules.length === 0 && (
                                            <p className="text-sm text-amber-600 dark:text-amber-300">
                                                Enable at least one module for Advanced Utility Packet mode.
                                            </p>
                                        )}
                                        {intakeHasAdvancedModuleWithNoFields && intakeAdvancedModules.length > 0 && (
                                            <p className="text-sm text-amber-600 dark:text-amber-300">
                                                Each enabled module must include at least one question.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </section>

                            <Separator className="bg-border" />

                            <section className="space-y-4" aria-labelledby="completed-packet-heading">
                                <div className="space-y-1">
                                    <h3 id="completed-packet-heading" className="text-base font-semibold text-foreground">
                                        Completed packet
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Choose the Branding Profile applied to the finished web packet and PDF.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="defaultBrandProfile" className="text-foreground">Default Branding Profile</Label>
                                    <select
                                        id="defaultBrandProfile"
                                        value={intakeDefaultBrandProfileId}
                                        onChange={(event) => setIntakeDefaultBrandProfileId(event.target.value)}
                                        className="h-10 w-full rounded-md border border-input bg-background/50 px-3 text-sm text-foreground"
                                        disabled={intakeSaving}
                                    >
                                        <option value="">Use workspace default</option>
                                        {intakeBrandProfiles.map((profile) => (
                                            <option key={profile.id} value={profile.id}>
                                                {profile.name}{profile.isDefault ? ' (workspace default)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-sm text-muted-foreground">
                                        “Use workspace default” follows whichever Branding Profile is currently marked default.
                                    </p>
                                </div>
                            </section>

                            <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className={`flex h-7 w-7 items-center justify-center rounded-full ${
                                        intakeSettingsUnchanged
                                            ? 'bg-emerald-500/10 text-emerald-600'
                                            : 'bg-amber-500/10 text-amber-600'
                                    }`}>
                                        {intakeSettingsUnchanged ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                                    </span>
                                    <span>
                                        <span className="block font-medium text-foreground">
                                            {intakeSettingsUnchanged ? 'All defaults saved' : 'Unsaved changes'}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            Applies to new requests from your reusable form.
                                        </span>
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1 border-input sm:flex-none"
                                        onClick={handleResetSellerFormSettings}
                                        disabled={intakeSaving || intakeSettingsUnchanged}
                                    >
                                        Reset
                                    </Button>
                                    <Button
                                        type="button"
                                        className="flex-1 sm:flex-none"
                                        onClick={handleSaveSellerFormSettings}
                                        disabled={
                                            intakeSaving ||
                                            !intakeCanCustomize ||
                                            intakeSettingsUnchanged ||
                                            intakeUtilityCategories.length === 0 ||
                                            (intakeDefaultPacketMode === 'advanced' && (
                                                intakeAdvancedModules.length === 0 || intakeHasAdvancedModuleWithNoFields
                                            ))
                                        }
                                    >
                                        {intakeSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save seller form
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="workspace" className="mt-2 space-y-6 text-base">
                    <Card className="border-border bg-card/50">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                Workspace details
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Manage the shared workspace identity and understand who can administer it.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!activeOrganization ? (
                                <p className="text-sm text-muted-foreground">No active workspace found.</p>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-medium text-foreground">{activeOrganization.name}</p>
                                                <Badge variant={orgIsAdmin ? 'secondary' : 'outline'}>
                                                    {orgIsAdmin ? 'Admin' : 'Member'}
                                                </Badge>
                                                <Badge variant={orgIsTeam ? 'default' : 'outline'}>
                                                    {orgIsTeam ? 'Teams' : 'Single-seat'}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {orgIsTeam
                                                    ? `${orgSeatUsage.used + orgSeatUsage.pendingInvites}/${activeOrganization.seat_quantity ?? '—'} seats reserved: ${orgSeatUsage.used} active member${orgSeatUsage.used === 1 ? '' : 's'} and ${orgSeatUsage.pendingInvites} pending invitation${orgSeatUsage.pendingInvites === 1 ? '' : 's'}.`
                                                    : 'Upgrade this workspace to Teams from Billing before inviting additional members.'}
                                            </p>
                                            {orgIsTeam && (
                                                <p className="text-xs text-muted-foreground">
                                                    Active members and pending invitations each reserve one Team seat.
                                                </p>
                                            )}
                                        </div>
                                        <Button type="button" variant="outline" onClick={() => handleTabChange('billing')}>
                                            <CreditCard className="mr-2 h-4 w-4" />
                                            Open Billing
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="workspaceName" className="text-foreground">Workspace name</Label>
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                            <Input
                                                id="workspaceName"
                                                value={workspaceName}
                                                onChange={(event) => setWorkspaceName(event.target.value)}
                                                maxLength={100}
                                                disabled={!orgIsAdmin || workspaceSaving}
                                                className="bg-background/50 border-input text-foreground"
                                            />
                                            <Button
                                                type="button"
                                                onClick={handleSaveWorkspaceName}
                                                disabled={!orgIsAdmin || workspaceSaving || workspaceName.trim() === (activeOrganization.name || '')}
                                                className="shrink-0"
                                            >
                                                {workspaceSaving ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Save className="mr-2 h-4 w-4" />
                                                )}
                                                Save workspace name
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {orgIsAdmin
                                                ? 'Renaming also refreshes the workspace slug used internally; existing seller and packet links are unchanged.'
                                                : 'Only workspace administrators can rename the workspace.'}
                                        </p>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {activeOrganization && orgIsTeam && (
                        <Card className="border-border bg-card/50">
                            <CardHeader>
                                <CardTitle className="text-foreground flex items-center gap-2">
                                    <Bell className="h-5 w-5 text-primary" />
                                    Team notifications
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    Workspace-level routing for seller submissions. This is separate from each member&apos;s personal notification preferences.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className={`flex items-center justify-between gap-4 ${orgIsAdmin ? '' : 'opacity-70'}`}>
                                    <div>
                                        <p id="workspace-notify-admins-label" className="text-foreground text-sm font-medium">Notify workspace admins of all team submissions</p>
                                        <p id="workspace-notify-admins-desc" className="text-sm text-muted-foreground">
                                            {orgIsAdmin
                                                ? 'When on, every seller submission in this workspace also emails its current admins, in addition to the member who owns the request. Each admin still honors their personal Seller submissions preference.'
                                                : 'Only workspace administrators can change team notification routing.'}
                                        </p>
                                    </div>
                                    <Switch
                                        aria-labelledby="workspace-notify-admins-label"
                                        aria-describedby="workspace-notify-admins-desc"
                                        disabled={!orgIsAdmin || workspaceNotificationsSaving}
                                        checked={notifyAdminsOnSubmission}
                                        onCheckedChange={handleToggleAdminNotifications}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="border-border bg-card/50">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <UserPlus className="h-5 w-5 text-primary" />
                                Invitations
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Invite teammates and manage each active pending invitation.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!activeOrganization ? (
                                <p className="text-sm text-muted-foreground">No active workspace found.</p>
                            ) : !orgIsTeam ? (
                                <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-muted-foreground">
                                        Team invitations are available after an administrator starts a Teams subscription in Billing.
                                    </p>
                                    <Button type="button" variant="outline" onClick={() => handleTabChange('billing')}>
                                        View Teams billing
                                    </Button>
                                </div>
                            ) : !orgIsAdmin ? (
                                <div className="rounded-lg border border-border bg-muted/30 p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Workspace administrators manage invitations. Pending invitation details are visible only to administrators.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                            <div className="flex-1 space-y-2">
                                                <Label htmlFor="inviteEmail" className="text-foreground">Email</Label>
                                                <Input
                                                    id="inviteEmail"
                                                    type="email"
                                                    inputMode="email"
                                                    autoComplete="off"
                                                    spellCheck={false}
                                                    value={inviteEmail}
                                                    onChange={(event) => setInviteEmail(event.target.value)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter' && !inviteLoading && inviteEmail.trim()) {
                                                            event.preventDefault();
                                                            handleInvite();
                                                        }
                                                    }}
                                                    placeholder="teammate@company.com"
                                                    disabled={inviteLoading}
                                                    className="bg-background/50 border-input text-foreground"
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                onClick={handleInvite}
                                                disabled={inviteLoading || !inviteEmail.trim()}
                                            >
                                                {inviteLoading ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <UserPlus className="mr-2 h-4 w-4" />
                                                )}
                                                Invite
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Active members and pending invitations each reserve one Team seat. Cancelling a pending invitation releases its seat immediately.
                                        </p>
                                        {lastInviteUrl && (
                                            <div className="space-y-1.5">
                                                <Label htmlFor="inviteUrl" className="text-foreground text-xs">Latest invite link</Label>
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                    <Input
                                                        id="inviteUrl"
                                                        value={lastInviteUrl}
                                                        readOnly
                                                        onFocus={(event) => event.currentTarget.select()}
                                                        className="bg-background/60 border-input text-foreground font-mono text-xs"
                                                    />
                                                    <Button type="button" variant="outline" onClick={handleCopyInviteUrl} className="shrink-0">
                                                        {inviteCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                                                        {inviteCopied ? 'Copied' : 'Copy'}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-foreground">Pending invitations</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {pendingInvites.length} active invitation{pendingInvites.length === 1 ? '' : 's'} reserving a seat.
                                                </p>
                                            </div>
                                            {orgLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                        </div>

                                        {pendingInvites.length === 0 ? (
                                            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                                                No pending invitations.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {pendingInvites.map((invite) => {
                                                    const isResending = pendingInviteAction === `resend:${invite.id}`;
                                                    const isCancelling = pendingInviteAction === `cancel:${invite.id}`;
                                                    return (
                                                        <div key={invite.id} className="flex flex-col gap-3 rounded-lg border border-border bg-background/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                                                            <div className="min-w-0 space-y-1">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <p className="break-all text-sm font-medium text-foreground">{invite.email}</p>
                                                                    <Badge variant="outline">{invite.role === 'admin' ? 'Admin' : 'Member'}</Badge>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Expires {new Date(invite.expires_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2 sm:justify-end">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    aria-label={`Resend invitation to ${invite.email}`}
                                                                    onClick={() => handleResendInvite(invite)}
                                                                    disabled={pendingInviteAction !== null}
                                                                >
                                                                    {isResending ? (
                                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <RefreshCw className="mr-2 h-4 w-4" />
                                                                    )}
                                                                    Resend
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="text-destructive hover:text-destructive"
                                                                    aria-label={`Cancel invitation to ${invite.email}`}
                                                                    onClick={() => requestCancelInvite(invite)}
                                                                    disabled={pendingInviteAction !== null}
                                                                >
                                                                    {isCancelling ? (
                                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                    )}
                                                                    Cancel
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/50">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <Shield className="h-5 w-5 text-primary" />
                                Members and roles
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Preserve workspace access and administrator responsibilities.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {orgMembers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No members found.</p>
                            ) : (
                                <div className="overflow-x-auto rounded-md border border-border">
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
                                                    <TableCell className="font-medium">{member.full_name || member.email}</TableCell>
                                                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={member.member_role === 'admin' ? 'secondary' : 'outline'}>
                                                            {member.member_role === 'admin' ? (
                                                                <><Shield className="mr-1 h-3 w-3" />Admin</>
                                                            ) : 'Member'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {orgIsAdmin && member.account_id !== accountId ? (
                                                            <div className="flex justify-end gap-1">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    aria-label={member.member_role === 'admin' ? 'Change to member' : 'Make admin'}
                                                                    onClick={() => requestToggleMemberRole(member)}
                                                                >
                                                                    <Shield className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
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
                            <p className="text-xs text-muted-foreground">
                                Ownership transfer and leaving a workspace are not available because the current membership model does not yet support those actions safely.
                            </p>
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
                        Manage subscriptions, invoices, payment methods, and Team seat quantity through Stripe.
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
                                    ? `Unlimited requests • ${orgSeatUsage.used}/${activeOrganization?.seat_quantity ?? '—'} seats used`
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

                    {(orgIsTeam || usage.plan === 'pro') && (
                        <p className="text-xs text-muted-foreground">
                            The Stripe customer portal is the source of truth for invoices, payment methods, subscription changes, and Team seat quantity.
                        </p>
                    )}

                    {/* Usage Progress - only show for free plan */}
                    {!orgIsTeam && usage.plan === 'free' && (
                        <div className="p-4 bg-muted/50 rounded-lg border border-border">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm text-muted-foreground">Monthly Usage</p>
                                <p className="text-sm font-medium text-foreground">{usage.used} of {usage.limit} requests</p>
                            </div>
                            <div className="w-full h-3 bg-background rounded-full overflow-hidden border border-border shadow-inner">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${usage.used >= usage.limit
                                        ? 'bg-destructive'
                                        : usage.used >= usage.limit * 0.8
                                            ? 'bg-amber-500'
                                            : 'bg-emerald-500'
                                        }`}
                                    style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
                                />
                            </div>
                            {usage.used >= usage.limit && (
                                <p className="text-sm text-destructive mt-2">
                                    You&apos;ve reached your monthly limit. Upgrade to continue creating requests.
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {!orgIsTeam && activeOrganization && (
                <Card className="border-border bg-card/50">
                    <CardHeader>
                        <CardTitle className="text-foreground flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            Teams subscription
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                            {usage.plan === 'pro'
                                ? 'Convert your current Pro subscription into centralized, seat-based Teams billing without creating a second subscription.'
                                : 'Start centralized, seat-based billing for a shared workspace. Workspace members and invitations are managed separately in Workspace & Team.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-foreground">Teams (multi-seat)</p>
                                <Badge variant="secondary">{usdNoCents.format(TEAM_PRICE_PER_SEAT_USD)}/seat/mo</Badge>
                                <Badge variant="outline">{TEAM_MIN_SEATS} seat minimum</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Includes the Pro feature set, shared workspace access, admin/member roles, and Stripe-managed seat billing.
                            </p>
                        </div>

                        {orgIsAdmin ? (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor="teamSeats" className="text-foreground">Seats (users)</Label>
                                    <Input
                                        id="teamSeats"
                                        type="number"
                                        min={TEAM_MIN_SEATS}
                                        step={1}
                                        value={teamSeatCount}
                                        onChange={(event) => {
                                            const parsed = Number.parseInt(event.target.value, 10);
                                            setTeamSeats(Number.isFinite(parsed) ? Math.max(TEAM_MIN_SEATS, parsed) : TEAM_MIN_SEATS);
                                        }}
                                        disabled={teamBillingLoading}
                                        className="bg-background/50 border-input text-foreground"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Estimated {usdNoCents.format(teamsMonthlyTotal)}/mo. {usage.plan === 'pro'
                                            ? 'Stripe will apply the prorated upgrade difference to your next invoice.'
                                            : 'Pending invitations reserve seats after the subscription is active.'}
                                    </p>
                                </div>
                                <Button type="button" onClick={handleTeamCheckout} disabled={teamBillingLoading}>
                                    {teamBillingLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="mr-2 h-4 w-4" />
                                    )}
                                    {usage.plan === 'pro' ? 'Upgrade Pro to Teams' : 'Start Teams'}
                                </Button>
                            </div>
                        ) : (
                            <p className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                                Only a workspace administrator can start a Teams subscription and choose its seat quantity.
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

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
