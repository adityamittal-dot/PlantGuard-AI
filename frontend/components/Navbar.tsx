"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

type NavLink = { href: string; label: string; roles?: string[] };

const publicLinks: NavLink[] = [
  { href: "/diseases", label: "Categories" },
  { href: "/crops", label: "Crops" },
  { href: "/help", label: "Help" },
];

const appLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/analyze", label: "Analyze" },
  { href: "/history", label: "History" },
  { href: "/analytics", label: "Analytics" },
  { href: "/research", label: "Research", roles: ["RESEARCHER", "ADMIN"] },
  { href: "/admin", label: "Admin", roles: ["ADMIN"] },
  { href: "/diseases", label: "Categories" },
  { href: "/help", label: "Help" },
];

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <motion.path
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        animate={open ? { d: "M5 5l10 10" } : { d: "M3 6h14" }}
        transition={{ duration: 0.2 }}
      />
      <motion.path
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        animate={open ? { d: "M15 5L5 15" } : { d: "M3 14h14" }}
        transition={{ duration: 0.2 }}
      />
    </svg>
  );
}

export function Navbar({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const links: NavLink[] = (variant === "app" ? appLinks : publicLinks).filter(
    (l) => !l.roles || (user && l.roles.includes(user.role))
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isMarketing = variant === "marketing";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-md",
        isMarketing
          ? "border-white/10 bg-forest/80 text-cream"
          : "border-charcoal/8 bg-mist/90 text-charcoal"
      )}
    >
      <div className="container-narrow section-pad flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link
            href={user ? "/dashboard" : "/"}
            className="font-display text-xl tracking-tight transition-opacity hover:opacity-80"
          >
            PlantGuard<span className="text-leaf"> AI</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative text-sm transition-colors duration-200",
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                    ? isMarketing
                      ? "text-white"
                      : "text-emerald"
                    : isMarketing
                      ? "text-cream/70 hover:text-white"
                      : "text-charcoal/60 hover:text-charcoal"
                )}
              >
                {link.label}
                {(pathname === link.href || pathname.startsWith(`${link.href}/`)) && (
                  <motion.span
                    layoutId={`navbar-active-${variant}`}
                    className={cn(
                      "absolute -bottom-[19px] left-0 right-0 h-0.5",
                      isMarketing ? "bg-leaf" : "bg-emerald"
                    )}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            {loading ? (
              <span className="text-xs opacity-50">…</span>
            ) : user ? (
              <>
                <span className="hidden text-sm opacity-70 sm:inline">
                  {user.full_name.split(" ")[0]}
                </span>
                {isMarketing && (
                  <Link href="/dashboard">
                    <Button size="sm" variant="outline" className="border-cream/30 text-cream hover:border-leaf hover:text-white">
                      Dashboard
                    </Button>
                  </Link>
                )}
                <Button
                  size="sm"
                  variant={isMarketing ? "ghost" : "outline"}
                  className={isMarketing ? "text-cream hover:bg-white/10" : ""}
                  onClick={logout}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button
                    size="sm"
                    variant="ghost"
                    className={isMarketing ? "text-cream hover:bg-white/10" : ""}
                  >
                    Sign in
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md transition-colors md:hidden",
              isMarketing ? "hover:bg-white/10" : "hover:bg-charcoal/5"
            )}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            <MenuIcon open={open} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t md:hidden"
            style={{ borderColor: isMarketing ? "rgba(255,255,255,0.1)" : "rgba(28,36,32,0.08)" }}
          >
            <nav className="container-narrow section-pad flex flex-col gap-1 py-4">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    pathname === link.href || pathname.startsWith(`${link.href}/`)
                      ? isMarketing
                        ? "bg-white/10 text-white"
                        : "bg-emerald/10 text-emerald"
                      : isMarketing
                        ? "text-cream/70 hover:bg-white/5 hover:text-white"
                        : "text-charcoal/65 hover:bg-charcoal/5 hover:text-charcoal"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t pt-3" style={{ borderColor: isMarketing ? "rgba(255,255,255,0.1)" : "rgba(28,36,32,0.08)" }}>
                {loading ? null : user ? (
                  <>
                    <span className={cn("px-3 text-xs", isMarketing ? "text-cream/60" : "text-charcoal/50")}>
                      Signed in as {user.full_name}
                    </span>
                    {isMarketing && (
                      <Link href="/dashboard">
                        <Button size="sm" variant="outline" className="w-full border-cream/30 text-cream">
                          Dashboard
                        </Button>
                      </Link>
                    )}
                    <Button size="sm" variant="outline" className="w-full" onClick={logout}>
                      Sign out
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/login">
                      <Button size="sm" variant="outline" className="w-full">
                        Sign in
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button size="sm" className="w-full">
                        Get started
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
