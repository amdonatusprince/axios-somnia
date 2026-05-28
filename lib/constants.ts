export const MEZO_CHAIN_ID = 31611
export const MEZO_RPC_URL = 'https://rpc.test.mezo.org'
export const MEZO_WS_URL = 'wss://rpc-ws.test.mezo.org'
export const MEZO_EXPLORER_URL = 'https://explorer.test.mezo.org'

/** MUSD on Mezo testnet — https://mezo.org/docs/users/resources/contracts-reference/ */
export const MUSD_ADDRESS = '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503'

/** ERC-20 `decimals()` for MUSD on Mezo (matches on-chain token). */
export const MUSD_DECIMALS = 18

/** Deployed ComplianceRegistry — set after `forge script` on Mezo testnet */
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

/** @deprecated Use MEZO_EXPLORER_URL */
export const TEMPO_EXPLORER_URL = MEZO_EXPLORER_URL
/** @deprecated Use MUSD_ADDRESS */
export const PATHUSD_ADDRESS = MUSD_ADDRESS
/** @deprecated Use COMPLIANCE_REGISTRY_ADDRESS */
export const TIP403_REGISTRY = COMPLIANCE_REGISTRY_ADDRESS
/** @deprecated Use MEZO_RPC_URL */
export const TEMPO_RPC_URL = MEZO_RPC_URL
/** @deprecated Use MEZO_CHAIN_ID */
export const TEMPO_CHAIN_ID = MEZO_CHAIN_ID
