import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/seo/site';

const marketingRoutes = [
  '/',
  '/about',
  '/demo',
  '/features',
  '/how-it-works',
  '/pricing',
  '/faq',
  '/utility-sheet-for-transaction-coordinators',
  '/utility-sheet-for-real-estate-agents',
  '/seller-utility-information-form',
  '/real-estate-closing-utility-checklist',
  '/tc-utility-handoff-kit',
  '/from-a-closing',
  '/privacy',
  '/terms',
  '/cookie-policy',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return marketingRoutes.map((route) => ({
    url: absoluteUrl(route),
    lastModified,
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority:
      route === '/'
        ? 1
        : route === '/features' || route === '/pricing' || route === '/how-it-works'
          ? 0.9
          : route === '/faq' || route.startsWith('/utility-sheet-for-')
            ? 0.8
            : 0.6,
  }));
}
