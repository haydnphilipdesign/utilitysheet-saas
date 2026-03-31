import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingFaqList } from '@/components/marketing/faq-list';
import { MarketingBreadcrumbs, MarketingCtaBand, MarketingPageHero, MarketingSection } from '@/components/marketing/page-shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { faqItems } from '@/lib/marketing-content';
import { createPageMetadata } from '@/lib/seo/site';
import { breadcrumbSchema, faqPageSchema } from '@/lib/seo/schema';

export const metadata: Metadata = createPageMetadata({
  title: 'UtilitySheet FAQ for Seller Utility Forms and PDFs',
  description:
    'Read common questions about UtilitySheet, including seller utility forms, utility sheet PDFs, submitted-sheet editing, plan limits, provider suggestions, and advanced packet mode.',
  path: '/faq',
  keywords: [
    'utility sheet faq',
    'seller utility form faq',
    'real estate utility software questions',
  ],
});

export default function FaqPage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'FAQ', path: '/faq' },
          ]),
          faqPageSchema(faqItems),
        ]}
      />

      <MarketingPageHero
        eyebrow="FAQ"
        title="Answers about seller utility forms, utility sheets, and closing workflows"
        description="These are the questions transaction coordinators, agents, and support teams tend to ask before they adopt UtilitySheet as part of their real estate process."
      >
        <MarketingBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'FAQ', href: '/faq' },
          ]}
        />
      </MarketingPageHero>

      <MarketingSection title="Frequently asked questions">
        <MarketingFaqList />
      </MarketingSection>

      <MarketingSection title="Not sure where to go next?" description="These pages answer the most common follow-up questions.">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              href: '/features',
              title: 'Features',
              copy: 'See what the product does in more detail.',
            },
            {
              href: '/pricing',
              title: 'Pricing',
              copy: 'Compare Starter, Pro, and Teams.',
            },
            {
              href: '/how-it-works',
              title: 'How It Works',
              copy: 'Walk through the utility handoff workflow step by step.',
            },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-3xl border border-border bg-card/20 p-6 hover:bg-card/40">
              <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-muted-foreground">{item.copy}</p>
            </Link>
          ))}
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="Ready to answer these questions with a live demo?"
        description="Start free or run the interactive demo and see how UtilitySheet fits your workflow."
      />
    </div>
  );
}
