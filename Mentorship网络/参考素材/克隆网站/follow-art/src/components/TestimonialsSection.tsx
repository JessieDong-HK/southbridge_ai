"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Testimonial } from "@/types";

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Teona Toderel",
    role: "Artist",
    quote:
      "FOLLOW.ART gives me a space where my practice feels whole. The direct support feature has been a game-changer for sustaining my work.",
  },
  {
    id: 2,
    name: "Erin J Coholan",
    role: "Artist",
    quote:
      "Having everything in one Card made my interactions with curators so much smoother. No more scattered links.",
  },
  {
    id: 3,
    name: "Baimba Kamara",
    role: "Curator",
    quote:
      "As a curator, finding artists through Connectory has completely changed how I discover new talent. It's the tool I always wished existed.",
  },
  {
    id: 4,
    name: "Alberto Balocca",
    role: "Artist",
    quote:
      "The community on FOLLOW.ART is unlike anything else. Real connections, real support, real growth.",
  },
  {
    id: 5,
    name: "Thomas Oosterhof",
    role: "Curator",
    quote:
      "I've met more serious artists through FOLLOW.ART in 3 months than in 2 years on traditional platforms.",
  },
];

export function TestimonialsSection() {
  const [current, setCurrent] = useState(0);
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

  const maxIndex = testimonials.length - 1;

  const goNext = () => setCurrent((p) => (p < maxIndex ? p + 1 : 0));
  const goPrev = () => setCurrent((p) => (p > 0 ? p - 1 : maxIndex));

  // Auto-advance
  useEffect(() => {
    if (!isVisible) return;
    const timer = setInterval(goNext, 5000);
    return () => clearInterval(timer);
  }, [isVisible]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#8e9487] min-h-screen overflow-hidden"
    >
      <div className="sticky top-0 min-h-screen flex items-center">
        <div className="w-full max-w-[1440px] mx-auto px-5 py-24">
          {/* Header */}
          <div className="mb-16 md:mb-24">
            <p className="text-[16px] text-white/60 tracking-[-0.03em] mb-2">
              Our Members Say
            </p>
            <p className="text-section-label text-white uppercase tracking-[-0.03em] mb-4">
              Testimonials
            </p>
            <h2
              className="text-huge text-black leading-[0.79]"
              style={{ fontFamily: "var(--font-inter)", fontWeight: 900 }}
            >
              Testimonials
            </h2>
          </div>

          {/* Testimonial Card */}
          <div
            className={`max-w-2xl transition-all duration-700 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"
            }`}
          >
            <div className="relative bg-white rounded-2xl p-8 md:p-12 shadow-xl min-h-[320px]">
              {/* Navigation */}
              <div className="flex gap-3 mb-8">
                <button
                  onClick={goPrev}
                  className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  aria-label="Previous testimonial"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={goNext}
                  className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors"
                  aria-label="Next testimonial"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Quote */}
              <blockquote className="text-[18px] md:text-[22px] leading-relaxed text-black mb-8 font-medium">
                &ldquo;{testimonials[current].quote}&rdquo;
              </blockquote>

              {/* Author */}
              <div>
                <p className="text-[16px] font-semibold text-black">
                  {testimonials[current].name}
                </p>
                <p className="text-[14px] text-gray-500">
                  {testimonials[current].role}
                </p>
              </div>

              {/* Progress dots */}
              <div className="absolute bottom-8 right-8 md:right-12 flex gap-2">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === current ? "bg-[#f4793a] w-6" : "bg-gray-300"
                    }`}
                    aria-label={`Go to testimonial ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
