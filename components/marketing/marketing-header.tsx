"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@stackframe/stack";
import { Menu, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics/events";

const navigation = [
  ["Home", "/"],
  ["Features", "/features"],
  ["How It Works", "/how-it-works"],
  ["Pricing", "/pricing"],
  ["FAQ", "/faq"],
  ["Demo", "/demo"],
  ["About", "/about"],
];

export function MarketingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hasTrackedPrimaryViewRef = useRef(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const user = useUser();

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (user || hasTrackedPrimaryViewRef.current) return;
    trackEvent("landing_primary_cta_viewed", {
      cta_id: "primary_header_start_free",
      page: "landing",
      location: "marketing_header",
    });
    hasTrackedPrimaryViewRef.current = true;
  }, [user]);

  function trackSignup(
    location: "marketing_header" | "marketing_mobile_menu",
    ctaId: string,
  ) {
    trackEvent("landing_primary_cta_clicked", {
      cta_id: ctaId,
      destination: "/auth/signup",
      location,
    });
    setMobileMenuOpen(false);
  }

  return (
    <header className="fixed top-0 z-50 w-full border-b border-border/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
          aria-label="UtilitySheet home"
        >
          <span className="rounded-lg bg-slate-600 p-1.5">
            <Image
              src="/logo-sm.png"
              alt=""
              width={20}
              height={20}
              className="h-5 w-5"
            />
          </span>
          <span className="text-xl font-bold tracking-tight">UtilitySheet</span>
          <span className="text-norma-muted ml-1.5 text-xs">by Norma</span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-5 md:flex lg:gap-7"
        >
          {navigation.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={`${label === "About" ? "hidden lg:block " : ""}py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {user ? (
            <Link
              href="/dashboard"
              className="marketing-button !min-h-10 !px-4"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="hidden py-3 text-xs text-muted-foreground hover:text-foreground sm:block"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="marketing-button hidden !min-h-10 !px-4 !text-xs sm:inline-flex"
                data-testid="marketing-header-signup-cta"
                onClick={() =>
                  trackSignup("marketing_header", "primary_header_start_free")
                }
              >
                Start free
              </Link>
              <Link
                href="/auth/signup"
                className="marketing-button !min-h-10 !px-4 !text-xs sm:hidden"
                data-testid="marketing-header-mobile-signup-cta"
                onClick={() =>
                  trackSignup(
                    "marketing_header",
                    "primary_header_mobile_start_free",
                  )
                }
              >
                Start free
              </Link>
            </>
          )}
          <button
            ref={toggleRef}
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
            data-testid="marketing-mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={
              mobileMenuOpen ? "Close Navigation Menu" : "Open Navigation Menu"
            }
            aria-expanded={mobileMenuOpen}
            aria-controls="marketing-mobile-navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <nav
          id="marketing-mobile-navigation"
          aria-label="Mobile navigation"
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border bg-background p-4 shadow-lg md:hidden"
        >
          {navigation.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-md px-4 py-3 text-sm hover:bg-muted"
            >
              {label}
            </Link>
          ))}
          {!user && (
            <div className="mt-3 border-t border-border pt-3">
              <Link
                href="/auth/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-sm"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="marketing-button mt-2 w-full"
                data-testid="marketing-mobile-signup-cta"
                onClick={() =>
                  trackSignup(
                    "marketing_mobile_menu",
                    "primary_mobile_menu_start_free",
                  )
                }
              >
                Start free
              </Link>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
