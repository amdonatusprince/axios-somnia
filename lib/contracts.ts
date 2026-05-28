import { createPublicClient, createWalletClient, http, getContract, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  MEZO_RPC_URL,
  MEZO_CHAIN_ID,
  MUSD_ADDRESS,
  COMPLIANCE_REGISTRY_ADDRESS,
  PAYROLL_TREASURY_ADDRESS,
  PAYROLL_BATCHER_ADDRESS,
  EMPLOYEE_REGISTRY_ADDRESS,
  STREAM_VESTING_ADDRESS,
  YIELD_ROUTER_ADDRESS,
} from '@/lib/constants'
import { PayrollTreasuryABI } from '@/lib/abis/PayrollTreasury'
import { PayrollBatcherABI } from '@/lib/abis/PayrollBatcher'
import { EmployeeRegistryABI } from '@/lib/abis/EmployeeRegistry'
import { StreamVestingABI } from '@/lib/abis/StreamVesting'
import { YieldRouterABI } from '@/lib/abis/YieldRouter'
import { ComplianceRegistryABI } from '@/lib/abis/ComplianceRegistry'

const Erc20BalanceAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
] as const

export const mezoTestnet = defineChain({
  id: MEZO_CHAIN_ID,
  name: 'Mezo Testnet',
  nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
  rpcUrls: { default: { http: [MEZO_RPC_URL] } },
  blockExplorers: { default: { name: 'Mezo Explorer', url: 'https://explorer.test.mezo.org' } },
})

export const mezoTransport = http(MEZO_RPC_URL)

export const publicClient = createPublicClient({
  transport: mezoTransport,
  chain: mezoTestnet,
})

/**
 * Reads `AXIOS_AGENT_PRIVATE_KEY` or `REMLO_AGENT_PRIVATE_KEY` from the environment.
 * Accepts `0x` + 64 hex chars, or 64 hex chars without prefix (common in .env files).
 */
export function getAgentPrivateKeyFromEnv(): `0x${string}` | null {
  const raw = process.env.AXIOS_AGENT_PRIVATE_KEY ?? process.env.REMLO_AGENT_PRIVATE_KEY
  if (!raw || typeof raw !== 'string') return null
  let t = raw.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim()
  }
  if (/^0x[0-9a-fA-F]{64}$/i.test(t)) {
    return t as `0x${string}`
  }
  if (/^[0-9a-fA-F]{64}$/i.test(t)) {
    return `0x${t}` as `0x${string}`
  }
  return null
}

/**
 * Returns a wallet client for the given private key.
 * Used in server-side route handlers only — never expose private keys to client.
 */
export function getServerWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey)
  return createWalletClient({
    account,
    transport: mezoTransport,
    chain: publicClient.chain,
  })
}

export const treasury = getContract({
  address: PAYROLL_TREASURY_ADDRESS,
  abi: PayrollTreasuryABI,
  client: publicClient,
})

export const musdToken = getContract({
  address: MUSD_ADDRESS as `0x${string}`,
  abi: Erc20BalanceAbi,
  client: publicClient,
})

/** @deprecated Use musdToken */
export const pathUsdToken = musdToken

export const payrollBatcher = getContract({
  address: PAYROLL_BATCHER_ADDRESS,
  abi: PayrollBatcherABI,
  client: publicClient,
})

export const employeeRegistry = getContract({
  address: EMPLOYEE_REGISTRY_ADDRESS,
  abi: EmployeeRegistryABI,
  client: publicClient,
})

export const streamVesting = getContract({
  address: STREAM_VESTING_ADDRESS,
  abi: StreamVestingABI,
  client: publicClient,
})

export const yieldRouter = getContract({
  address: YIELD_ROUTER_ADDRESS,
  abi: YieldRouterABI,
  client: publicClient,
})

export const complianceRegistry = getContract({
  address: COMPLIANCE_REGISTRY_ADDRESS,
  abi: ComplianceRegistryABI,
  client: publicClient,
})

/** @deprecated Use complianceRegistry */
export const tip403Registry = complianceRegistry
