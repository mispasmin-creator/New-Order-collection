import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
// @ts-ignore: allow importing global CSS without type declarations
import './globals.css'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'New Order To Collection APP',
  description: 'Management dashboard for orders and deliveries',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={GeistSans.className}>
        <AuthProvider>
          {children}
          <Analytics />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}