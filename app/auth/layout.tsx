import type { ReactNode } from 'react';

import { noIndexMetadata } from '@/lib/seo/site';

export const metadata = noIndexMetadata;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
