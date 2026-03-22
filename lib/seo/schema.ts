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

export function softwareApplicationSchema(options?: {
  path?: string;
  name?: string;
  description?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${absoluteUrl(options?.path || '/')}#software`,
    name: options?.name || siteConfig.name,
    applicationCategory: siteConfig.applicationCategory,
    operatingSystem: 'Web',
    url: absoluteUrl(options?.path || '/'),
    description: options?.description || siteConfig.description,
    featureList: featureHighlights.map((feature) => feature.title),
    offers: pricingTiers.map((tier) => ({
      '@type': 'Offer',
      name: tier.name,
      url: absoluteUrl(tier.href),
      price:
        tier.price === 'Free'
          ? '0'
          : tier.price.startsWith('$')
            ? tier.price.replace(/[^0-9.]/g, '')
            : undefined,
      priceCurrency: tier.price === 'Free' || tier.price.startsWith('$') ? 'USD' : undefined,
      description: tier.description,
    })),
    provider: {
      '@id': `${absoluteUrl('/')}#organization`,
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
