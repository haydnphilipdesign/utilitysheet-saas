'use client';

import { useUser } from '@stackframe/stack';
import { SettingsView } from '@/components/settings/settings-view';

export default function SettingsPage() {
    return <SettingsView user={useUser()} />;
}
