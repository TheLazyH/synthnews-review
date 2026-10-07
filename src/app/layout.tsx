import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import GlobalLoader from "@/components/global-loader";
import ReadingControls from "@/components/reading-controls";
import SiteHeader from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SynthNews",
  robots: { index: false, follow: false },
};

const PREFS_SCRIPT = `try{var s=localStorage.getItem("textScale");if(s)document.documentElement.style.fontSize=s+"%";}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-muted/50 text-foreground antialiased`}
      >
        <SiteHeader />
        {children}
        <ReadingControls />
        <GlobalLoader />
        <Analytics />
      </body>
    </html>
  );
}
