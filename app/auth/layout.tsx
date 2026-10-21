import type { ReactNode } from 'react';

import { StackAuthProvider } from '@/components/providers/stack-auth-provider';
import { noIndexMetadata } from '@/lib/seo/site';

export const metadata = noIndexMetadata;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <StackAuthProvider>{children}</StackAuthProvider>;
}
