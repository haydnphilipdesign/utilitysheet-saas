"use client";

import { useEffect, useRef } from "react";
import { useInView } from "framer-motion";
import { ArrowRight, Check, Minus } from "lucide-react";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics/events";
import { pricingTiers } from "@/lib/marketing-content";

const tiers = [
  {
    ...pricingTiers[0],
    // The card heading already says Free, so the price line shows the amount.
    price: "$0",
    period: undefined,
    description: "For trying UtilitySheet on your next few files.",
    cta: "Start free",
    popular: false,
    features: [
      "3 submitted sheets per month",
      "Unanswered requests never count",
      "1 customizable seller form per workspace",
      "HOA and condo association questions",
      "Clean PDF and share link",
      "Completion email notifications",
      "PDF can attach to completion emails",
    ],
    // Shown with a minus, not a check: these are limits, not features.
    limits: ["UtilitySheet branding on shared links"],
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
      "Up to 10 saved seller forms per workspace",
      "Your own link name, like utilitysheet.com/form/yourname",
      "Property Handoff Packet mode",
      "Edit sheets after the seller submits",
      "Custom PDF branding",
      "Branded PDF attachments on completion emails",
      "Remove UtilitySheet footer",
      "Priority support",
    ],
  },
  {
    ...pricingTiers[2],
    price: "$7",
    period: "/seat/month",
    description: "For a shared workflow. 3-seat minimum ($21/month).",
    cta: "Start Teams",
    popular: false,
    features: [
      "Everything in Pro",
      "Up to 10 saved seller forms per member",
      "One shared workspace for the team",
      "Any teammate with request access can edit submitted sheets",
      "Invite members and assign roles",
      "Billed per seat, with a 3-seat minimum",
      "Branding Profiles shared by the whole team",
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
      className="home-pricing marketing-section scroll-mt-24 border-t border-border"
    >
      <div className="marketing-container">
        <div className="home-section-heading">
          <p className="marketing-eyebrow">PRICING</p>
          <h2 className="text-balance">
            Start small. <em>Make it part of every closing.</em>
          </h2>
          <p>
            Try UtilitySheet free. Choose Pro for your own workflow, or bring
            everyone together on Teams.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`home-plan relative flex min-h-full flex-col p-6 sm:p-7 lg:p-8${
                tier.popular ? " is-popular" : ""
              }`}
            >
              {tier.popular && (
                <div className="home-plan-badge">
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
                    <span className="comparison-check mt-0.5 flex-shrink-0">
                      <Check size={12} aria-hidden="true" />
                    </span>
                    <span className="text-sm leading-6 text-secondary-foreground">
                      {feature}
                    </span>
                  </li>
                ))}
                {"limits" in tier &&
                  tier.limits?.map((limit) => (
                    <li key={limit} className="flex items-start gap-3">
                      <span className="comparison-minus mt-0.5 w-5 flex-shrink-0 justify-center">
                        <Minus size={16} aria-hidden="true" />
                      </span>
                      <span className="text-sm leading-6 text-muted-foreground">
                        <span className="sr-only">Limit: </span>
                        {limit}
                      </span>
                    </li>
                  ))}
              </ul>

              <Link
                href={tier.href}
                data-testid={`pricing-${tier.name.toLowerCase()}-cta`}
                className={`w-full ${tier.popular ? "marketing-button" : "comparison-cta"}`}
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

        <p className="comparison-footnote">
          Teams starts at $21/month for 3 seats. All plans include a reusable
          seller link, a web sheet, and PDF downloads. The free plan counts a
          sheet only when a seller submits it. Paused forms count toward your
          saved-form limit, and existing links and settings are kept if
          you downgrade.
        </p>
        <p className="home-section-link">
          <Link href="/pricing" className="marketing-text-link">
            Compare every plan in detail <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </p>
      </div>
    </section>
  );
}
