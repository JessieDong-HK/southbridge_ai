"use client";

import { useRef, useEffect, useState } from "react";

const features = [
  {
    label: "Search",
    desc: "Filter by discipline, location, medium, and more.",
  },
  {
    label: "Discover",
    desc: "Find curators and artists beyond your immediate network.",
  },
  {
    label: "Connect",
    desc: "Reach out directly. No algorithms, no gatekeepers.",
  },
  {
    label: "Grow",
    desc: "Build relationships that advance your practice.",
  },
];

export function ConnectorySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative bg-white min-h-screen overflow-hidden"
    >
      <div className="sticky top-0 min-h-screen flex items-center">
        <div className="w-full max-w-[1440px] mx-auto px-5 py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            {/* Left: Title */}
            <div>
              <p className="text-[16px] text-gray-400 tracking-[-0.03em] mb-2">
                Discover Others &amp; Get Discovered
              </p>
              <p className="text-section-label text-gray-600 tracking-[-0.03em] mb-4">
                Connectory
              </p>
              <h2
                className="text-huge text-black leading-[0.79] mb-8"
                style={{ fontFamily: "var(--font-inter)", fontWeight: 900 }}
              >
                Connectory
              </h2>
              <p
                className={`text-[16px] text-gray-600 leading-relaxed max-w-md mb-8 transition-all duration-700 delay-300 ${
                  isVisible ? "opacity-100" : "opacity-0"
                }`}
              >
                A global searchable directory of curators and artists. Join 3K+
                members. Explore practices, find collaborators, and search
                beyond your usual circles. No algorithm.
              </p>
            </div>

            {/* Right: Feature grid */}
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-all duration-700 delay-500 ${
                isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-12"
              }`}
            >
              {features.map((feat, i) => (
                <div
                  key={feat.label}
                  className="bg-gray-50 rounded-xl p-6 hover:bg-[#f4793a]/5 transition-colors border border-transparent hover:border-[#f4793a]/20"
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <span className="text-[48px] font-bold text-[#f4793a]/20">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-[18px] font-semibold text-black mt-2">
                    {feat.label}
                  </h3>
                  <p className="text-[14px] text-gray-500 mt-1">
                    {feat.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
