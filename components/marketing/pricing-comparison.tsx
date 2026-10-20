"use client";

import Link from "next/link";
import { Check, Minus, ArrowRight } from "lucide-react";
import { pricingTiers } from "@/lib/marketing-content";
import { trackEvent } from "@/lib/analytics/events";

const plans = pricingTiers.map((tier, index) => ({
  ...tier,
  amount: ["$0", "$9", "$7"][index],
  period: ["forever", "/ month", "/ seat / month"][index],
  summary: [
    "For your next few files.",
    "For your everyday workflow.",
    "For a shared team workflow.",
  ][index],
  note: [
    "No credit card required",
    "Unlimited submitted sheets",
    "3-seat minimum · $21/month",
  ][index],
}));
const features: {
  label: string;
  values: [string | boolean, string | boolean, string | boolean];
}[] = [
  {
    label: "Submitted sheets",
    values: ["3 / month", "Unlimited", "Unlimited"],
  },
  {
    label: "Saved seller forms",
    values: ["1 / workspace", "10 / workspace", "10 / member"],
  },
  { label: "Reusable seller links & guided forms", values: [true, true, true] },
  { label: "Provider suggestions & HOA questions", values: [true, true, true] },
  { label: "Web sheet & downloadable PDF", values: [true, true, true] },
  { label: "Completion emails with optional PDF", values: [true, true, true] },
  { label: "Custom branding & branded links", values: [false, true, true] },
  { label: "Property Handoff Packet mode", values: [false, true, true] },
  { label: "Edit sheets after submission", values: [false, true, true] },
  { label: "Shared workspace & member roles", values: [false, false, true] },
  { label: "Priority support", values: [false, true, true] },
];
function FeatureValue({ value }: { value: string | boolean }) {
  if (typeof value === "string") return <span>{value}</span>;
  return value ? (
    <span className="comparison-check">
      <Check size={13} aria-hidden="true" />
      <span className="sr-only">Included</span>
    </span>
  ) : (
    <span className="comparison-minus">
      <Minus size={16} aria-hidden="true" />
      <span className="sr-only">Not included</span>
    </span>
  );
}
function PlanHeading({ index }: { index: number }) {
  const plan = plans[index];
  return (
    <>
      {index === 1 && (
        <span className="comparison-popular">For everyday work</span>
      )}
      <h2>{plan.name}</h2>
      <p>{plan.summary}</p>
      <div className="comparison-price">
        {plan.amount}
        <span>{plan.period}</span>
      </div>
      <p className="comparison-note">{plan.note}</p>
    </>
  );
}
function PlanLink({ index }: { index: number }) {
  const plan = plans[index];
  return (
    <Link
      href={plan.href}
      className={index === 1 ? "marketing-button" : "comparison-cta"}
      data-testid={`pricing-${plan.name.toLowerCase()}-cta`}
      onClick={() =>
        trackEvent("landing_cta_clicked", {
          cta_id: `secondary_pricing_${plan.name.toLowerCase()}_cta`,
          destination: plan.href,
          location: "pricing",
        })
      }
    >
      {index === 0 ? "Start free" : `Start ${plan.name}`}
      <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}
export function PricingComparison() {
  return (
    <section
      className="marketing-container pricing-comparison"
      aria-label="Compare plans"
    >
      <table className="comparison-table">
        <caption className="sr-only">
          UtilitySheet Free, Pro and Teams plan comparison. Teams requires at
          least three seats.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="comparison-label-heading">
              <h2>Find your fit.</h2>
              <p>
                The essentials on every plan.
                <br />
                More flexibility as you grow.
              </p>
            </th>
            {plans.map((plan, index) => (
              <th
                scope="col"
                key={plan.name}
                className={index === 1 ? "comparison-featured" : ""}
              >
                <PlanHeading index={index} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((feature) => (
            <tr key={feature.label}>
              <th scope="row">{feature.label}</th>
              {feature.values.map((value, index) => (
                <td
                  key={plans[index].name}
                  className={index === 1 ? "comparison-featured" : ""}
                >
                  <FeatureValue value={value} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Ready for your next file?</td>
            {plans.map((plan, index) => (
              <td
                key={plan.name}
                className={index === 1 ? "comparison-featured" : ""}
              >
                <PlanLink index={index} />
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      <div className="comparison-mobile">
        {plans.map((plan, index) => (
          <article
            key={plan.name}
            className={`comparison-plan ${index === 1 ? "comparison-featured" : ""}`}
          >
            <PlanHeading index={index} />
            <dl>
              {features.map((feature) => (
                <div key={feature.label}>
                  <dt>{feature.label}</dt>
                  <dd>
                    <FeatureValue value={feature.values[index]} />
                  </dd>
                </div>
              ))}
            </dl>
            <PlanLink index={index} />
          </article>
        ))}
      </div>
      <p className="comparison-footnote">
        Free counts a sheet only when a seller submits it. Unanswered requests
        never count. Submissions over the limit are saved and unlock when you
        upgrade. Paused forms count toward your saved-form limit; existing links
        and settings are kept if you downgrade.
      </p>
    </section>
  );
}
