"use client";

import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { CentralizeSection } from "@/components/CentralizeSection";
import { CardShowcaseSection } from "@/components/CardShowcaseSection";
import { AudienceSupportSection } from "@/components/AudienceSupportSection";
import { ConnectorySection } from "@/components/ConnectorySection";
import { JoinUsSection } from "@/components/JoinUsSection";

export default function Home() {
  const [globalScrollY, setGlobalScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setGlobalScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="relative">
      <Header />

      {/* The site uses a "section stacking" pattern:
          Each section-wrapper creates a tall scroll space,
          and the actual visible section is position: sticky */}

      {/* Hero / Intro */}
      <HeroSection />

      {/* How It Works — black background */}
      <div className="relative" style={{ minHeight: "200vh" }}>
        <HowItWorksSection />
      </div>

      {/* Testimonials — sage green background */}
      <div className="relative" style={{ minHeight: "200vh" }}>
        <TestimonialsSection />
      </div>

      {/* Centralize — steel blue background */}
      <div className="relative" style={{ minHeight: "200vh" }}>
        <CentralizeSection />
      </div>

      {/* Card Showcase — rose background */}
      <div className="relative" style={{ minHeight: "200vh" }}>
        <CardShowcaseSection />
      </div>

      {/* Audience Support — white background */}
      <div className="relative" style={{ minHeight: "200vh" }}>
        <AudienceSupportSection />
      </div>

      {/* Connectory — white background */}
      <div className="relative" style={{ minHeight: "200vh" }}>
        <ConnectorySection />
      </div>

      {/* Join Us + Footer — orange background */}
      <div className="relative" style={{ minHeight: "200vh" }}>
        <JoinUsSection />
      </div>
    </main>
  );
}
