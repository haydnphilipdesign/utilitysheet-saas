import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

type BreadcrumbItem = { label: string; href: string };

export function MarketingBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">/</span>}
            {index === items.length - 1 ? (
              <span aria-current="page" className="text-foreground">
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function MarketingPageHero({
  eyebrow,
  title,
  description,
  children,
  showActions = false,
  art,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
  showActions?: boolean;
  /** Illustration for the right half, usually a MarketingHeroArt. */
  art?: ReactNode;
}) {
  return (
    <section className="marketing-inner-hero">
      <div className={`marketing-container${art ? " inner-hero-grid" : ""}`}>
        <div className="inner-hero-copy">
          <p className="marketing-eyebrow">{eyebrow}</p>
          <h1 className="text-balance">{title}</h1>
          <p className="inner-hero-lead">{description}</p>
          {showActions && (
            <div className="marketing-actions mt-7">
              <Link href="/auth/signup" className="marketing-button">
                Start free <ArrowRight size={17} />
              </Link>
              <Link href="/demo" className="marketing-text-link">
                Try the demo <ArrowRight size={17} />
              </Link>
            </div>
          )}
          {children && <div className="mt-7">{children}</div>}
        </div>
        {art}
      </div>
    </section>
  );
}

export function MarketingSection({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="marketing-inner-section py-14 sm:py-20">
      <div className="marketing-container">
        <div className="max-w-3xl">
          <h2 className="marketing-inner-title text-balance">{title}</h2>
          {description && (
            <p className="mt-4 text-base leading-8 text-muted-foreground sm:text-lg">
              {description}
            </p>
          )}
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

type MarketingPoint = { title?: string; copy: string };

// Heading on the left, numbered points on the right: the same capability list
// the home page uses, for sections that would otherwise be a row of cards.
export function MarketingPointsSection({
  title,
  description,
  points,
  ordered = false,
}: {
  title: string;
  description?: string;
  points: readonly MarketingPoint[];
  /** Render as an ordered list when the sequence matters (checklists). */
  ordered?: boolean;
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <section className="marketing-inner-section py-14 sm:py-20">
      <div className="marketing-container capability-grid">
        <div>
          <h2 className="marketing-inner-title text-balance">{title}</h2>
          {description && <p className="capability-intro">{description}</p>}
        </div>
        <List className="capability-list">
          {points.map((point, index) => (
            <li key={point.title ?? point.copy}>
              <span className="capability-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                {point.title && <h3>{point.title}</h3>}
                <p>{point.copy}</p>
              </div>
            </li>
          ))}
        </List>
      </div>
    </section>
  );
}

// Three short steps side by side with a rule on top, like the home page's
// "When to send it" row.
export function MarketingStepRow({
  steps,
}: {
  steps: readonly { title: string; copy: string }[];
}) {
  return (
    <ol className="marketing-step-row">
      {steps.map((step, index) => (
        <li key={step.title}>
          <span className="marketing-step-number" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3>{step.title}</h3>
          <p>{step.copy}</p>
        </li>
      ))}
    </ol>
  );
}

// Internal links to neighboring pages, laid out like the home page's
// audience strip instead of a row of pill buttons.
export function MarketingRelatedLinks({
  title = "Keep reading",
  description,
  links,
}: {
  title?: string;
  description?: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <section className="marketing-inner-section marketing-related">
      <div className="marketing-container marketing-related-row">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>
                {link.label} <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function MarketingCtaBand({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="marketing-final marketing-section">
      <div className="marketing-container">
        <h2 className="text-balance">{title}</h2>
        <p>{description}</p>
        <div className="marketing-actions">
          <Link href="/auth/signup" className="marketing-button">
            Start free <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link href="/demo" className="marketing-text-link">
            Try the demo <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
