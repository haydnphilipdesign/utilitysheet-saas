import type { Metadata } from "next";
import { Check } from "lucide-react";

import { WorkflowTimeline } from "@/components/marketing/workflow-timeline";
import { MarketingHelpStrip } from "@/components/marketing/marketing-subpage";
import {
  MarketingCtaBand,
  MarketingSection,
} from "@/components/marketing/page-shell";
import { JsonLd } from "@/components/seo/JsonLd";

import { createPageMetadata } from "@/lib/seo/site";
import { breadcrumbSchema } from "@/lib/seo/schema";

export const metadata: Metadata = createPageMetadata({
  title: "How UtilitySheet Works After Signup",
  description:
    "See how UtilitySheet works after signup: copy your reusable seller link, collect utility details, review the finished utility sheet PDF, and update submitted sheets on paid plans.",
  path: "/how-it-works",
  keywords: [
    "how utility sheet works",
    "seller utility form workflow",
    "real estate utility handoff process",
  ],
});

export default function HowItWorksPage() {
  return (
    <div className="bg-background">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "How It Works", path: "/how-it-works" },
          ]),
        ]}
      />

      <section className="marketing-container workflow-page-hero">
        <p className="marketing-eyebrow">How it works</p>
        <h1>
          From seller link to buyer handoff.
          <br />
          <em>Three simple steps.</em>
        </h1>
        <p>
          A little less chasing. A much better handoff. Collect the details
          once, then give buyers the information they need to settle in.
        </p>
      </section>

      <WorkflowTimeline />

      <MarketingSection
        title="Where it fits in your process"
        description="Transaction coordinators and agents slot UtilitySheet into a message they already send, whether that is at listing intake, under contract, or as closing approaches."
      >
        <ul className="marketing-note-grid">
          {[
            ["Send it once, reuse it everywhere.", "Add the reusable seller link to your seller welcome email, listing checklist, or closing-prep email. On the buyer side, ask the listing agent to forward it to the seller."],
            ["Collect early, review before sharing.", "If you collect details early in the listing, review the finished sheet before you share it. Providers and access details can change before closing."],
            ["Review, then hand it off.", "When the seller submits, review the finished utility sheet in the dashboard before sharing it with buyers, agents, support staff, or anyone else who needs it."],
            ["Correct it without reopening the form.", "On Pro and Teams, fix capitalization, addresses, provider names, or contact details after submission without sending the seller back."],
            ["A form for each kind of file.", "If listings, closings, or condos need different questions, save a seller form for each. Every form has its own reusable link, and you can pick one for an individual request."],
            ["Ask only what you need.", "Seller forms ask about an HOA or condo association by default. Turn that question, the electric meter number, or any utility on or off for a form or a single request, on every plan."],
            ["Utilities only, or the whole home.", "Use Simple Utility Sheet mode for utilities, or Property Handoff Packet mode for utilities, home systems, access details, and service providers in one seller handoff."],
            ["On brand from start to finish.", "Keep the workflow branded on paid plans so the handoff matches the rest of your client communication."],
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

      <MarketingHelpStrip links={["features", "pricing", "faq"]} />

      <MarketingCtaBand
        title="Try the workflow on a real transaction"
        description="Start free, send a seller link, and see how much easier the utility handoff feels when the process is standardized."
      />
    </div>
  );
}
