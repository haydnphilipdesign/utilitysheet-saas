import type { Metadata } from 'next';
import './features.css';

import { FeaturesShowcase } from '@/components/marketing/features-showcase';
import { MarketingHelpStrip } from '@/components/marketing/marketing-subpage';
import { MarketingCtaBand } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema, softwareApplicationSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
  title: 'UtilitySheet Features for Seller Utility Handoffs',
  description:
    'Explore UtilitySheet features for reusable seller links, saved seller forms, guided utility and HOA intake, ready-to-review utility sheet PDFs, submitted-sheet editing, and branded handoffs.',
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
          softwareApplicationSchema({
            path: '/features',
            description:
              'UtilitySheet features for transaction coordinators and real estate agents who need a better seller utility information workflow.',
          }),
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
