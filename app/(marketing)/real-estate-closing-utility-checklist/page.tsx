import type { Metadata } from 'next';

import { MarketingHeroArt } from '@/components/marketing/hero-art';
import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingPointsSection, MarketingRelatedLinks } from '@/components/marketing/page-shell';
import { MockFormSettings, MockSheet } from '@/components/marketing/product-mockups';
import { JsonLd } from '@/components/seo/JsonLd';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
  title: 'Real Estate Closing Utility Checklist',
  description:
    'Use this real estate closing utility checklist to make sure seller utility information is collected, organized, and ready to share before closing.',
  path: '/real-estate-closing-utility-checklist',
  keywords: [
    'real estate closing utility checklist',
    'utility transfer checklist for closing',
    'closing prep utility checklist',
  ],
});

export default function RealEstateClosingUtilityChecklistPage() {
  const checklist = [
    'Confirm the property address and unit details before collecting provider information.',
    'Ask the seller to verify electric, gas, water, sewer, trash, internet, and any other relevant providers.',
    'Ask whether the home is part of an HOA or condo association, and note the association name, management contact, and dues if it is.',
    'Collect any move-related access details, service vendors, or mailbox information your team needs for handoff.',
    'Review the information for vague or incomplete answers before sharing it forward, and clean up formatting or contact details as needed.',
    'Generate a utility sheet or packet that buyers and support staff can actually read.',
    'Store or share the finished handoff with the file so nobody has to ask for the same details twice.',
  ];

  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Real Estate Closing Utility Checklist', path: '/real-estate-closing-utility-checklist' },
          ]),
        ]}
      />

      <MarketingPageHero
        showActions
        art={<MarketingHeroArt primary={<MockFormSettings />} secondary={<MockSheet />} />}
        eyebrow="Checklist"
        title="Your closing utility checklist, sorted."
        description="Closing utility prep sounds simple until someone has to chase the seller, confirm providers, clean up the information, and hand it off to buyers. This checklist shows the core steps, and UtilitySheet helps your team run them in a more repeatable way."
      >
        <MarketingBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Real Estate Closing Utility Checklist', href: '/real-estate-closing-utility-checklist' },
          ]}
        />
      </MarketingPageHero>

      <MarketingPointsSection
        ordered
        title="The checklist"
        description="You can use these steps inside your own transaction process whether you work solo or as part of a team."
        points={checklist.map((copy) => ({ copy }))}
      />

      <MarketingPointsSection
        title="How UtilitySheet supports this checklist"
        description="The checklist becomes easier to execute when the collection step is standardized."
        points={[
          {
            title: 'One reusable request link',
            copy: 'Instead of rebuilding a utility collection email every time, you send the same guided link.',
          },
          {
            title: 'Cleaner data from sellers',
            copy: 'Provider suggestions and structured prompts reduce the vague answers that slow closings down.',
          },
          {
            title: 'Finished output at the end',
            copy: 'The end result is not just a completed form. It is a utility sheet your team can actually share, and on Pro and Teams you can revise it after the seller submits.',
          },
        ]}
      />

      <MarketingRelatedLinks
        title="Related pages"
        description="These pages dig deeper into the people and workflows behind the checklist."
        links={[
          { href: '/seller-utility-information-form', label: 'Seller utility information form' },
          { href: '/utility-sheet-for-transaction-coordinators', label: 'For transaction coordinators' },
          { href: '/how-it-works', label: 'How it works' },
        ]}
      />

      <MarketingCtaBand
        title="Turn your closing utility checklist into a repeatable workflow"
        description="UtilitySheet helps real estate teams run the collection step with less friction and a much cleaner final handoff."
      />
    </div>
  );
}
