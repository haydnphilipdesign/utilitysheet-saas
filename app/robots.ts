import type { MetadataRoute } from 'next';

import { crawlBlockedPrefixes } from '@/lib/seo/private-routes';
import { absoluteUrl } from '@/lib/seo/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [...crawlBlockedPrefixes],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
