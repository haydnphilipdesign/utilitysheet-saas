import type { Metadata } from 'next';
import './features.css';

import { FeaturesShowcase } from '@/components/marketing/features-showcase';
import { MarketingHelpStrip } from '@/components/marketing/marketing-subpage';
import { MarketingCtaBand } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
  title: 'Features: Seller Links, Utility Sheets & PDFs',
  description:
    'Reusable seller links, a phone-friendly utility form, provider suggestions, and a clean web sheet and PDF. Add branding, editing, and teams as you grow.',
  path: '/features',
  keywords: [
    'utility sheet features',
    'seller utility information software',
    'real estate utility form software',
  ],
});

export default function FeaturesPage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Features', path: '/features' },
          ]),
        ]}
      />

      <FeaturesShowcase />
      <MarketingHelpStrip links={['how-it-works', 'demo', 'faq']} />

      <MarketingCtaBand
        title="See it on your next file."
        description="Start free with three submitted sheets a month, or try the seller experience first. No credit card required."
      />
    </div>
  );
}
