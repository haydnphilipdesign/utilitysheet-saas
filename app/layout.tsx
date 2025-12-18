import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { Toaster } from "sonner";
import { StackAuthProvider } from "@/components/providers/stack-auth-provider";
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
    <html lang="en" className="dark">
      <body className={`${figtree.variable} font-sans antialiased`}>
        <StackAuthProvider>
          {children}
        </StackAuthProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#18181b',
              border: '1px solid #27272a',
              color: '#fafafa',
            },
          }}
        />
      </body>
    </html>
  );
}
