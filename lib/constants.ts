export const SOMNIA_CHAIN_ID = 50312
export const SOMNIA_RPC_URL = 'https://dream-rpc.somnia.network/'
export const SOMNIA_EXPLORER_URL = 'https://shannon-explorer.somnia.network'

/** Mock USDC on Somnia testnet — deployed via `forge script` (6 decimals). */
export const SUSDC_ADDRESS = (process.env.NEXT_PUBLIC_SUSDC_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`

/** ERC-20 `decimals()` for sUSDC (matches on-chain token). */
export const SUSDC_DECIMALS = 6

/** Deployed ComplianceRegistry — set after `forge script` on Somnia testnet */
export const COMPLIANCE_REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_COMPLIANCE_REGISTRY ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`

export const PAYROLL_TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_PAYROLL_TREASURY ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`
export const PAYROLL_BATCHER_ADDRESS = (process.env.NEXT_PUBLIC_PAYROLL_BATCHER ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`
export const EMPLOYEE_REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_EMPLOYEE_REGISTRY ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`
export const STREAM_VESTING_ADDRESS = (process.env.NEXT_PUBLIC_STREAM_VESTING ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`
export const YIELD_ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_YIELD_ROUTER ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`

/** @deprecated Use SOMNIA_EXPLORER_URL */
export const TEMPO_EXPLORER_URL = SOMNIA_EXPLORER_URL
/** @deprecated Use COMPLIANCE_REGISTRY_ADDRESS */
export const TIP403_REGISTRY = COMPLIANCE_REGISTRY_ADDRESS
/** @deprecated Use SOMNIA_RPC_URL */
export const TEMPO_RPC_URL = SOMNIA_RPC_URL
/** @deprecated Use SOMNIA_CHAIN_ID */
export const TEMPO_CHAIN_ID = SOMNIA_CHAIN_ID
