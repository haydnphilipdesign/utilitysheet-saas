'use client';

import { use } from 'react';
import { IntakeLinkScreen } from '@/components/intake/IntakeLinkScreen';

// A form under a shared base link. Inherits noindex from app/i/[slug]/layout.tsx.
export default function NestedIntakeLinkPage({ params }: { params: Promise<{ slug: string; suffix: string }> }) {
    const { slug, suffix } = use(params);
    return (
        <IntakeLinkScreen
            apiPath={`/api/intake/${encodeURIComponent(slug)}/forms/${encodeURIComponent(suffix)}`}
        />
    );
}
