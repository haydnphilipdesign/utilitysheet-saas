'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@stackframe/stack';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings, User, Bell, CreditCard, Loader2, Save, Sparkles, ExternalLink, Users, UserPlus, Trash2, Shield } from 'lucide-react';
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

    const handleTeamCheckout = async () => {
        setTeamBillingLoading(true);
        try {
            const response = await fetch('/api/organization/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seats: teamSeats }),
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
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-foreground">Seller submissions</p>
                                <p className="text-sm text-muted-foreground">Get notified when a seller completes a form</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notifications.seller_submissions}
                                onChange={(e) => setNotifications({ ...notifications, seller_submissions: e.target.checked })}
                                className="h-5 w-5 rounded bg-background border-input text-emerald-500 focus:ring-emerald-500 focus:ring-offset-background"
                            />
                        </div>
                        <Separator className="bg-border" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-foreground">Contact resolution alerts</p>
                                <p className="text-sm text-muted-foreground">Get notified about unresolved provider contacts</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notifications.contact_resolution}
                                onChange={(e) => setNotifications({ ...notifications, contact_resolution: e.target.checked })}
                                className="h-5 w-5 rounded bg-background border-input text-emerald-500 focus:ring-emerald-500 focus:ring-offset-background"
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
                        Team
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Invite teammates and manage seats for your organization
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

                            {orgIsAdmin && !orgIsTeam && (
                                <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Upgrade to Teams</p>
                                            <p className="text-xs text-muted-foreground">Minimum 3 seats. Billing is per seat.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                                        <div className="flex-1 space-y-2">
                                            <Label htmlFor="teamSeats" className="text-foreground">Seats</Label>
                                            <Input
                                                id="teamSeats"
                                                type="number"
                                                min={3}
                                                value={teamSeats}
                                                onChange={(e) => setTeamSeats(Number(e.target.value) || 3)}
                                                className="bg-background/50 border-input text-foreground"
                                            />
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
