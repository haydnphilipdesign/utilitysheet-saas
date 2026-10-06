'use client';

import { use } from 'react';
import { IntakeLinkScreen } from '@/components/intake/IntakeLinkScreen';

export default function IntakeLinkPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    return <IntakeLinkScreen apiPath={`/api/intake/${encodeURIComponent(slug)}`} />;
}
