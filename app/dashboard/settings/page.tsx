'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@stackframe/stack';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Settings, User, Bell, CreditCard, Loader2, Save } from 'lucide-react';

export default function SettingsPage() {
    const stackUser = useUser();
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState({
        full_name: '',
        email: '',
    });

    // Update profile when Stack user loads
    useEffect(() => {
        if (stackUser) {
            setProfile({
                full_name: stackUser.displayName || '',
                email: stackUser.primaryEmail || '',
            });
        }
    }, [stackUser]);

    const handleSave = async () => {
        setLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setLoading(false);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
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
                            <input type="checkbox" defaultChecked className="h-5 w-5 rounded" />
                        </div>
                        <Separator className="bg-zinc-800" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white">Contact resolution alerts</p>
                                <p className="text-sm text-zinc-400">Get notified about unresolved provider contacts</p>
                            </div>
                            <input type="checkbox" defaultChecked className="h-5 w-5 rounded" />
                        </div>
                        <Separator className="bg-zinc-800" />
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white">Weekly summary</p>
                                <p className="text-sm text-zinc-400">Receive a weekly activity report</p>
                            </div>
                            <input type="checkbox" className="h-5 w-5 rounded" />
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
                <CardContent>
                    <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        <div>
                            <p className="text-white font-medium">Free Plan</p>
                            <p className="text-sm text-zinc-400">Up to 10 requests per month</p>
                        </div>
                        <Button className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white">
                            Upgrade
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
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
