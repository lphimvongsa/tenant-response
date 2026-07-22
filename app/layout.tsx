import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TenaTimmy",
  description: "AI-powered tenant communication management",
  // Required for iOS to treat a home-screen install as a standalone app —
  // Web Push notifications only fire in that standalone context, not in a
  // regular Safari tab (see components/notifications/PushRegistration.tsx).
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TenaTimmy",
  },
};

export const viewport: Viewport = {
  themeColor: "#2a225c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
