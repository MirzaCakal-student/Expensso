import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display-face", subsets: ["latin"] });
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Expensso",
  description: "Track what comes in and where it goes.",
};

export const viewport: Viewport = {
  themeColor: "#10262b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT && (
          <Script
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
          />
        )}
      </body>
    </html>
  );
}
