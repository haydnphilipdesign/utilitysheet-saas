'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@stackframe/stack';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Link as LinkIcon, User, Bell, Check, CreditCard, ExternalLink, Loader2, Save, Shield, Sparkles, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
    const stackUser = useUser();
    const [accountId, setAccountId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState({
        full_name: '',
        email: '',
    });
    const [notifications, setNotifications] = useState({
        seller_submissions: true,
        seller_submission_pdf_attachment: true,
        collect_electric_meter_number: false,
        contact_resolution: true,
        weekly_summary: false,
    });
    const [usage, setUsage] = useState({
        used: 0,
        limit: 3,
        plan: 'free'
    });
    const [billingLoading, setBillingLoading] = useState(false);
    const [activeOrganization, setActiveOrganization] = useState<any>(null);
    const [orgMembers, setOrgMembers] = useState<any[]>([]);
    const [orgSeatUsage, setOrgSeatUsage] = useState<{ used: number; pendingInvites: number }>({ used: 0, pendingInvites: 0 });
    const [orgLoading, setOrgLoading] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
    const [teamSeats, setTeamSeats] = useState(3);
    const [teamBillingLoading, setTeamBillingLoading] = useState(false);

    const [intakeLink, setIntakeLink] = useState<{ slug: string; url: string; is_active: boolean } | null>(null);
    const [intakeCanCustomize, setIntakeCanCustomize] = useState(false);
    const [intakeSlugDraft, setIntakeSlugDraft] = useState('');
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
                    setIntakeLink(data.intakeLink);
                    setIntakeSlugDraft(data.intakeLink.slug || '');
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

    const refreshOrganization = async () => {
        if (!activeOrganization?.id) return;
        setOrgLoading(true);
        try {
            const response = await fetch('/api/organization/members');
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to load organization');
            }

            if (data.organization) {
                setActiveOrganization((prev: any) => ({ ...prev, ...data.organization, role: data.role || prev?.role }));
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
            toast.success('Intake link updated');
        } catch (error: unknown) {
            console.error(error);
            const message = error instanceof Error ? error.message : 'Failed to update link';
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
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || 'Failed to invite member');
        } finally {
            setInviteLoading(false);
        }
    };

    const handleRemoveMember = async (accountId: string) => {
        if (!confirm('Remove this member from your organization?')) return;

        try {
            const response = await fetch(`/api/organization/members/${accountId}`, { method: 'DELETE' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to remove member');
            }
            toast.success('Member removed');
            await refreshOrganization();
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || 'Failed to remove member');
        }
    };

    const handleToggleMemberRole = async (accountId: string, currentRole: 'admin' | 'member') => {
        const nextRole = currentRole === 'admin' ? 'member' : 'admin';
        if (!confirm(`Change role to ${nextRole}?`)) return;

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
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || 'Failed to update role');
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-10">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">Settings</h1>
                <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
            </div>

            {/* Profile Section */}
            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <User className="h-5 w-5 text-emerald-400" />
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
                </CardContent>
            </Card>

            {/* Notifications Section */}
            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Bell className="h-5 w-5 text-emerald-400" />
                        Notifications
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Email notification preferences
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
                                onCheckedChange={(checked) => setNotifications({ ...notifications, seller_submissions: checked })}
                            />
                        </div>
                        <Separator className="bg-border" />
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-foreground text-sm font-medium">Attach PDF to submission emails</p>
                                <p className="text-sm text-muted-foreground">Automatically include a branded utility sheet PDF attachment</p>
                            </div>
                            <Switch
                                checked={notifications.seller_submission_pdf_attachment}
                                onCheckedChange={(checked) => setNotifications({ ...notifications, seller_submission_pdf_attachment: checked })}
                            />
                        </div>
                        <Separator className="bg-border" />
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-foreground text-sm font-medium">Collect electric meter number</p>
                                <p className="text-sm text-muted-foreground">Show an optional meter number field for electric utility entries</p>
                            </div>
                            <Switch
                                checked={notifications.collect_electric_meter_number}
                                onCheckedChange={(checked) => setNotifications({ ...notifications, collect_electric_meter_number: checked })}
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
                                onCheckedChange={(checked) => setNotifications({ ...notifications, contact_resolution: checked })}
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

            {/* Reusable Link Section */}
            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <LinkIcon className="h-5 w-5 text-emerald-400" />
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
                            <Label htmlFor="intakeSlug" className="text-foreground">Custom URL slug</Label>
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
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
                </CardContent>
            </Card>

            {/* Subscription Section */}
            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-emerald-400" />
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
                                    } catch (error) {
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
                                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white shadow-lg shadow-slate-500/20 font-bold h-11 px-8 border-none transition-all hover:scale-105 active:scale-95"
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
                                    } catch (error) {
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
                                    <Sparkles className="mr-2 h-4 w-4 fill-white animate-pulse" />
                                )}
                                Upgrade to Pro
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
                                    You've reached your monthly limit. Upgrade to continue creating requests.
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
                        <Users className="h-5 w-5 text-emerald-400" />
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
                                                Best for 3+ users who want one shared organization and centralized billing. (Pro is single-seat.)
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-foreground">What you get</p>
                                            <ul className="space-y-1.5 text-xs text-muted-foreground">
                                                <li className="flex items-start gap-2">
                                                    <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                                                    Everything in Pro (unlimited requests + branding)
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                                                    Shared organization workspace
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                                                    Invite members with admin + member roles
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                                                    Centralized billing + seat management
                                                </li>
                                            </ul>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-foreground">How seats work</p>
                                            <ul className="space-y-1.5 text-xs text-muted-foreground">
                                                <li className="flex items-start gap-2">
                                                    <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                                                    1 seat = 1 active user in the organization
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                                                    Pending invites count toward your seat limit
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                                                    Start with at least {TEAM_MIN_SEATS} seats and adjust later
                                                </li>
                                            </ul>
                                        </div>
                                    </div>

                                    <Accordion className="border-border bg-background/20">
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
                                                className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white"
                                                onClick={handleTeamCheckout}
                                                disabled={teamBillingLoading}
                                            >
                                                {teamBillingLoading ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Sparkles className="mr-2 h-4 w-4 fill-white animate-pulse" />
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
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
                                        <div className="text-xs text-muted-foreground break-all">
                                            Invite link: {lastInviteUrl}
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
                                                                    onClick={() => handleToggleMemberRole(member.account_id, member.member_role)}
                                                                >
                                                                    <Shield className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                                    onClick={() => handleRemoveMember(member.account_id)}
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

            {/* Account Actions Section */}
            <Card className="border-border bg-card/50">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <User className="h-5 w-5 text-emerald-400" />
                        Account Actions
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Manage your session
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="destructive"
                        onClick={handleSignOut}
                        className="w-full sm:w-auto"
                    >
                        Sign Out
                    </Button>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end sticky bottom-4">
                <Button
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white shadow-lg"
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
        </div>
    );
}
