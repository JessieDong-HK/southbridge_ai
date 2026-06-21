"use client";

import { useRef, useEffect, useState } from "react";
import type { ArtistCard } from "@/types";

const artists: ArtistCard[] = [
  { id: 1, name: "Teona Toderel", role: "Artist" },
  { id: 2, name: "Erin J Coholan", role: "Artist" },
  { id: 3, name: "Baimba Kamara", role: "Curator" },
  { id: 4, name: "Alberto Balocca", role: "Artist" },
  { id: 5, name: "Thomas Oosterhof", role: "Curator" },
  { id: 6, name: "Isabela Galeano", role: "Curator" },
  { id: 7, name: "Danny Van der Elst", role: "Artist" },
  { id: 8, name: "Sophie Wratzfeld", role: "Curator" },
  { id: 9, name: "Farouk Alao", role: "Artist" },
  { id: 10, name: "Keita Melle", role: "Artist" },
];

// Duplicate for seamless loop
const loopArtists = [...artists, ...artists];

export function AudienceSupportSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

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
      <div className="sticky top-0 min-h-screen flex flex-col justify-center">
        <div className="w-full max-w-[1440px] mx-auto px-5 py-24">
          {/* Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-end mb-16">
            <div>
              <p className="text-[16px] text-gray-400 tracking-[-0.03em] mb-2">
                Audience Support
              </p>
              <h2
                className="text-huge text-black leading-[0.79]"
                style={{ fontFamily: "var(--font-inter)", fontWeight: 900 }}
              >
                Audience
                <br />
                Support
              </h2>
            </div>
            <div
              className={`transition-all duration-700 delay-300 ${
                isVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <p className="text-[16px] text-gray-600 leading-relaxed mb-6">
                Already, hundreds have financially supported curators and
                artists through FOLLOW.ART Cards. Support the creators you
                believe in — directly, instantly, transparently.
              </p>
              <button className="px-6 py-3 bg-[#f4793a] text-white rounded-full text-[14px] font-medium hover:bg-[#e06a2e] transition-colors">
                Learn More
              </button>
            </div>
          </div>

          {/* Auto-looping carousel */}
          <div
            className="relative overflow-hidden py-4"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <div
              className="flex gap-4"
              style={{
                animation: `scroll-carousel 25s linear infinite`,
                animationPlayState: isPaused ? "paused" : "running",
                width: "max-content",
              }}
            >
              {loopArtists.map((artist, i) => (
                <div
                  key={`${artist.id}-${i}`}
                  className="flex-shrink-0 w-[180px] h-[180px] rounded-xl overflow-hidden relative group cursor-pointer"
                >
                  {/* Gradient background per card */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        i % 4 === 0
                          ? "linear-gradient(135deg, #f4793a, #ff9a6c)"
                          : i % 4 === 1
                            ? "linear-gradient(135deg, #8e9487, #b0b8a8)"
                            : i % 4 === 2
                              ? "linear-gradient(135deg, #8498ac, #a8bccf)"
                              : "linear-gradient(135deg, #c5939d, #e0b8c0)",
                    }}
                  />
                  {/* Initials avatar */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[32px] font-bold text-white/80">
                      {artist.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  {/* Name overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                    <p className="text-white text-[14px] font-medium">
                      {artist.name}
                    </p>
                    <p className="text-white/70 text-[12px]">{artist.role}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Gradient fades on edges */}
            <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
}
