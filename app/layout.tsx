import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://boston-apsa-2026.mingzran.chatgpt.site/"),
  manifest: "/manifest.webmanifest",
  applicationName: "Boston 2026 行程",
  appleWebApp: {
    capable: true,
    title: "Boston 2026",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  title: {
    default: "Boston 2026｜APSA 行程手冊",
    template: "%s｜Boston 2026",
  },
  description:
    "9/1–9/12 Boston APSA 旅程：逐日動線、租車小旅行、交通、餐飲與 New Balance 總部攻略。",
  openGraph: {
    title: "Boston 2026｜APSA 行程手冊",
    description: "從 Copley 出發，收好每一天的 Boston field notes。",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Boston 2026 APSA Field Notes" }],
    locale: "zh_TW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Boston 2026｜APSA 行程手冊",
    description: "逐日動線、租車、交通、餐飲與 New Balance 總部攻略。",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant-TW" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
