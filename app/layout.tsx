import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { Toaster } from "sonner";
import { StackAuthProvider } from "@/components/providers/stack-auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UtilitySheet - Simplify Utility Handoffs",
  description: "The fastest way to collect and share utility provider information during home sales.",
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
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <StackAuthProvider>
            {children}
          </StackAuthProvider>
          <Toaster
            position="bottom-right"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
