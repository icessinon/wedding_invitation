import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ProductProvider } from "@/lib/contexts/ProductContext"
import AppShell from "@/components/layout/AppShell"

const inter = Inter({
    subsets: ["latin"],
    preload: false,
})

export const metadata: Metadata = {
    title: "GA4 Analytics Dashboard",
    description: "GA4 Analytics Dashboard - ABテスト、ファネル、ヒートマップ分析",
    icons: {
        icon: "/icon.png",
        apple: "/apple-icon.png",
    },
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="ja" data-theme="dark">
            <body className={inter.className}>
                <ProductProvider>
                    <AppShell>{children}</AppShell>
                </ProductProvider>
            </body>
        </html>
    )
}
