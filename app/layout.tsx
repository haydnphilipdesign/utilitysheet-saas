import type { Metadata, Viewport } from 'next';
import { Figtree } from 'next/font/google';
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { StackAuthProvider } from '@/components/providers/stack-auth-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { GrowthAttributionCapture } from '@/components/growth/growth-attribution-capture';
import { getSiteUrl, siteConfig } from '@/lib/seo/site';
import './globals.css';

const figtree = Figtree({
  variable: '--font-figtree',
  subsets: ['latin'],
});

const defaultTitle = 'UtilitySheet | Utility Sheet Software for Real Estate Teams';
const defaultDescription = siteConfig.description;

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: siteConfig.name,
  title: {
    default: defaultTitle,
    template: `%s | ${siteConfig.name}`,
  },
  description: defaultDescription,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.creator }],
  creator: siteConfig.creator,
  publisher: siteConfig.publisher,
  category: 'Real estate software',
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
    apple: '/logo-sm.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    type: 'website',
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    url: "/",
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'UtilitySheet utility sheet software for transaction coordinators and agents',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultTitle,
    description: defaultDescription,
    images: ['/opengraph-image'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#475569',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${figtree.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <StackAuthProvider>
            <GrowthAttributionCapture />
            {children}
          </StackAuthProvider>
          <Toaster
            position="bottom-center"
          />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
