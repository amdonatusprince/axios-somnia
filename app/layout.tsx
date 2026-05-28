import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { IBM_Plex_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { QueryClientProvider } from '@/components/providers/QueryClientProvider'
import { Toaster } from 'sonner'
import '@rainbow-me/rainbowkit/styles.css'
import './globals.css'

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://axios.xyz'),
  title: 'Payroll for the onchain era | Axios',
  description:
    'Enterprise payroll on Somnia testnet with sUSDC, ComplianceRegistry, and machine-payable MPP routes (x402 discovery). Bridge fiat, SIWE wallet wallets, and agent-ready treasury APIs.',
  openGraph: {
    title: 'Payroll for the onchain era | Axios',
    description:
      'Enterprise payroll on Somnia testnet with sUSDC, ComplianceRegistry, and machine-payable MPP routes (x402 discovery). Bridge fiat, SIWE wallet wallets, and agent-ready treasury APIs.',
    url: '/',
    siteName: 'Axios',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Axios — payroll on Somnia with sUSDC, MPP, and Bridge',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Payroll for the onchain era | Axios',
    description:
      'Enterprise payroll on Somnia testnet with sUSDC, ComplianceRegistry, and machine-payable MPP routes (x402 discovery). Bridge fiat, SIWE wallet wallets, and agent-ready treasury APIs.',
    images: ['/twitter-image'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={GeistSans.variable}
      suppressHydrationWarning
    >
      <body className={`${ibmPlexMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <QueryClientProvider>
          <ThemeProvider>
            {children}
            <Toaster
              position="bottom-right"
              duration={4000}
              toastOptions={{
                style: {
                  background: 'var(--bg-overlay)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                },
              }}
            />
          </ThemeProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}
