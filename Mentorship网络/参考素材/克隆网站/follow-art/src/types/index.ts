export interface MenuLink {
  label: string;
  href: string;
  isCTA?: boolean;
}

export interface Testimonial {
  id: number;
  name: string;
  role: string;
  quote: string;
  avatar?: string;
}

export interface ArtistCard {
  id: number;
  name: string;
  role: "Artist" | "Curator";
  image?: string;
}

export interface FlipCardData {
  id: number;
  number: number;
  title: string;
  description: string;
}

export interface ButtonData {
  label: string;
  href: string;
  variant: "primary" | "secondary" | "outline" | "ghost";
  icon?: string;
}
