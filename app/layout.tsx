import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Deadlift.ai",
  description: "AI-driven powerlifting periodization and meet prep. Frictionless, distraction-free.",
};

export const viewport: Viewport = {
  themeColor: "#1d1c24", // matches our deep dark blue/purple tint
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
      <body className="min-h-screen">
        <AuthProvider>
          <main className="relative w-full min-h-screen overflow-x-hidden">
            {children}
          </main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
