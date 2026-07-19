import type { Metadata } from "next";
import { Dancing_Script, Shippori_Mincho } from "next/font/google";
import "./globals.css";
import { LineExternalBrowser } from "../components/LineExternalBrowser";

const dancingScript = Dancing_Script({
  variable: "--font-dancing-script",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const shipporiMincho = Shippori_Mincho({
  variable: "--font-serif-jp",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Wedding Thanks | Takeshi & Natsumi",
  description: "結婚式にご列席いただきありがとうございました。当日の写真の共有・ダウンロードができます。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${dancingScript.variable} ${shipporiMincho.variable} antialiased`}
      >
        <LineExternalBrowser />
        {children}
      </body>
    </html>
  );
}
