import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// The page is a client component, so its title lives here. noindex comes
// from app/auth/layout.tsx.
export const metadata: Metadata = {
  title: 'Create your account',
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
