'use client';

import { useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { InlineStatus, LoadError, LoadingRows, SettingsSection } from './settings-ui';
import type { LoadState } from './types';

export function ProfileSection({ state, onRetry, name, savedName, email, onNameChange, onSaved, onSignOut }: {
    state: LoadState;
    onRetry: () => void;
    name: string;
    savedName: string;
    email: string;
    onNameChange: (name: string) => void;
    onSaved: (name: string) => void;
    onSignOut: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [justSaved, setJustSaved] = useState(false);
    const [error, setError] = useState('');
    const dirty = name.trim() !== savedName.trim();

    async function save() {
        setSaving(true);
        setError('');
        try {
            // Only the profile: notification preferences save on their own tab.
            const response = await fetch('/api/account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: name }),
            });
            if (!response.ok) throw new Error('save failed');
            onSaved(name.trim());
            setJustSaved(true);
        } catch {
            setError('We couldn’t save your name. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <SettingsSection icon={User} title="Profile" description="Your name and the email you sign in with.">
            {state === 'loading' ? (
                <LoadingRows label="Loading your profile…" />
            ) : state === 'error' ? (
                <LoadError message="We couldn’t load your profile. Nothing was changed." onRetry={onRetry} />
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">Full name</Label>
                            <Input
                                id="fullName"
                                autoComplete="name"
                                maxLength={120}
                                value={name}
                                onChange={(event) => {
                                    setJustSaved(false);
                                    setError('');
                                    onNameChange(event.target.value);
                                }}
                            />
                            <p className="text-xs text-muted-foreground">
                                Shown to your workspace and used in emails we send you.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={email} disabled aria-describedby="emailHelp" />
                            <p id="emailHelp" className="text-xs text-muted-foreground">
                                This is the email you sign in with. To change it, add the new
                                address under Sign-in &amp; security below.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1 basis-48">
                            {error ? (
                                <InlineStatus tone="error">{error}</InlineStatus>
                            ) : saving ? (
                                <InlineStatus tone="saving">Saving…</InlineStatus>
                            ) : dirty ? (
                                <InlineStatus>Unsaved changes</InlineStatus>
                            ) : justSaved ? (
                                <InlineStatus tone="saved">Profile saved</InlineStatus>
                            ) : (
                                <InlineStatus>All changes saved</InlineStatus>
                            )}
                        </div>
                        <Button onClick={save} disabled={saving || !dirty}>
                            {saving ? 'Saving…' : 'Save profile'}
                        </Button>
                    </div>
                </>
            )}

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Sign out</p>
                    <p className="text-sm text-muted-foreground">Signs you out of UtilitySheet on this device only.</p>
                </div>
                <Button variant="outline" className="shrink-0" onClick={onSignOut}>
                    <LogOut />
                    Sign out
                </Button>
            </div>
        </SettingsSection>
    );
}
