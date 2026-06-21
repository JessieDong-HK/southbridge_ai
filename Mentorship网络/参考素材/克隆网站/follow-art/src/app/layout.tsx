import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FOLLOW.ART | Digital Infrastructure for Curators & Artists",
  description:
    "Your portfolio, contacts, and direct support in one Card. Join 2.5K+ curators and artists across 100+ countries. Free to start. No algorithm.",
  icons: {
    icon: "/seo/favicon-96x96.png",
    apple: "/seo/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <head>
        {/* Load Inter from CDN as fallback */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
