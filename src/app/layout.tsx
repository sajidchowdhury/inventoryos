import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InventoryOS — A Collection of Inventory Systems",
  description:
    "Simple, powerful inventory management for pharmacies, grocery shops, restaurants, and more. Built for Bangladeshi businesses, designed for everyone.",
  keywords: [
    "inventory",
    "pharmacy",
    "grocery",
    "restaurant",
    "Bangladesh",
    "stock management",
    "InventoryOS",
  ],
  authors: [{ name: "InventoryOS Team" }],
  openGraph: {
    title: "InventoryOS",
    description: "Simple inventory management for every business type",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
