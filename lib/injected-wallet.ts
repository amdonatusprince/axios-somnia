import { createWalletClient, custom, type EIP1193Provider, type Hash, type Hex } from 'viem'
import { somniaTestnet } from '@/lib/contracts'

type InjectedTx = {
  account: `0x${string}`
  to: `0x${string}`
  data: Hex
  chainId?: number
}

function getInjectedProvider(): EIP1193Provider | null {
  if (typeof window === 'undefined') return null
  const eth = (window as Window & { ethereum?: EIP1193Provider }).ethereum
  return eth ?? null
}

/** Send a contract call via the browser wallet (MetaMask, Rabby, etc.). */
export async function sendInjectedTransaction({
  account,
  to,
  data,
  chainId = somniaTestnet.id,
}: InjectedTx): Promise<Hash> {
  const provider = getInjectedProvider()
  if (!provider) {
    throw new Error('No wallet extension found. Install MetaMask or Rabby and connect.')
  }

  const chainHex = `0x${chainId.toString(16)}` as Hex
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainHex }],
    })
  } catch (switchErr: unknown) {
    const code = (switchErr as { code?: number })?.code
    if (code !== 4902) throw switchErr
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: chainHex,
          chainName: somniaTestnet.name,
          nativeCurrency: somniaTestnet.nativeCurrency,
          rpcUrls: somniaTestnet.rpcUrls.default.http,
          blockExplorerUrls: somniaTestnet.blockExplorers?.default?.url
            ? [somniaTestnet.blockExplorers.default.url]
            : undefined,
        },
      ],
    })
  }

  const client = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: custom(provider),
  })

  return client.sendTransaction({
    account,
    chain: somniaTestnet,
    to,
    data,
  })
}
