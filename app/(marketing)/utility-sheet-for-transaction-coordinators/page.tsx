import type { Metadata } from 'next';
import Link from 'next/link';

import { ForTcsSection } from '@/components/landing/ForTcsSection';
import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingSection } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema, softwareApplicationSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
  title: 'Utility Collection for Transaction Coordinators',
  description:
    'UtilitySheet helps transaction coordinators send one reusable seller link, reduce utility follow-up, and deliver buyer-ready utility sheet PDFs for every file.',
  path: '/utility-sheet-for-transaction-coordinators',
  keywords: [
    'utility sheet for transaction coordinators',
    'transaction coordinator utility form',
    'seller utility info for tc',
  ],
});

export default function UtilitySheetForTransactionCoordinatorsPage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Utility Sheet for Transaction Coordinators', path: '/utility-sheet-for-transaction-coordinators' },
          ]),
          softwareApplicationSchema({
            path: '/utility-sheet-for-transaction-coordinators',
            description:
              'Seller utility handoff software for transaction coordinators who want a repeatable utility collection workflow.',
          }),
        ]}
      />

      <MarketingPageHero
        eyebrow="For Transaction Coordinators"
        title="Utility collection for transaction coordinators"
        description="One seller link. Cleaner submissions. Buyer-ready utility sheets. UtilitySheet gives TCs a repeatable workflow for the utility handoff that usually turns into follow-up texts, blank forms, and last-minute cleanup."
      >
        <MarketingBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'For Transaction Coordinators', href: '/utility-sheet-for-transaction-coordinators' },
          ]}
        />
      </MarketingPageHero>

      <MarketingSection
        title="Why TCs adopt UtilitySheet"
        description="The job is not just collecting utility names. It is keeping the file moving while still delivering a professional buyer handoff."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Fewer seller chase-downs',
              copy: 'Instead of multiple follow-up emails or texts, you send one guided link and let the seller complete the form in a cleaner flow. Nearly 86% of started UtilitySheets are completed.',
            },
            {
              title: 'One workflow on every file',
              copy: 'Add the reusable seller link to your listing email, text template, checklist, or signature once. From there, utility collection stops feeling improvised.',
            },
            {
              title: 'Better buyer handoff quality',
              copy: 'The finished utility sheet looks polished enough to share with buyers, agents, and support teams, and Pro/Teams can clean up submitted details before it goes out.',
            },
          ].map((item) => (
            <article key={item.title} className="rounded-3xl border border-border bg-card/30 p-6">
              <h3 className="text-2xl font-semibold text-foreground">{item.title}</h3>
              <p className="mt-3 leading-7 text-muted-foreground">{item.copy}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <ForTcsSection />

      <MarketingSection title="Related pages" description="These pages are useful if you are comparing plans or sharing UtilitySheet with an agent or team lead.">
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/pricing" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            View pricing
          </Link>
          <Link href="/how-it-works" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            See the workflow
          </Link>
          <Link href="/utility-sheet-for-real-estate-agents" className="rounded-full border border-border px-4 py-2 hover:bg-muted">
            For real estate agents
          </Link>
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="Make utility collection one less thing to babysit"
        description="Start free and test UtilitySheet on a real file. If it belongs in your monthly TC workflow, Pro adds branded output, post-submission editing, and use on every transaction."
      />
    </div>
  );
}
