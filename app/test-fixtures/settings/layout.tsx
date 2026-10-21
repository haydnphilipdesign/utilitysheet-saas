import type { ReactNode } from 'react';

import { StackAuthProvider } from '@/components/providers/stack-auth-provider';

// SettingsView's account sections read the user from Stack Auth's provider,
// which only signed-in areas of the app load (see app/layout.tsx).
export default function SettingsFixtureLayout({ children }: { children: ReactNode }) {
  return <StackAuthProvider>{children}</StackAuthProvider>;
}
