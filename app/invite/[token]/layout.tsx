import type { ReactNode } from 'react';

import { noIndexMetadata } from '@/lib/seo/site';

export const metadata = noIndexMetadata;

export default function InviteLayout({ children }: { children: ReactNode }) {
  return children;
}
