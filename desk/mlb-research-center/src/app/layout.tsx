import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/layout/sidebar"
import { TopBar } from "@/components/layout/top-bar"
import { ClientToaster } from "@/components/layout/client-toaster"
import { SidebarProvider } from "@/components/layout/sidebar-context"
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts"
import { ShortcutsModal } from "@/components/ui/shortcuts-modal"
import { ShortcutsProvider } from "@/components/layout/shortcuts-context"
import { DemoModeBanner } from "@/components/layout/demo-banner"
import { NavigationProgress } from "@/components/layout/navigation-progress"
import { PWARegister } from "@/components/pwa-register"
import { ThemeProvider } from "@/components/theme-provider"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "MLB Research Command Center",
  description: "All-day MLB research dashboard monitoring rosters, transactions, injuries, lineups, and news",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "theme-color": "#1a1a2e",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="h-full flex bg-background text-foreground">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-3 focus:bg-background focus:text-foreground focus:border focus:border-border">
          Skip to content
        </a>
        <ThemeProvider>
          <SidebarProvider>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <TopBar />
              <DemoModeBanner />
              <main id="main-content" className="flex-1 overflow-auto p-4 lg:p-6 page-enter">
                {children}
              </main>
            </div>
          </SidebarProvider>
          <ShortcutsProvider>
          <KeyboardShortcuts />
          <NavigationProgress />
          <ShortcutsModal />
          <ClientToaster />
          <PWARegister />
        </ShortcutsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
