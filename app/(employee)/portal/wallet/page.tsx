'use client'

import Link from 'next/link'
import { useAccount } from 'wagmi'
import { ArrowUpRight, Clock3, Wallet } from 'lucide-react'
import { AddressDisplay } from '@/components/wallet/AddressDisplay'
import { GasSponsored } from '@/components/wallet/GasSponsored'
import { WalletStatusPanel } from '@/components/wallet/WalletStatusPanel'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useEmployee, useEmployeeBalance, useEmployerForEmployee } from '@/lib/hooks/useEmployee'
import { SOMNIA_EXPLORER_URL } from '@/lib/constants'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value)
}

export default function WalletPage() {
  const { address } = useAccount()
  const { data: employee, isLoading } = useEmployee()
  const { data: balance } = useEmployeeBalance(employee?.id)
  const { data: employer } = useEmployerForEmployee(employee?.employer_id)
  const sessionWallet = address ?? null

  if (isLoading) {
    return <div className="mx-auto h-80 max-w-[640px] animate-pulse rounded-2xl bg-[var(--bg-subtle)] px-4 pt-6" />
  }

  return (
    <div className="mx-auto max-w-[640px] space-y-6 px-4 pb-24 pt-6">
      <SectionHeader
        title="Wallet"
        description="Your Somnia wallet is where Axios salary funding, streaming accrual, and card spend authorization are anchored."
      />

      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Payroll received</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {formatCurrency(balance?.payroll_received_usd ?? 0)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
              Total credited from employer treasury through Axios payroll runs.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">sUSDC in payroll wallet</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {formatCurrency(balance?.wallet_susdc_usd ?? balance?.available_usd ?? 0)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
              On-chain balance of your saved employee wallet (may differ if you moved funds).
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Employer</p>
          <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{employer?.company_name ?? 'Your company'}</p>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Wallet address</p>
            {employee?.wallet_address ? (
              <div className="mt-2 space-y-3">
                <AddressDisplay address={employee.wallet_address} />
                <GasSponsored />
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Your wallet will appear here after you accept your invite and complete sign-in.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 h-5 w-5 text-[var(--text-muted)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {employee?.pay_frequency === 'stream' ? 'Streaming salary enabled' : 'Scheduled payroll cadence'}
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                  {employee?.pay_frequency === 'stream'
                    ? 'Your salary can accrue every second through StreamVesting.'
                    : `Payroll is configured on a ${employee?.pay_frequency ?? 'monthly'} basis.`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {employee?.wallet_address ? (
          <Button asChild variant="outline" className="mt-5 w-full">
            <a href={`${SOMNIA_EXPLORER_URL}/address/${employee.wallet_address}`} target="_blank" rel="noreferrer">
              View on Somnia Explorer
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </Button>
        ) : null}
      </div>

      <WalletStatusPanel
        title="Employee Wallet Status"
        description="This compares your connected wallet with the payroll wallet on your employee profile. Axios salary and card flows use the saved employee wallet."
        sessionLabel="Connected wallet"
        sessionAddress={sessionWallet}
        storedLabel="Saved payroll wallet"
        storedAddress={employee?.wallet_address}
        syncedCopy="Your connected wallet matches the employee wallet on file. Salary, payroll receipts, and card flows reference the same address."
        missingStoredCopy="A wallet is connected but not yet saved to your employee profile. Finish invite acceptance or contact support if this persists."
        mismatchCopy="The profile wallet differs from your connected wallet. Payroll still targets the saved address — confirm with your employer if you need to update it."
        missingSessionCopy="Connect the same wallet you used to accept your invite, or sign in again from the login page."
        footer="For most users this should sync automatically during invite acceptance. If it does not, the saved payroll wallet should be treated as the source of truth until support or admin review updates it."
      />
    </div>
  )
}
