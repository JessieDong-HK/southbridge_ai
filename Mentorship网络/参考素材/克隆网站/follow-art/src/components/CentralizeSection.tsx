"use client";

import { useRef, useEffect, useState } from "react";
import type { FlipCardData } from "@/types";

const flipCards: FlipCardData[] = [
  {
    id: 1,
    number: 1,
    title: "Professional presentation",
    description:
      "Portfolio, biography, experience, links and contacts in one place",
  },
  {
    id: 2,
    number: 2,
    title: "Financial support",
    description:
      "Let people financially support your practice, instantly",
  },
  {
    id: 3,
    number: 3,
    title: "Instant sharing",
    description:
      "Use a link, QR code or Wallet pass during events and meetings",
  },
  {
    id: 4,
    number: 4,
    title: "Better discovery",
    description:
      "Be searchable through Connectory without algorithms or closed circles",
  },
];

function FlipCard({ card, index }: { card: FlipCardData; index: number }) {
  return (
    <div
      className="flip-card w-[280px] h-[200px] cursor-pointer select-none"
      style={{
        perspective: "1000px",
        animationDelay: `${index * 0.1}s`,
      }}
    >
      <div className="flip-card-inner relative w-full h-full transition-transform duration-600 ease-[cubic-bezier(0.4,0,0.2,1)] [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
        {/* Front */}
        <div
          className="flip-card-front absolute inset-0 bg-white rounded-xl border border-gray-100 p-6 flex flex-col justify-between"
          style={{ backfaceVisibility: "hidden" }}
        >
          <span className="text-[#f4793a] text-[48px] font-bold leading-none">
            {card.number}
          </span>
          <h3 className="text-[20px] font-bold text-black">
            {card.title}
          </h3>
        </div>
        {/* Back */}
        <div
          className="flip-card-back absolute inset-0 bg-[#f4793a] rounded-xl p-6 flex items-center"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div>
            <span className="text-white/60 text-[14px]">{card.number}</span>
            <p className="text-white text-[18px] font-medium mt-2 leading-snug">
              {card.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CentralizeSection() {
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
      className="relative bg-[#8498ac] min-h-screen overflow-hidden"
    >
      <div className="sticky top-0 min-h-screen flex items-center">
        <div className="w-full max-w-[1440px] mx-auto px-5 py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-start">
            {/* Left: Title */}
            <div>
              <p className="text-[16px] text-white/60 tracking-[-0.03em] mb-2">
                CENTRALIZE
              </p>
              <h2
                className="text-huge text-black leading-[0.79] flex flex-wrap"
                style={{ fontFamily: "var(--font-inter)", fontWeight: 900 }}
              >
                <span>CENTRA</span>
                <span>LIZE</span>
              </h2>
              <p
                className={`text-[16px] text-white/80 mt-8 max-w-md leading-relaxed transition-all duration-700 delay-300 ${
                  isVisible ? "opacity-100" : "opacity-0"
                }`}
              >
                No more scattered links, PDFs, and half-finished profiles. Have
                your work together in one clear format.
              </p>
            </div>

            {/* Right: Flip Cards */}
            <div
              className={`flex flex-col gap-4 transition-all duration-700 delay-500 ${
                isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
              }`}
            >
              {flipCards.map((card, i) => (
                <div key={card.id} className="group">
                  <FlipCard card={card} index={i} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
