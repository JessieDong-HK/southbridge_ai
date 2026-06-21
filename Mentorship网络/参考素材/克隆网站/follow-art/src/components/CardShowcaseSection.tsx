"use client";

import { useRef, useEffect, useState } from "react";

const showcaseButtons = [
  { label: "Portfolio", icon: "◉" },
  { label: "Biography", icon: "☰" },
  { label: "Links", icon: "↗" },
  { label: "Experience", icon: "◈" },
  { label: "Contacts", icon: "✉" },
  { label: "Support", icon: "♥" },
];

export function CardShowcaseSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = sectionRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({
        x: (e.clientX - rect.left) / rect.width - 0.5,
        y: (e.clientY - rect.top) / rect.height - 0.5,
      });
    }
  };

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#c5939d] min-h-screen overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      <div className="sticky top-0 min-h-screen flex items-center">
        <div className="w-full max-w-[1440px] mx-auto px-5 py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            {/* Left: WebGL-style card mockup */}
            <div
              className={`relative transition-all duration-1000 ${
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
              }`}
            >
              {/* Animated card */}
              <div
                className="relative aspect-[4/3] max-w-md mx-auto"
                style={{
                  transform: `perspective(1000px) rotateY(${mousePos.x * 8}deg) rotateX(${-mousePos.y * 8}deg)`,
                  transition: "transform 0.2s ease-out",
                }}
              >
                {/* Card body */}
                <div className="absolute inset-0 bg-white rounded-2xl shadow-2xl p-8 flex flex-col justify-between overflow-hidden">
                  {/* Decorative WebGL-like pattern */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#f4793a] rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#c5939d] rounded-full blur-3xl" />
                  </div>

                  {/* Card content */}
                  <div className="relative">
                    <div className="text-[12px] text-gray-400 uppercase tracking-widest mb-6">
                      Your Practice Card
                    </div>
                    <div className="w-12 h-12 rounded-full bg-[#f4793a] mb-6 flex items-center justify-center">
                      <span className="text-white text-lg">♠</span>
                    </div>
                    <h3 className="text-[24px] font-bold text-black leading-tight">
                      Your practice,
                      <br />
                      all in one place
                    </h3>
                  </div>

                  <div className="relative">
                    <div className="flex gap-2 flex-wrap">
                      {["Portfolio", "Bio", "Links", "Support"].map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 text-[11px] bg-gray-50 rounded-full text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Floating decorative dots */}
                <div className="absolute -top-4 -right-4 w-8 h-8 bg-[#f4793a] rounded-full animate-pulse" />
                <div className="absolute -bottom-6 -left-6 w-12 h-12 border-2 border-white/20 rounded-full" />
              </div>
            </div>

            {/* Right: Content */}
            <div>
              <p
                className={`text-[16px] text-white/60 tracking-[-0.03em] mb-2 transition-all duration-700 delay-200 ${
                  isVisible ? "opacity-100" : "opacity-0"
                }`}
              >
                card
              </p>
              <h2
                className="text-huge text-black leading-[0.79] mb-8"
                style={{ fontFamily: "var(--font-inter)", fontWeight: 900 }}
              >
                card
              </h2>
              <p
                className={`text-[18px] text-white/80 leading-relaxed mb-12 max-w-md transition-all duration-700 delay-400 ${
                  isVisible ? "opacity-100" : "opacity-0"
                }`}
              >
                A digital Card that brings everything together. Easy for you to
                share. Easy for others to discover, support, and remember.
              </p>

              {/* Button grid */}
              <div
                className={`grid grid-cols-2 sm:grid-cols-3 gap-3 transition-all duration-700 delay-600 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
              >
                {showcaseButtons.map((btn) => (
                  <button
                    key={btn.label}
                    className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white text-[13px] transition-all hover:scale-105 border border-white/10"
                  >
                    <span>{btn.icon}</span>
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
