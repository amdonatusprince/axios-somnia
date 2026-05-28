'use client'

import { useQuery } from '@tanstack/react-query'
import type { Database } from '@/lib/database.types'
import { usePrivyAuthedJson } from '@/lib/hooks/usePrivyAuthedFetch'
import { useAuthedApiEnabled } from '@/lib/hooks/useAuthedApiEnabled'

type Employee = Database['public']['Tables']['employees']['Row']

export function useEmployee() {
  const authed = useAuthedApiEnabled()
  const fetchJson = usePrivyAuthedJson()

  return useQuery<Employee | null>({
    queryKey: ['me-employee'],
    queryFn: async () => {
      try {
        return await fetchJson<Employee>('/api/me/employee')
      } catch {
        return null
      }
    },
    enabled: authed,
    staleTime: 60_000,
  })
}

export interface PaymentWithRun {
  id: string
  amount: number
  memo_bytes: string | null
  memo_decoded: unknown
  status: string
  tx_hash: string | null
  created_at: string
  employer_company_name?: string | null
  payroll_run: {
    id: string
    employer_id?: string
    finalized_at: string | null
    settlement_time_ms: number | null
    block_number: number | null
  } | null
}

export function useEmployeePayments(_employeeId: string | undefined, limit = 20) {
  const authed = useAuthedApiEnabled()
  const fetchJson = usePrivyAuthedJson()

  return useQuery<PaymentWithRun[]>({
    queryKey: ['me-payments', limit],
    queryFn: () => fetchJson<PaymentWithRun[]>(`/api/me/payments?limit=${limit}`),
    enabled: authed,
    staleTime: 30_000,
  })
}

export function useEmployerForEmployee(employerId: string | undefined) {
  return useQuery<{ company_name: string } | null>({
    queryKey: ['employer-name', employerId],
    queryFn: async () => {
      if (!employerId) return null
      const res = await fetch(`/api/employers/${employerId}/name`)
      if (!res.ok) return null
      return res.json() as Promise<{ company_name: string }>
    },
    enabled: Boolean(employerId),
    staleTime: 300_000,
  })
}

/** On-chain PayrollTreasury snapshot for the employee’s employer (read-only). */
export interface EmployerTreasurySnapshot {
  employer_id: string
  company_name: string | null
  available_usd: number
  locked_usd: number
  total_usd: number
  available_raw: string
  locked_raw: string
}

export function useEmployerTreasurySnapshot(employeeId: string | undefined) {
  const authed = useAuthedApiEnabled()
  const fetchJson = usePrivyAuthedJson()

  return useQuery<EmployerTreasurySnapshot | null>({
    queryKey: ['me-employer-treasury'],
    queryFn: async () => {
      try {
        return await fetchJson<EmployerTreasurySnapshot>('/api/me/employer-treasury')
      } catch {
        return null
      }
    },
    enabled: authed && Boolean(employeeId),
    staleTime: 30_000,
  })
}

export interface EmployeeBalanceResponse {
  wallet_address: string | null
  available_raw: string
  /** On-chain sUSDC in the payroll wallet (legacy alias: available_usd). */
  wallet_susdc_usd: number
  /** Total payroll credited in Axios (employer treasury → you), from payment history. */
  payroll_received_usd: number
  /** @deprecated Use wallet_susdc_usd — on-chain sUSDC balance. */
  available_usd: number
  /** ERC-20 decimals for `available_raw` (sUSDC = 18 on Somnia). */
  decimals?: number
}

export function useEmployeeBalance(employeeId: string | undefined) {
  const fetchJson = usePrivyAuthedJson()

  return useQuery<EmployeeBalanceResponse>({
    queryKey: ['employee-balance', employeeId],
    queryFn: () => fetchJson(`/api/employees/${employeeId}/balance`),
    enabled: Boolean(employeeId),
    staleTime: 30_000,
  })
}

export interface EmployeeCardResponse {
  hasCard: boolean
  canIssue: boolean
  card: {
    id: string
    last4: string | null
    expiryMonth: number | null
    expiryYear: number | null
    status: string
  } | null
  transactions: Array<{
    id: string
    merchant: string
    category: string
    amount: number
    currency: string
    date: string
    status: 'completed' | 'pending' | 'declined'
  }>
  bankAccountConnected: boolean
  kycStatus: string
}

export function useEmployeeCard(employeeId: string | undefined) {
  const fetchJson = usePrivyAuthedJson()

  return useQuery<EmployeeCardResponse>({
    queryKey: ['employee-card', employeeId],
    queryFn: () => fetchJson(`/api/employees/${employeeId}/card`),
    enabled: Boolean(employeeId),
    staleTime: 30_000,
  })
}
