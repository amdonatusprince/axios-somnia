'use client'

import * as React from 'react'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { wagmiConfig, somniaTestnet } from '@/lib/wagmi'

/**
 * WalletConnect uses indexedDB (browser-only). Next still pre-renders client components on
 * the Node server, which throws unless we mount Wagmi only after the client has hydrated.
 */
export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
        <p className="text-sm text-[var(--text-muted)]">Loading wallet…</p>
      </div>
    )
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider theme={darkTheme()} initialChain={somniaTestnet}>
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  )
}
