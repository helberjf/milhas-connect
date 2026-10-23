import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Milhas · Calculadora de viagens",
  description:
    "Calcule o custo dos seus pontos, compare emissões e planeje suas viagens com mais clareza.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
