import { faqItems, featureHighlights, pricingTiers } from '@/lib/marketing-content';
import { absoluteUrl, siteConfig } from '@/lib/seo/site';

type BreadcrumbItem = {
  name: string;
  path: string;
};

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${absoluteUrl('/')}#organization`,
    name: siteConfig.name,
    url: absoluteUrl('/'),
    logo: absoluteUrl('/logo-sm.png'),
    description: siteConfig.description,
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${absoluteUrl('/')}#website`,
    name: siteConfig.name,
    url: absoluteUrl('/'),
    description: siteConfig.description,
    publisher: {
      '@id': `${absoluteUrl('/')}#organization`,
    },
  };
}

const softwareId = () => `${absoluteUrl('/')}#software`;

// Machine-readable terms for each plan in pricingTiers. A unit test checks
// these against the displayed price strings so the two cannot drift apart.
export const planOfferTerms = {
  Free: { price: 0, unitText: undefined, minSeats: undefined },
  Pro: { price: 9, unitText: 'per month', minSeats: undefined },
  Teams: { price: 7, unitText: 'per seat per month', minSeats: 3 },
} as const satisfies Record<(typeof pricingTiers)[number]['name'], unknown>;

/**
 * The one SoftwareApplication entity for the site. Pages that render it share
 * the same @id, so search engines see a single product, not one per page.
 * There is deliberately no aggregateRating or review: only add those from
 * real, verifiable review data.
 */
export function softwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': softwareId(),
    name: siteConfig.name,
    applicationCategory: siteConfig.applicationCategory,
    operatingSystem: 'Web',
    url: absoluteUrl('/'),
    description: siteConfig.description,
    featureList: featureHighlights.map((feature) => feature.title),
    offers: pricingTiers.map((tier) => {
      const terms = planOfferTerms[tier.name];
      return {
        '@type': 'Offer',
        name: tier.name,
        url: absoluteUrl('/pricing'),
        price: terms.price,
        priceCurrency: 'USD',
        description: tier.description,
        ...(terms.unitText
          ? {
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: terms.price,
              priceCurrency: 'USD',
              unitText: terms.unitText,
              billingDuration: 'P1M',
            },
          }
          : {}),
        ...(terms.minSeats
          ? {
            eligibleQuantity: {
              '@type': 'QuantitativeValue',
              minValue: terms.minSeats,
              unitText: 'seats',
            },
          }
          : {}),
      };
    }),
    publisher: {
      '@id': `${absoluteUrl('/')}#organization`,
    },
    creator: {
      '@type': 'Organization',
      name: 'Multimedium',
      url: 'https://www.multimedium.dev',
    },
  };
}

export function faqPageSchema(items = faqItems) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
