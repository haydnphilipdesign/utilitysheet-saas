import type { ReactNode } from 'react';

import { StackAuthProvider } from '@/components/providers/stack-auth-provider';
import { noIndexMetadata } from '@/lib/seo/site';

export const metadata = {
    ...noIndexMetadata,
    title: 'Account closed | UtilitySheet',
};

export default function AccountClosedLayout({ children }: { children: ReactNode }) {
    return <StackAuthProvider>{children}</StackAuthProvider>;
}
