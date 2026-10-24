import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// One family for headings and UI; headings get their character from weight and tight tracking.
const schibsted = Schibsted_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Hamsterrad Maxxing", template: "%s · Hamsterrad Maxxing" },
  description: "Bereite dich mit Mock-Interviews und einem passgenauen Lebenslauf auf deine Bewerbung vor.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${schibsted.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
        <Toaster theme="light" position="top-center" />
      </body>
    </html>
  );
}
