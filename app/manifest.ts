import type { MetadataRoute } from 'next';

import { siteConfig } from '@/lib/seo/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f6f4',
    theme_color: '#475569',
    icons: [
      {
        src: '/logo-sm.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
