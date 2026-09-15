import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";

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
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
  showActions?: boolean;
}) {
  return (
    <section className="marketing-inner-hero">
      <div className="marketing-container">
        <p className="marketing-eyebrow">{eyebrow}</p>
        <h1 className="text-balance">{title}</h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
          {description}
        </p>
        {showActions && (
          <div className="marketing-actions mt-7">
            <Link href="/auth/signup" className="marketing-button">
              Start free <ArrowRight size={17} />
            </Link>
            <Link href="/demo" className="marketing-text-link">
              Try the demo <ArrowUpRight size={17} />
            </Link>
          </div>
        )}
        {children && <div className="mt-7">{children}</div>}
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
    <section
      id={id}
      className="marketing-inner-section px-5 py-14 sm:px-6 sm:py-18 lg:px-10"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <h2 className="text-3xl tracking-tight text-foreground sm:text-4xl text-balance">
            {title}
          </h2>
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
            Start Free <ArrowRight size={17} />
          </Link>
          <Link href="/demo" className="marketing-text-link">
            Try the Demo <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}
