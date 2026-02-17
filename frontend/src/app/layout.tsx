import type { Metadata } from "next"
import { JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Navbar } from "@/components/navbar"

const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-jetbrains-mono"
})

export const metadata: Metadata = {
    title: "PREV.IA — Fiscal Compliance Screening",
    description: "Autonomous fiscal compliance screening agent for Mexican tax regulations",
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es" className={jetbrainsMono.variable}>
            <body className="min-h-screen bg-previa-background">
                {children}
            </body>
        </html>
    )
}
