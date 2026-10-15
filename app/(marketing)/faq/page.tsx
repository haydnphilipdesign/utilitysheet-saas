import type { Metadata } from "next";

import { MarketingFaqList } from "@/components/marketing/faq-list";
import {
  MarketingHelpStrip,
  MarketingSubpageHero,
} from "@/components/marketing/marketing-subpage";
import { MarketingCtaBand } from "@/components/marketing/page-shell";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqItems } from "@/lib/marketing-content";
import { createPageMetadata } from "@/lib/seo/site";
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo/schema";

export const metadata: Metadata = createPageMetadata({
  title: "UtilitySheet FAQ for Seller Utility Forms and PDFs",
  description:
    "Read common questions about UtilitySheet, including seller utility forms, utility sheet PDFs, submitted-sheet editing, plan limits, provider suggestions, and Property Handoff Packet mode.",
  path: "/faq",
  keywords: [
    "utility sheet faq",
    "seller utility form faq",
    "real estate utility software questions",
  ],
});

export default function FaqPage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]),
          faqPageSchema(faqItems),
        ]}
      />

      <MarketingSubpageHero
        eyebrow="FAQ"
        title={
          <>
            Got questions?
            <br />
            We&apos;ve got answers.
          </>
        }
        description="From your first seller link to the finished PDF. Find the details on forms, plans, and everything in between."
        variant="faq"
      />

      <MarketingFaqList />
      <MarketingHelpStrip links={["how-it-works", "features", "pricing"]} />

      <MarketingCtaBand
        title="Still deciding? See it on a real file."
        description="Start free, or run the interactive demo first and see how UtilitySheet fits your workflow."
      />
    </div>
  );
}
