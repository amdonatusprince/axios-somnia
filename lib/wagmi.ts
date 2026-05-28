import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { MEZO_RPC_URL } from '@/lib/constants'
import { mezoTestnet } from '@/lib/contracts'

/**
 * Browser-extension wallets only (MetaMask, Rabby, Coinbase extension, etc.).
 * No WalletConnect / Reown — avoids cloud.reown.com allowlists and indexedDB on WC.
 */
export const wagmiConfig = createConfig({
  chains: [mezoTestnet],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [mezoTestnet.id]: http(MEZO_RPC_URL),
  },
  ssr: false,
})

export { mezoTestnet }
