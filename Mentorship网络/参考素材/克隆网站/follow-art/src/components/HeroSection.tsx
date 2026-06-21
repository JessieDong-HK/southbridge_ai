"use client";

import { useEffect, useState, useRef } from "react";

const floatingIcons = [
  { emoji: "✦", size: 70, left: "10%", delay: 0, duration: 12 },
  { emoji: "⬡", size: 106, left: "80%", delay: 3, duration: 15 },
  { emoji: "☻", size: 105, left: "45%", delay: 6, duration: 13 },
  { emoji: "✿", size: 120, left: "25%", delay: 2, duration: 14 },
  { emoji: "↻", size: 120, left: "70%", delay: 5, duration: 16 },
  { emoji: "~", size: 225, left: "50%", delay: 1, duration: 18 },
];

export function HeroSection() {
  const [scrollY, setScrollY] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#f4793a] min-h-screen overflow-hidden"
    >
      {/* Floating decorative icons */}
      {floatingIcons.map((icon, i) => (
        <span
          key={i}
          className="absolute animate-float-up pointer-events-none select-none text-black/30"
          style={{
            fontSize: `${icon.size}px`,
            left: icon.left,
            top: "100vh",
            animationDelay: `${icon.delay}s`,
            animationDuration: `${icon.duration}s`,
            animationIterationCount: "infinite",
            animationTimingFunction: "linear",
            animationName: "float-up",
          }}
        >
          {icon.emoji}
        </span>
      ))}

      {/* Main content */}
      <div
        className="relative z-10 flex flex-col items-center justify-center min-h-screen px-5"
        style={{
          transform: `translateY(${scrollY * 0.1}px)`,
        }}
      >
        {/* Top label */}
        <p
          className="text-white text-[26px] tracking-[-0.03em] mb-8 opacity-0 animate-[fadeIn_1s_ease_0.3s_forwards]"
        >
          FOLLOW.ART
        </p>

        {/* Giant title */}
        <h1
          className="text-giant text-black leading-[0.78] text-center opacity-0 animate-[fadeIn_1.2s_ease_0.6s_forwards]"
          style={{ fontFamily: "var(--font-inter)", fontWeight: 900 }}
        >
          One Practice.
          <br />
          One Card
        </h1>

        {/* Subtitle with decorative line */}
        <div className="mt-16 flex items-center gap-4 opacity-0 animate-[fadeIn_1s_ease_0.9s_forwards]">
          <svg
            width="225"
            height="156"
            viewBox="0 0 225 156"
            className="text-black/50 hidden md:block"
          >
            <path
              d="M10,78 Q60,10 112,78 Q164,146 215,78"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <div className="text-center">
            <p className="text-[16px] text-white/80 tracking-[-0.03em] max-w-md">
              One Card. <br />
              Share it. Be noticed. <br />
              Be supported.
            </p>
          </div>
        </div>
      </div>

      {/* Scroll indicator at bottom */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <div className="w-6 h-10 border-2 border-black/30 rounded-full flex justify-center pt-2">
          <div className="w-1 h-2 bg-black/40 rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
}
