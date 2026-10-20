import type { ReactNode } from "react";

// Right-hand illustration for companion page heroes: one product mockup in
// front, an optional second one offset behind it, and the corner shapes the
// Features hero uses. The mockups are aria-hidden; the caption is not.
export function MarketingHeroArt({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <figure className="inner-hero-art">
      <div className="inner-hero-stage">
        <div className="inner-hero-geometry" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="inner-hero-primary">{primary}</div>
        {secondary && <div className="inner-hero-secondary">{secondary}</div>}
      </div>
      <figcaption>Illustrative preview with a sample property and providers.</figcaption>
    </figure>
  );
}
