import type { Metadata } from "next";
import Link from "next/link";

import { WorkflowTimeline } from "@/components/marketing/workflow-timeline";
import { MarketingHelpStrip } from "@/components/marketing/marketing-subpage";
import {
  MarketingCtaBand,
  MarketingSection,
} from "@/components/marketing/page-shell";
import { JsonLd } from "@/components/seo/JsonLd";

import { createPageMetadata } from "@/lib/seo/site";
import { breadcrumbSchema, softwareApplicationSchema } from "@/lib/seo/schema";

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
          softwareApplicationSchema({
            path: "/how-it-works",
            description:
              "A step-by-step workflow for collecting seller utility information, delivering a utility sheet, and managing corrections after submission on paid plans.",
          }),
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
      <MarketingHelpStrip />

      <MarketingSection
        title="Where it fits in your process"
        description="Transaction coordinators and agents slot UtilitySheet into a message they already send, whether that is at listing intake, under contract, or as closing approaches."
      >
        <div className="grid gap-6 md:grid-cols-2">
          {[
            "Add the reusable seller link once to your seller welcome email, listing checklist, or closing-prep email, then reuse it on every file. On the buyer side, ask the listing agent to forward it to the seller.",
            "If you collect details early in the listing, review the finished sheet before you share it. Providers and access details can change before closing.",
            "When the seller submits, review the finished utility sheet in the dashboard before sharing it with buyers, agents, support staff, or anyone else who needs the information.",
            "On Pro and Teams, you can correct capitalization, addresses, provider names, or contact details after submission without reopening the seller form.",
            "If listings, closings, or condos need different questions, save a seller form for each. Every form has its own reusable link, and you can pick one when you create an individual request.",
            "Seller forms ask about an HOA or condo association by default. Turn that question, the electric meter number, or any utility on or off for a whole form or for a single request, on every plan.",
            "Use Simple Utility Sheet mode when you just need utilities, or Property Handoff Packet mode to collect utilities, home systems, access details, and service-provider information in one seller handoff.",
            "Keep the workflow branded on paid plans so the handoff matches the rest of your client communication.",
          ].map((item) => (
            <div
              key={item}
              className="rounded-3xl border border-border bg-card/20 p-6 text-muted-foreground"
            >
              {item}
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        title="Related pages"
        description="These pages go deeper on role-specific use cases and plan details."
      >
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link
            href="/features"
            className="rounded-full border border-border px-4 py-2 hover:bg-muted"
          >
            Explore features
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-border px-4 py-2 hover:bg-muted"
          >
            View pricing
          </Link>
          <Link
            href="/seller-utility-information-form"
            className="rounded-full border border-border px-4 py-2 hover:bg-muted"
          >
            Seller utility information form
          </Link>
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="Try the workflow on a real transaction"
        description="Start free, send a seller link, and see how much easier the utility handoff feels when the process is standardized."
      />
    </div>
  );
}
