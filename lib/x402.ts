import { SOMNIA_CHAIN_ID, SUSDC_ADDRESS } from '@/lib/constants'

/**
 * x402 payment configuration for Axios on Somnia testnet.
 * Route handlers currently use a no-op {@link '@/lib/mpp' | mppx} shim; this object
 * feeds discovery (`/.well-known/x402`) and future `@x402/fetch` client wiring.
 */
export const x402PaymentConfig = {
  chainId: SOMNIA_CHAIN_ID,
  asset: SUSDC_ADDRESS,
  scheme: 'exact' as const,
  treasuryEnvKey: 'AXIOS_TREASURY_ADDRESS' as const,
}

export function getAxiosTreasuryAddress(): `0x${string}` | undefined {
  const raw = process.env.AXIOS_TREASURY_ADDRESS ?? process.env.REMLO_TREASURY_ADDRESS
  if (!raw || !raw.startsWith('0x')) return undefined
  return raw as `0x${string}`
}
