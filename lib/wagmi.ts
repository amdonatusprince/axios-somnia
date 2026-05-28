import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { SOMNIA_RPC_URL } from '@/lib/constants'
import { somniaTestnet } from '@/lib/contracts'

/**
 * Browser-extension wallets only (MetaMask, Rabby, Coinbase extension, etc.).
 * No WalletConnect / Reown — avoids cloud.reown.com allowlists and indexedDB on WC.
 */
export const wagmiConfig = createConfig({
  chains: [somniaTestnet],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [somniaTestnet.id]: http(SOMNIA_RPC_URL),
  },
  ssr: false,
})

export { somniaTestnet }
