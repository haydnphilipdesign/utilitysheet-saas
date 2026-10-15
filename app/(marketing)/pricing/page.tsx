import type { Metadata } from "next";
import { Check } from "lucide-react";

import { PricingComparison } from "@/components/marketing/pricing-comparison";
import {
  MarketingHelpStrip,
  MarketingSubpageHero,
} from "@/components/marketing/marketing-subpage";
import {
  MarketingCtaBand,
  MarketingSection,
} from "@/components/marketing/page-shell";
import { JsonLd } from "@/components/seo/JsonLd";

import { createPageMetadata } from "@/lib/seo/site";
import { breadcrumbSchema, softwareApplicationSchema } from "@/lib/seo/schema";

export const metadata: Metadata = createPageMetadata({
  title: "UtilitySheet Pricing for Seller Utility Link Workflows",
  description:
    "View UtilitySheet pricing for Free, Pro, and Teams. Compare saved seller forms, free submitted sheets, submitted-sheet editing, branded utility sheet output, Property Handoff Packet mode, and team workflows.",
  path: "/pricing",
  keywords: [
    "utility sheet pricing",
    "transaction coordinator software pricing",
    "real estate utility packet pricing",
  ],
});

export default function PricingPage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
          softwareApplicationSchema({
            path: "/pricing",
            description:
              "UtilitySheet pricing for real estate teams that need seller utility forms, submitted-sheet editing on paid plans, utility sheet PDFs, and branded packet workflows.",
          }),
        ]}
      />

      <MarketingSubpageHero
        eyebrow="Pricing"
        title={
          <>
            Simple pricing for
            <br />
            smoother transactions.
          </>
        }
        description="Choose the plan that fits your workflow. Every plan includes guided seller forms, provider suggestions, and a clean buyer handoff."
      />

      <PricingComparison />
      <MarketingHelpStrip links={["features", "demo", "faq"]} />

      <MarketingSection
        title="Common reasons teams upgrade"
        description="Most upgrades happen when UtilitySheet becomes part of the regular listing-to-closing process."
      >
        <ul className="marketing-note-grid">
          {[
            ["Your brand, not ours.", "Every seller form and PDF reflects your own branding instead of UtilitySheet branding."],
            ["A fuller handoff.", "Property Handoff Packet mode adds home systems, access details, and service providers, not just utilities."],
            ["A form for each kind of file.", "Up to ten saved seller forms for listings, closings, condos, or anything else you handle differently."],
            ["No monthly limit.", "Every seller submission unlocks, because the workflow is now part of every transaction."],
            ["Corrections in the dashboard.", "Fix a submitted sheet yourself instead of sending the seller back through the public form."],
            ["The whole team in one place.", "Teammates share a workspace, Branding Profiles, request visibility, and editing access."],
          ].map(([title, copy]) => (
            <li key={title}>
              <span>
                <Check size={13} aria-hidden="true" />
              </span>
              <p>
                <strong>{title}</strong>
                {copy}
              </p>
            </li>
          ))}
        </ul>
      </MarketingSection>

      <MarketingCtaBand
        title="Start free. Upgrade when it sticks."
        description="See how much back-and-forth UtilitySheet saves on your next few files, then add branding, editing, or your team."
      />
    </div>
  );
}
