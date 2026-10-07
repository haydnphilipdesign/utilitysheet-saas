'use client';

import { SettingsView } from '@/components/settings/settings-view';

const fixtureUser = {
    id: 'fixture-user',
    displayName: 'Jordan Rivera',
    primaryEmail: 'jordan@example.com',
    signOut: () => undefined,
};

export function SettingsFixture() {
    return <SettingsView user={fixtureUser} />;
}
