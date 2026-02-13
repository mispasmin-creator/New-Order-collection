import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'Order2Delivery System',
  description: 'Management dashboard for orders and deliveries',
  icons: {
    icon: '/passary.jpeg',
    apple: '/passary.jpeg',
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