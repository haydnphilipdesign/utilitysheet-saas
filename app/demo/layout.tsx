import type { Metadata } from 'next';
import '@/app/(marketing)/marketing.css';
import './demo.css';
import { createPageMetadata } from '@/lib/seo/site';

export const metadata: Metadata = createPageMetadata({
    title: 'Interactive Demo',
    description:
        'Try the UtilitySheet seller experience with a guided utility information form, address-based provider suggestions, and no-login demo flow.',
    path: '/demo',
    keywords: [
        'utility sheet demo',
        'seller utility form demo',
        'real estate utility software demo',
    ],
});

// The address step (page.tsx) renders the marketing header and footer. The
// seller wizard that follows is a full-screen flow with its own header and
// theme, exactly as sellers see it.
export default function DemoLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
