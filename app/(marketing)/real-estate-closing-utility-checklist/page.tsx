import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingSection } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema, softwareApplicationSchema } from '@/lib/seo/schema';

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
          softwareApplicationSchema({
            path: '/real-estate-closing-utility-checklist',
            description:
              'UtilitySheet supports a cleaner real estate closing utility checklist by helping teams collect, organize, and share seller utility information.',
          }),
        ]}
      />

      <MarketingPageHero
        eyebrow="Checklist"
        title="A real estate closing utility checklist that actually helps your team finish the handoff"
        description="Closing utility prep sounds simple until someone has to chase the seller, confirm providers, clean up the information, and hand it off to buyers. This checklist shows the core steps, and UtilitySheet helps your team run them in a more repeatable way."
      >
        <MarketingBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Real Estate Closing Utility Checklist', href: '/real-estate-closing-utility-checklist' },
          ]}
        />
      </MarketingPageHero>

      <MarketingSection
        title="The checklist"
        description="You can use these steps inside your own transaction process whether you work solo or as part of a team."
      >
        <ol className="grid gap-4">
          {checklist.map((item, index) => (
            <li key={item} className="rounded-3xl border border-border bg-card/30 p-6">
              <div className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-600/10 text-sm font-semibold text-slate-700">
                  {index + 1}
                </span>
                <p className="leading-7 text-muted-foreground">{item}</p>
              </div>
            </li>
          ))}
        </ol>
      </MarketingSection>

      <MarketingSection
        title="How UtilitySheet supports this checklist"
        description="The checklist becomes easier to execute when the collection step is standardized."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {[
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
              copy: 'The end result is not just a completed form. It is a utility sheet your team can actually share, and Pro/Teams can revise after submission when the handoff needs cleanup.',
            },
          ].map((item) => (
            <article key={item.title} className="rounded-3xl border border-border bg-card/20 p-6">
              <h3 className="text-2xl font-semibold text-foreground">{item.title}</h3>
              <p className="mt-3 leading-7 text-muted-foreground">{item.copy}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection title="Related pages" description="These pages dig deeper into the people and workflows behind the checklist.">
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/seller-utility-information-form" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            Seller utility information form
          </Link>
          <Link href="/utility-sheet-for-transaction-coordinators" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            For transaction coordinators
          </Link>
          <Link href="/how-it-works" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            How it works
          </Link>
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="Turn your closing utility checklist into a repeatable workflow"
        description="UtilitySheet helps real estate teams run the collection step with less friction and a much cleaner final handoff."
      />
    </div>
  );
}
