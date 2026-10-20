import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { MarketingRelatedLinks } from "@/components/marketing/page-shell";

export type SubpageHeroFact = {
  icon: LucideIcon;
  title: string;
  copy: string;
};

export function MarketingSubpageHero({
  eyebrow,
  title,
  description,
  facts,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  /** Short, concrete facts beside the heading. Leave out for none. */
  facts?: readonly SubpageHeroFact[];
}) {
  return (
    <section className="subpage-hero">
      <div className="marketing-container subpage-hero-grid">
        <div className="subpage-hero-copy">
          <p className="marketing-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="subpage-description">{description}</p>
        </div>
        {facts?.length ? (
          <ul className="subpage-benefits" aria-label="At a glance">
            {facts.map(({ icon: Icon, title: fact, copy }) => (
              <li key={fact}>
                <span className="subpage-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <div>
                  <h2>{fact}</h2>
                  <p>{copy}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="subpage-geometry" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </section>
  );
}

const helpLinks = {
  "how-it-works": { href: "/how-it-works", label: "See how it works" },
  demo: { href: "/demo", label: "Try the demo" },
  faq: { href: "/faq", label: "Browse the FAQ" },
  features: { href: "/features", label: "Explore features" },
  pricing: { href: "/pricing", label: "Compare plans" },
} as const;

export type MarketingHelpLink = keyof typeof helpLinks;

// Pages pass the three destinations that make sense next; never their own route.
export function MarketingHelpStrip({
  links = ["how-it-works", "demo", "faq"],
}: {
  links?: MarketingHelpLink[];
}) {
  return <MarketingRelatedLinks links={links.map((key) => helpLinks[key])} />;
}
