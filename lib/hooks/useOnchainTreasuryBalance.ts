'use client'

import { useQuery, type QueryClient } from '@tanstack/react-query'
import { encodePacked, keccak256 } from 'viem'
import { publicClient } from '@/lib/contracts'
import { PAYROLL_TREASURY_ADDRESS } from '@/lib/constants'
import { PayrollTreasuryABI } from '@/lib/abis/PayrollTreasury'

function employerAccountId(signer: `0x${string}`): `0x${string}` {
  return keccak256(encodePacked(['address'], [signer]))
}

async function fetchOnchainTreasuryBalances(wallet: `0x${string}`) {
  const id = employerAccountId(wallet)
  const [available, locked] = await Promise.all([
    publicClient.readContract({
      address: PAYROLL_TREASURY_ADDRESS,
      abi: PayrollTreasuryABI,
      functionName: 'getAvailableBalance',
      args: [id],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: PAYROLL_TREASURY_ADDRESS,
      abi: PayrollTreasuryABI,
      functionName: 'getLockedBalance',
      args: [id],
    }) as Promise<bigint>,
  ])
  return { available, locked }
}

export function useOnchainTreasuryBalance(wallet: `0x${string}` | null | undefined) {
  return useQuery({
    queryKey: ['onchain-treasury', wallet?.toLowerCase() ?? ''],
    queryFn: () => fetchOnchainTreasuryBalances(wallet!),
    enabled: Boolean(wallet),
  })
}

/** Refetch API treasury totals and on-chain available/locked for the connected wallet. */
export async function refreshTreasuryBalances(
  queryClient: QueryClient,
  opts?: { employerId?: string },
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['treasury'] }),
    queryClient.invalidateQueries({ queryKey: ['onchain-treasury'] }),
  ])
  await Promise.all([
    queryClient.refetchQueries({ queryKey: ['onchain-treasury'], type: 'active' }),
    opts?.employerId
      ? queryClient.refetchQueries({ queryKey: ['treasury', opts.employerId], type: 'active' })
      : queryClient.refetchQueries({ queryKey: ['treasury'], type: 'active' }),
  ])
}
