import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/seo/site';

// lastModified is the date the page's visible content last changed. Search
// engines only trust lastmod when it is accurate, so bump a date when you
// change that page's copy or layout, not on every deploy.
const marketingRoutes: { path: string; lastModified: string }[] = [
  { path: '/', lastModified: '2026-10-20' },
  { path: '/features', lastModified: '2026-10-20' },
  { path: '/how-it-works', lastModified: '2026-10-20' },
  { path: '/pricing', lastModified: '2026-10-20' },
  { path: '/faq', lastModified: '2026-10-20' },
  { path: '/utility-sheet-for-transaction-coordinators', lastModified: '2026-10-20' },
  { path: '/utility-sheet-for-real-estate-agents', lastModified: '2026-10-20' },
  { path: '/seller-utility-information-form', lastModified: '2026-10-20' },
  { path: '/real-estate-closing-utility-checklist', lastModified: '2026-10-20' },
  { path: '/tc-utility-handoff-kit', lastModified: '2026-10-20' },
  { path: '/utility-sheet-template', lastModified: '2026-10-20' },
  { path: '/from-a-closing', lastModified: '2026-10-20' },
  { path: '/demo', lastModified: '2026-10-20' },
  { path: '/about', lastModified: '2026-10-20' },
  { path: '/privacy', lastModified: '2026-10-06' },
  { path: '/terms', lastModified: '2026-10-06' },
  { path: '/cookie-policy', lastModified: '2026-10-06' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return marketingRoutes.map(({ path, lastModified }) => ({
    url: absoluteUrl(path),
    lastModified,
  }));
}
