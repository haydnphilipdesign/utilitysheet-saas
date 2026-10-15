import Link from "next/link";
import {
  ArrowRight,
  CircleHelp,
  FileCheck2,
  Heart,
  LayoutGrid,
  Link2,
  ShieldCheck,
  Tag,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

export function MarketingSubpageHero({
  eyebrow,
  title,
  description,
  variant = "pricing",
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  variant?: "pricing" | "faq";
}) {
  const benefits =
    variant === "faq"
      ? [
          {
            icon: Zap,
            title: "Quick answers",
            copy: "Find what you need and get back to your day.",
          },
          {
            icon: ShieldCheck,
            title: "Clear information",
            copy: "Practical details, without the jargon.",
          },
          {
            icon: Heart,
            title: "A smoother handoff",
            copy: "Know what to expect, from link to PDF.",
          },
        ]
      : [
          {
            icon: Zap,
            title: "Less back-and-forth",
            copy: "Guided forms make details easier to collect.",
          },
          {
            icon: ShieldCheck,
            title: "Details you can review",
            copy: "Seller-confirmed information in one place.",
          },
          {
            icon: Heart,
            title: "A thoughtful buyer handoff",
            copy: "A clean web sheet and PDF, ready to share.",
          },
        ];
  return (
    <section className="subpage-hero">
      <div className="marketing-container subpage-hero-grid">
        <div className="subpage-hero-copy">
          <p className="marketing-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="subpage-description">{description}</p>
        </div>
        <ul className="subpage-benefits" aria-label="At a glance">
          {benefits.map(({ icon: Icon, title: benefit, copy }) => (
            <li key={benefit}>
              <span className="subpage-icon">
                <Icon size={22} aria-hidden="true" />
              </span>
              <div>
                <h2>{benefit}</h2>
                <p>{copy}</p>
              </div>
            </li>
          ))}
        </ul>
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
  "how-it-works": {
    icon: Link2,
    title: "One link. Every property.",
    copy: "Set up your seller form once, then reuse it on your next file.",
    href: "/how-it-works",
    label: "See how it works",
  },
  demo: {
    icon: FileCheck2,
    title: "Start with a real walkthrough",
    copy: "Explore the seller form and finished sheet in the interactive demo.",
    href: "/demo",
    label: "Try the demo",
  },
  faq: {
    icon: CircleHelp,
    title: "A few more questions?",
    copy: "Get the details on seller forms, plan limits, and PDF delivery.",
    href: "/faq",
    label: "Browse the FAQ",
  },
  features: {
    icon: LayoutGrid,
    title: "See everything it does",
    copy: "Seller links, provider suggestions, branding, editing, and Teams.",
    href: "/features",
    label: "Explore features",
  },
  pricing: {
    icon: Tag,
    title: "Find the right plan",
    copy: "Start free, then compare Pro and Teams when the workflow sticks.",
    href: "/pricing",
    label: "Compare plans",
  },
} as const;

export type MarketingHelpLink = keyof typeof helpLinks;

// Pages pass the three destinations that make sense next; never their own route.
export function MarketingHelpStrip({
  links = ["how-it-works", "demo", "faq"],
}: {
  links?: MarketingHelpLink[];
}) {
  return (
    <section
      className="marketing-container subpage-help"
      aria-label="More ways to get started"
    >
      {links.map((key) => helpLinks[key]).map(({ icon: Icon, title, copy, href, label }) => (
        <div key={title}>
          <span className="subpage-icon">
            <Icon size={23} aria-hidden="true" />
          </span>
          <div>
            <h2>{title}</h2>
            <p>{copy}</p>
            <Link href={href}>
              {label} <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      ))}
    </section>
  );
}
