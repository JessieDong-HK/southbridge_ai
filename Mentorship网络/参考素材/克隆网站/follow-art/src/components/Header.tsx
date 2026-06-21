"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MenuLink } from "@/types";

const menuLinks: MenuLink[] = [
  { label: "About", href: "/about" },
  { label: "Our Product", href: "/our-product" },
  { label: "Community Board", href: "/community-board" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
  { label: "Login", href: "/signin" },
  { label: "Join", href: "/signup", isCTA: true },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        "px-5 py-5",
        scrolled
          ? "bg-white/90 backdrop-blur-md shadow-sm"
          : "bg-[#f4793a]"
      )}
    >
      <div className="mx-auto flex items-center justify-between max-w-[1440px]">
        {/* Logo */}
        <a
          href="/"
          className={cn(
            "text-[13px] font-medium tracking-tight transition-colors",
            scrolled ? "text-black" : "text-white"
          )}
        >
          FOLLOW.{" "}ART
        </a>

        {/* Desktop Menu */}
        <nav className="hidden md:flex items-center gap-6">
          {menuLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={cn(
                "text-[13px] transition-opacity hover:opacity-70",
                link.isCTA
                  ? cn(
                      "px-3 py-1.5 rounded-full border font-medium",
                      scrolled
                        ? "border-black text-black"
                        : "border-white text-white"
                    )
                  : scrolled
                    ? "text-black"
                    : "text-white"
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className={cn("w-5 h-5", scrolled ? "text-black" : "text-white")} />
          ) : (
            <Menu className={cn("w-5 h-5", scrolled ? "text-black" : "text-white")} />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white shadow-lg border-t">
          <nav className="flex flex-col px-5 py-4">
            {menuLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={cn(
                  "py-3 text-[15px] border-b border-gray-100 last:border-0",
                  link.isCTA
                    ? "text-[#f4793a] font-medium"
                    : "text-black"
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      )}

      {/* Scroll-triggered bottom border */}
      <div
        className={cn(
          "absolute bottom-0 left-5 right-5 h-px transition-all duration-500",
          scrolled ? "bg-gray-200" : "bg-white/15"
        )}
      />
    </header>
  );
}
