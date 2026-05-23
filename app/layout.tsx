import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwRegister from "@/components/mobile/SwRegister";

export const metadata: Metadata = {
  title: "Night Order",
  description: "Gestion des commandes fournisseurs",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Night Order",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#596643",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className="min-h-full bg-[#111111]">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
