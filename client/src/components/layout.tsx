import { lazy, Suspense, useState } from "react";
import { Search, Map as MapIcon, List, X, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useSearchParams } from "wouter";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { AuthControl } from "@/components/auth-control";

const ThemeToggle = lazy(() =>
  import("@/components/theme-toggle").then((module) => ({
    default: module.ThemeToggle,
  })),
);

const footerSections = [
  {
    title: "Explore",
    links: [
      { label: "All Rooms", href: "/list" },
      { label: "Map View", href: "/" },
      { label: "Near RSU", href: "/list?q=RSU" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

function HeaderControlFallback({
  label,
}: {
  label: string;
}) {
  return (
    <div
      className="h-10 min-w-10 sm:min-w-[2.5rem] rounded-full bg-secondary/50 border px-3 flex items-center justify-center text-[10px] font-mono uppercase tracking-wider opacity-50"
      style={{ borderColor: "var(--color-border)" }}
      aria-hidden="true"
    >
      {label}
    </div>
  );
}

export function Layout({
  children,
  noPadding = false,
}: {
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  const [location] = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchQuery = searchParams.get("q") ?? "";

  const handleSearchChange = (value: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (value) {
      nextSearchParams.set("q", value);
    } else {
      nextSearchParams.delete("q");
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    <div
      className="min-h-screen font-sans"
      style={{
        backgroundColor: "var(--color-background)",
        color: "var(--color-foreground)",
      }}
    >
      <header className="fixed top-0 left-0 right-0 z-50">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, var(--color-background), var(--color-background) 60%, transparent)",
          }}
        />
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between relative">
          <Link href="/">
            <div className="cursor-pointer group flex items-center gap-3">
              <div className="w-10 h-10 bg-primary flex items-center justify-center">
                <span className="font-display font-black text-primary-foreground text-lg">
                  S
                </span>
              </div>
              <div className="hidden sm:block">
                <span className="font-display font-bold text-xl tracking-tighter group-hover:text-primary transition-colors">
                  SABAI STAY
                </span>
                <span className="text-[9px] font-mono block tracking-[0.3em] opacity-40 -mt-0.5">
                  STUDENT HOUSING
                </span>
              </div>
            </div>
          </Link>

          <nav
            className="hidden md:flex items-center gap-1 bg-secondary/50 backdrop-blur-md px-2 py-1.5 rounded-full border"
            style={{ borderColor: "var(--color-border)" }}
          >
            <Link href="/">
              <button
                className={cn(
                  "px-5 py-2 rounded-full font-mono text-xs tracking-wider transition-all",
                  location === "/"
                    ? "bg-primary text-primary-foreground font-bold"
                    : "opacity-70 hover:opacity-100 hover:bg-secondary",
                )}
              >
                MAP
              </button>
            </Link>
            <Link href="/list">
              <button
                className={cn(
                  "px-5 py-2 rounded-full font-mono text-xs tracking-wider transition-all",
                  location === "/list"
                    ? "bg-primary text-primary-foreground font-bold"
                    : "opacity-70 hover:opacity-100 hover:bg-secondary",
                )}
              >
                LIST
              </button>
            </Link>
            <Link href="/dashboard">
              <button
                className={cn(
                  "px-5 py-2 rounded-full font-mono text-xs tracking-wider transition-all",
                  location === "/dashboard"
                    ? "bg-primary text-primary-foreground font-bold"
                    : "opacity-70 hover:opacity-100 hover:bg-secondary",
                )}
              >
                DASH
              </button>
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(!searchOpen)}
              className="h-10 w-10 rounded-full bg-secondary/50 border flex items-center justify-center hover:bg-secondary transition-colors"
              style={{ borderColor: "var(--color-border)" }}
              aria-label={searchOpen ? "Close search" : "Open search"}
              aria-expanded={searchOpen}
            >
              {searchOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </button>

            <Suspense fallback={<HeaderControlFallback label="Theme" />}>
              <ThemeToggle />
            </Suspense>

            <AuthControl />

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="md:hidden h-10 w-10 rounded-full bg-secondary/50 border flex items-center justify-center hover:bg-secondary transition-colors"
              style={{ borderColor: "var(--color-border)" }}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          className={cn(
            "container mx-auto px-4 md:px-6 overflow-hidden transition-all duration-300",
            searchOpen ? "max-h-20 opacity-100 pb-4" : "max-h-0 opacity-0",
          )}
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-40" />
            <Input
              placeholder="Search condos, dorms, locations..."
              className="w-full bg-secondary/50 border pl-12 h-12 focus:border-primary"
              style={{ borderColor: "var(--color-border)" }}
              value={searchQuery}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </div>
        </div>
      </header>

      <main
        className={cn(
          "min-h-screen page-enter",
          noPadding ? "pt-0 pb-0" : "pt-28 pb-12",
        )}
      >
        {children}
      </main>

      {menuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 md:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMenuOpen(false);
            }
          }}
        >
          <div
            id="mobile-nav"
            className="absolute right-0 top-0 h-full w-[280px] border-l p-6"
            style={{
              backgroundColor: "var(--color-background)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="h-10 w-10 rounded-full border flex items-center justify-center"
                style={{ borderColor: "var(--color-border)" }}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex flex-col gap-4 mt-8">
              <Link href="/">
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "w-full text-left px-4 py-3 font-display text-xl uppercase tracking-wide border-l-2 transition-all",
                    location === "/"
                      ? "border-primary text-primary"
                      : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  Map View
                </button>
              </Link>
              <Link href="/list">
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "w-full text-left px-4 py-3 font-display text-xl uppercase tracking-wide border-l-2 transition-all",
                    location === "/list"
                      ? "border-primary text-primary"
                      : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  All Rooms
                </button>
              </Link>
              <Link href="/dashboard">
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "w-full text-left px-4 py-3 font-display text-xl uppercase tracking-wide border-l-2 transition-all",
                    location === "/dashboard"
                      ? "border-primary text-primary"
                      : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  Dashboard
                </button>
              </Link>
            </nav>
          </div>
        </div>
      )}

      {location !== "/listing" && !location.includes("/listing/") && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 md:hidden">
          <Link href={location === "/" ? "/list" : "/"}>
            <Button className="rounded-full h-14 px-8 bg-primary text-primary-foreground hover:opacity-90 font-display font-bold tracking-wider text-xs uppercase shadow-lg shadow-primary/20 transition-all">
              {location === "/" ? (
                <>
                  <List className="mr-2 h-4 w-4" /> View List
                </>
              ) : (
                <>
                  <MapIcon className="mr-2 h-4 w-4" /> View Map
                </>
              )}
            </Button>
          </Link>
        </div>
      )}

      {!noPadding && (
        <footer
          className="border-t py-16"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-card)",
          }}
        >
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              <div className="col-span-2 md:col-span-1 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary flex items-center justify-center">
                    <span className="font-display font-black text-primary-foreground text-sm">
                      S
                    </span>
                  </div>
                  <span className="font-display font-bold text-lg">SABAI STAY</span>
                </div>
                <p className="opacity-40 text-sm max-w-xs leading-relaxed">
                  Student housing platform for Rangsit University and Bangkok
                  universities.
                </p>
              </div>

              {footerSections.map((section) => (
                <div key={section.title} className="space-y-4">
                  <h4 className="font-mono text-xs text-primary uppercase tracking-wider">
                    {section.title}
                  </h4>
                  <ul className="space-y-2 text-sm opacity-60">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href}>
                          <span className="inline-flex cursor-pointer transition-opacity hover:opacity-100">
                            {link.label}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div
              className="mt-12 pt-6 border-t flex flex-col sm:flex-row justify-between items-center gap-4 text-xs opacity-30 font-mono"
              style={{ borderColor: "var(--color-border)" }}
            >
              <p>Copyright 2026 SABAI STAY</p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                PATHUM THANI, THAILAND
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
