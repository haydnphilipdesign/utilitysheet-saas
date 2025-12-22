'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@stackframe/stack';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Settings, User, Bell, CreditCard, Loader2, Save, Sparkles, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
    const stackUser = useUser();
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


    // Update profile when Stack user loads, but prefer fetching from DB
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch('/api/account');
                if (response.ok) {
                    const data = await response.json();
                    if (data.account) {
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
                                {usage.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {usage.plan === 'pro' ? 'Unlimited requests' : `${usage.limit} requests per month`}
                            </p>
                        </div>
                        {usage.plan === 'pro' ? (
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
                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20 font-bold h-11 px-8 border-none transition-all hover:scale-105 active:scale-95"
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
                    {usage.plan === 'free' && (
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
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg"
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
