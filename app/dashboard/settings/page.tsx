'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@stackframe/stack';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Settings, User, Bell, CreditCard, Loader2, Save } from 'lucide-react';
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
                <h1 className="text-3xl font-bold text-white">Settings</h1>
                <p className="text-zinc-400 mt-1">Manage your account and preferences</p>
            </div>

            {/* Profile Section */}
            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <User className="h-5 w-5 text-emerald-400" />
                        Profile
                    </CardTitle>
                    <CardDescription className="text-zinc-400">
                        Your personal information
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName" className="text-zinc-300">Full Name</Label>
                            <Input
                                id="fullName"
                                value={profile.full_name}
                                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                className="bg-zinc-800/50 border-zinc-700 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-zinc-300">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={profile.email}
                                disabled
                                className="bg-zinc-800/50 border-zinc-700 text-zinc-400"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Notifications Section */}
            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Bell className="h-5 w-5 text-emerald-400" />
                        Notifications
                    </CardTitle>
                    <CardDescription className="text-zinc-400">
                        Email notification preferences
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white">Seller submissions</p>
                                <p className="text-sm text-zinc-400">Get notified when a seller completes a form</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notifications.seller_submissions}
                                onChange={(e) => setNotifications({ ...notifications, seller_submissions: e.target.checked })}
                                className="h-5 w-5 rounded bg-zinc-800 border-zinc-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900"
                            />
                        </div>
                        <Separator className="bg-zinc-800" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white">Contact resolution alerts</p>
                                <p className="text-sm text-zinc-400">Get notified about unresolved provider contacts</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notifications.contact_resolution}
                                onChange={(e) => setNotifications({ ...notifications, contact_resolution: e.target.checked })}
                                className="h-5 w-5 rounded bg-zinc-800 border-zinc-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900"
                            />
                        </div>
                        <Separator className="bg-zinc-800" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white">Weekly summary</p>
                                <p className="text-sm text-zinc-400">Receive a weekly activity report</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notifications.weekly_summary}
                                onChange={(e) => setNotifications({ ...notifications, weekly_summary: e.target.checked })}
                                className="h-5 w-5 rounded bg-zinc-800 border-zinc-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Subscription Section */}
            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-emerald-400" />
                        Subscription
                    </CardTitle>
                    <CardDescription className="text-zinc-400">
                        Manage your plan and billing
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        <div>
                            <p className="text-white font-medium capitalize">{usage.plan === 'free' ? 'Free Plan' : usage.plan}</p>
                            <p className="text-sm text-zinc-400">{usage.limit} requests per month</p>
                        </div>
                        <Button className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white">
                            Upgrade
                        </Button>
                    </div>

                    {/* Usage Progress */}
                    <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-zinc-300">Monthly Usage</p>
                            <p className="text-sm font-medium text-white">{usage.used} of {usage.limit} requests</p>
                        </div>
                        <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${usage.used >= usage.limit
                                        ? 'bg-red-500'
                                        : usage.used >= usage.limit * 0.8
                                            ? 'bg-yellow-500'
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
                </CardContent>
            </Card>

            {/* Account Actions Section */}
            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <User className="h-5 w-5 text-emerald-400" />
                        Account Actions
                    </CardTitle>
                    <CardDescription className="text-zinc-400">
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
