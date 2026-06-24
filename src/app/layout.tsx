import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Nav from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Six Spur Ranch and Rescue',
  description: 'A 501(c)(3) nonprofit animal rescue and sanctuary in Texas. Rescuing dogs and caring for farm animals.',
  keywords: ['dog rescue', 'animal rescue', 'Texas rescue', 'adopt a dog', 'farm animal sanctuary'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
