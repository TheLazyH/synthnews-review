import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ReadingControls from "@/components/reading-controls";
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
  title: "SynthNews Review",
  robots: { index: false, follow: false },
};

const PREFS_SCRIPT = `try{var t=localStorage.getItem("theme");var d=t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);var s=localStorage.getItem("textScale");if(s)document.documentElement.style.fontSize=s+"%";}catch(e){}`;

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
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-muted/50 text-foreground antialiased`}
      >
        {children}
        <ReadingControls />
      </body>
    </html>
  );
}