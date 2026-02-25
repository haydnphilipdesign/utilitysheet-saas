import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { StackAuthProvider } from "@/components/providers/stack-auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const appBaseUrl = (() => {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    "http://localhost:3000";

  try {
    return new URL(envUrl);
  } catch {
    return new URL("http://localhost:3000");
  }
})();

const defaultTitle = "UtilitySheet — Stop the utility back-and-forth";
const defaultDescription =
  "Send sellers one guided link, then choose Simple Utility Sheet or Advanced Utility Packet output (web + PDF) without chasing anyone.";

export const metadata: Metadata = {
  metadataBase: appBaseUrl,
  title: {
    default: defaultTitle,
    template: "%s — UtilitySheet",
  },
  description: defaultDescription,
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    type: "website",
    siteName: "UtilitySheet",
    url: "/",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "UtilitySheet — Stop the utility back-and-forth",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/opengraph-image"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
