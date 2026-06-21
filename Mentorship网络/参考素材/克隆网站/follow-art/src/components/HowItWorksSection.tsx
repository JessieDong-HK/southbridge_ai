"use client";

import { useRef, useEffect, useState } from "react";

export function HowItWorksSection() {
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

  const benefits = [
    {
      title: "Share your practice.",
      desc: "Present your artistic or curatorial identity in one clear format.",
    },
    {
      title: "Build new relationships.",
      desc: "Connect with curators, artists, gallerists, and supporters worldwide.",
    },
    {
      title: "Get financial support.",
      desc: "Receive direct contributions from your audience, instantly.",
    },
    {
      title: "All in one place",
      desc: "No more scattered links, PDFs, and half-finished profiles.",
    },
  ];

  return (
    <section
      ref={sectionRef}
      className="relative bg-black text-white min-h-screen overflow-hidden"
    >
      {/* Sticky layer wrapper */}
      <div className="sticky top-0 min-h-screen flex items-center">
        <div className="w-full max-w-[1440px] mx-auto px-5 py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
            {/* Left: Media / Video placeholder */}
            <div
              className={`relative transition-all duration-1000 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
            >
              <div className="aspect-[4/3] bg-[#1a1a1a] rounded-lg overflow-hidden relative border border-white/10">
                {/* Mock video preview */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-[#f4793a] flex items-center justify-center shadow-lg shadow-[#f4793a]/30">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="white"
                    >
                      <polygon points="8,5 19,12 8,19" />
                    </svg>
                  </div>
                </div>
                {/* Thumbnail pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#f4793a]/10 to-transparent" />
                <div className="absolute top-4 left-4 text-xs text-white/40">
                  How FOLLOW.ART works?
                </div>
              </div>
            </div>

            {/* Right: Content */}
            <div className="space-y-12">
              {/* Label */}
              <div className={`transition-all duration-700 delay-200 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}>
                <p className="text-[16px] text-white/60 tracking-[-0.03em] mb-2">
                  How FOLLOW.{" "}ART works?
                </p>
                <p className="text-section-label text-white uppercase tracking-[-0.03em]">
                  CURATORS AND ARTISTS
                </p>
              </div>

              {/* Giant heading */}
              <h2
                className={`text-huge text-white leading-[0.79] transition-all duration-1000 delay-300 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"
                }`}
                style={{ fontFamily: "var(--font-inter)", fontWeight: 900 }}
              >
                ARTISTS
              </h2>

              {/* Benefits list */}
              <div className={`space-y-6 transition-all duration-700 delay-500 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}>
                {benefits.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 group cursor-default">
                    <span className="text-[#f4793a] mt-1 text-lg">—</span>
                    <div>
                      <p className="text-[16px] font-medium text-white group-hover:text-[#f4793a] transition-colors">
                        {item.title}
                      </p>
                      <p className="text-[14px] text-white/40 mt-1 max-w-xs">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
