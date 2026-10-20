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
  title: "FAQ: Seller Utility Forms, Sheets & PDFs",
  description:
    "Answers on seller utility forms, provider suggestions, HOA questions, PDF delivery, editing submitted sheets, and the free plan limit.",
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
        title="Answers about seller forms, sheets, and plans."
        description="From your first seller link to the finished PDF. Find the details on forms, plans, and everything in between."
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
