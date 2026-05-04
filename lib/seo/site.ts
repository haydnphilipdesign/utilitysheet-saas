import type { Metadata } from 'next';

import { siteKeywords } from '@/lib/marketing-content';

const fallbackUrl = 'https://utilitysheet.com';

export const siteConfig = {
  name: 'UtilitySheet',
  shortName: 'UtilitySheet',
  description:
    'Utility sheet software for transaction coordinators and real estate agents. Share one seller link, collect utility details, and review clean utility sheets and PDFs for closing.',
  applicationCategory: 'BusinessApplication',
  creator: 'UtilitySheet',
  publisher: 'UtilitySheet',
  domain: 'utilitysheet.com',
  locale: 'en_US',
  keywords: [...siteKeywords],
};

export function getSiteUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    fallbackUrl;

  try {
    return new URL(envUrl).toString();
  } catch {
    return fallbackUrl;
  }
}

export function absoluteUrl(path = '/'): string {
  return new URL(path, getSiteUrl()).toString();
}

export const noIndexRobots: NonNullable<Metadata['robots']> = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
    'max-image-preview': 'none',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
};

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  keywords?: readonly string[];
  imagePath?: string;
  noIndex?: boolean;
};

export function createPageMetadata({
  title,
  description,
  path,
  keywords,
  imagePath = '/opengraph-image',
  noIndex = false,
}: PageMetadataInput): Metadata {
  return {
    title,
    description,
    keywords: keywords ? [...keywords] : undefined,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      url: path,
      images: [
        {
          url: imagePath,
          width: 1200,
          height: 630,
          alt: `${title} | ${siteConfig.name}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imagePath],
    },
    robots: noIndex ? noIndexRobots : undefined,
  };
}

export const noIndexMetadata: Metadata = {
  robots: noIndexRobots,
};
