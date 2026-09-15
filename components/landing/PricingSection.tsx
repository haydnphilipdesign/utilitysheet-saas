"use client";

import { useEffect, useRef } from "react";
import { useInView } from "framer-motion";
import { Check } from "lucide-react";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics/events";
import { pricingTiers } from "@/lib/marketing-content";

const tiers = [
  {
    ...pricingTiers[0],
    period: undefined,
    description: "For trying UtilitySheet on your next few files.",
    cta: "Start free",
    popular: false,
    features: [
      "Try it on 3 live files per month",
      "Reusable seller link",
      "Clean PDF and share link",
      "Completion email notifications",
      "PDF can attach to completion emails",
      "UtilitySheet branding on shared links",
    ],
  },
  {
    ...pricingTiers[1],
    price: "$9",
    period: "/month",
    description: "For solo TCs and agents. Every property, your branding.",
    cta: "Start Pro",
    popular: true,
    features: [
      "Use UtilitySheet on every file",
      "Custom branded link",
      "Property Handoff Packet mode",
      "Edit submitted sheets after seller submission",
      "Custom PDF branding",
      "Branded PDF attachments on completion emails",
      "Remove UtilitySheet footer",
      "Priority support",
    ],
  },
  {
    ...pricingTiers[2],
    price: "$7",
    period: "/seat/mo",
    description: "For a shared workflow. 3-seat minimum ($21/month).",
    cta: "Start Teams",
    popular: false,
    features: [
      "Everything in Pro",
      "Shared organization workspace",
      "Any teammate with request access can edit submitted sheets",
      "Invite members and assign roles",
      "Seat-based billing with 3-seat minimum",
      "Org-wide packet defaults",
      "Priority support",
    ],
  },
];

export function PricingSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const isInView = useInView(sectionRef, {
    once: true,
    margin: "-20% 0px -20% 0px",
  });

  useEffect(() => {
    if (!isInView) return;
    trackEvent("landing_section_viewed", {
      section_id: "pricing",
      page: "landing",
      location: "pricing",
    });
    trackEvent("pdf_attachment_value_prop_viewed", {
      section_id: "pricing",
      page: "landing",
      location: "pricing",
    });
  }, [isInView]);

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="scroll-mt-24 py-16 sm:py-24 bg-background border-t border-border/50"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-slate-600 font-bold text-xs sm:text-sm tracking-wider uppercase mb-2 sm:mb-3">
            Pricing
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-3 sm:mb-4 text-balance">
            Start small. Make it part of every closing.
          </h2>
          <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto">
            Try UtilitySheet free. Choose Pro for your own workflow, or bring
            everyone together on Teams.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex min-h-full flex-col rounded-lg border p-6 sm:p-7 lg:p-8 ${
                tier.popular
                  ? "bg-white border-[#294f68] shadow-lg shadow-slate-900/5"
                  : "bg-card border-border"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#294f68] px-4 py-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-white shadow-lg shadow-emerald-950/20 sm:-top-4">
                  FOR EVERYDAY WORK
                </div>
              )}

              <div className="mb-7">
                <h3 className="text-lg font-semibold text-foreground">
                  {tier.name}
                </h3>
                <div className="mt-4 flex flex-wrap items-baseline text-foreground">
                  <span className="text-4xl font-bold tracking-tight sm:text-5xl">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="ml-1.5 text-base font-medium text-muted-foreground sm:text-lg">
                      {tier.period}
                    </span>
                  )}
                </div>
                <p className="mt-4 min-h-0 text-sm leading-6 text-muted-foreground lg:min-h-[5.25rem]">
                  {tier.description}
                </p>
              </div>

              <ul className="mb-8 flex-1 space-y-3.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-500/12">
                      <Check className="h-3.5 w-3.5 text-slate-600" />
                    </div>
                    <span className="text-sm leading-6 text-secondary-foreground">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier.href}
                data-testid={`pricing-${tier.name.toLowerCase()}-cta`}
                className={`flex h-12 w-full items-center justify-center rounded-md text-sm font-semibold active:scale-[0.98] sm:text-base ${
                  tier.popular
                    ? "!bg-[#294f68] !text-white hover:!bg-[#203e52]"
                    : "!bg-foreground !text-background hover:!bg-foreground/90"
                }`}
                onClick={() => {
                  trackEvent("landing_cta_clicked", {
                    cta_id: `secondary_pricing_${tier.name.toLowerCase()}_cta`,
                    destination: tier.href,
                    location: "pricing",
                  });
                }}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Teams starts at $21/month for 3 seats. All plans include a reusable
          seller link, a web sheet, and PDF downloads.
        </p>
      </div>
    </section>
  );
}
