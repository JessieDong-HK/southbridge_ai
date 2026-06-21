"use client";

import { useRef, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

export function JoinUsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#f4793a] min-h-screen overflow-hidden"
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-[10%] w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-[5%] w-48 h-48 bg-black/5 rounded-full blur-3xl" />
      </div>

      <div className="sticky top-0 min-h-screen flex items-center">
        <div className="w-full max-w-[1440px] mx-auto px-5 py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            {/* Left: Join Us */}
            <div>
              <p className="text-[16px] text-white/60 tracking-[-0.03em] mb-2">
                Join Us
              </p>
              <h2
                className="text-huge text-black leading-[0.79] mb-6"
                style={{ fontFamily: "var(--font-inter)", fontWeight: 900 }}
              >
                Join Us
              </h2>
            </div>

            {/* Right: CTA */}
            <div
              className={`transition-all duration-700 delay-300 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
            >
              <p className="text-[18px] text-white/80 leading-relaxed mb-8">
                Create Your Card and share wherever your practice is seen.
                Join 2.5K+ curators and artists across 100+ countries.
              </p>

              <a
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white rounded-full text-[16px] font-medium hover:bg-gray-900 transition-all hover:scale-105 hover:shadow-xl hover:shadow-black/20 group"
              >
                Join
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>

              <p className="text-[14px] text-white/50 mt-4">
                Free to start. No algorithm.
              </p>
            </div>
          </div>

          {/* Footer info within this section */}
          <div className="mt-32 md:mt-48 border-t border-white/10 pt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="text-white text-[13px] font-medium">
                  FOLLOW.{" "}ART
                </p>
                <p className="text-white/50 text-[13px] mt-1">
                  2026 © FOLLOW.ART
                </p>
                <a
                  href="mailto:help@follow.art"
                  className="text-white/50 text-[13px] hover:text-white transition-colors"
                >
                  help@follow.art
                </a>
              </div>
              <div className="flex flex-wrap gap-4">
                {[
                  "Brand Kit",
                  "Buy Gift Card",
                  "Terms & Conditions",
                  "Privacy Policy",
                  "Cookie Policy",
                ].map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="text-white/60 text-[13px] hover:text-white transition-colors"
                  >
                    {link}
                  </a>
                ))}
              </div>
              <div className="text-white/40 text-[12px]">
                <p>
                  Digital product development by{" "}
                  <a href="#" className="underline hover:text-white/60">
                    Viccy Agency
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
