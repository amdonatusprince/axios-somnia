'use client'

import * as React from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, CreditCard, Key, Landmark, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { FundingReadinessCard } from '@/components/treasury/FundingReadinessCard'
import { WalletStatusPanel } from '@/components/wallet/WalletStatusPanel'
import { useEmployer } from '@/lib/hooks/useEmployer'
import { usePayrollRuns, useTreasury } from '@/lib/hooks/useDashboard'
import { usePrivyAuthedJson } from '@/lib/hooks/usePrivyAuthedFetch'

function InfoCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        {icon}
        <p className="text-xs uppercase tracking-[0.14em]">{label}</p>
      </div>
      <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

export default function EmployerSettingsPage() {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const fetchJson = usePrivyAuthedJson()
  const { data: employer, isLoading: employerLoading, refetch: refetchEmployer } = useEmployer()
  const { data: treasury } = useTreasury(employer?.id)
  const { data: payrollRuns } = usePayrollRuns(employer?.id, 1, 25)
  const sessionWallet = address ?? null
  const [isSyncingWallet, setIsSyncingWallet] = React.useState(false)

  const payrollVolume = payrollRuns?.runs.reduce((sum, run) => sum + run.total_amount, 0) ?? 0

  async function handleWalletSync() {
    if (!sessionWallet) {
      toast.error('Connect your wallet in the header, then sync again.')
      return
    }

    if (employerLoading) {
      toast.error('Still loading your workspace — try again in a second.')
      return
    }

    if (!employer?.id) {
      toast.error('No employer workspace found. Finish employer registration first.')
      return
    }

    setIsSyncingWallet(true)

    try {
      await fetchJson<{ employerId: string }>('/api/employers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: employer.company_name ?? 'Employer',
          companySize: employer.company_size ?? undefined,
          employerAdminWallet: sessionWallet,
        }),
      })

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employer'] }),
        queryClient.invalidateQueries({ queryKey: ['treasury', employer.id] }),
        queryClient.invalidateQueries({ queryKey: ['yield'] }),
        refetchEmployer(),
      ])

      toast.success('Employer wallet synced.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sync employer wallet.')
    } finally {
      setIsSyncingWallet(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Settings"
        description="Review workspace identity, treasury linkage, compliance posture, and billing-related account state."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/settings/billing">Open billing</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Company" value={employer?.company_name ?? 'Not configured'} icon={<Building2 className="h-4 w-4" />} />
        <InfoCard
          label="Connected wallet"
          value={address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Not connected'}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <InfoCard label="Subscription" value={employer?.subscription_tier ?? 'starter'} icon={<CreditCard className="h-4 w-4" />} />
        <InfoCard label="Agent key" value={employer?.mpp_agent_key_hash ? 'Provisioned' : 'Not provisioned'} icon={<Key className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <FundingReadinessCard
          companyName={employer?.company_name ?? 'Employer workspace'}
          bridgeCustomerId={employer?.bridge_customer_id ?? null}
          virtualAccountId={employer?.bridge_virtual_account_id ?? null}
          treasuryContract={employer?.treasury_contract ?? null}
          subscriptionTier={employer?.subscription_tier ?? 'starter'}
        />

        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-[var(--text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Operational summary</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Treasury balance</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                ${Number(treasury?.total_usd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Payroll volume</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                ${payrollVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Treasury contract</p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--mono)]">{employer?.treasury_contract ?? 'Not linked yet'}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">On-chain admin wallet</p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--mono)]">
                {employer?.employer_admin_wallet ?? 'Not synced yet'}
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                This wallet is the canonical employer identity for treasury, payroll, and yield on Somnia testnet.
              </p>
            </div>
          </div>
        </div>
      </div>

      <WalletStatusPanel
        title="Employer Wallet Status"
        description="Axios uses a canonical employer wallet for treasury, payroll, and yield reads on Somnia. This panel compares your connected wallet with the wallet saved on your employer record."
        sessionLabel="Connected wallet"
        sessionAddress={sessionWallet}
        storedLabel="Canonical payroll wallet"
        storedAddress={employer?.employer_admin_wallet}
        syncedCopy="Your connected wallet matches the employer wallet on file. Treasury and payroll reads use the same on-chain identity."
        missingStoredCopy="A wallet is connected, but Axios has not saved it as the canonical employer wallet yet. Use sync to persist it."
        mismatchCopy="The saved employer wallet does not match your connected wallet. Confirm before funding or running payroll."
        missingSessionCopy="Connect the wallet you use for payroll signing, then sync it to your employer record."
        footer="If you intentionally switch hot wallets, update the saved employer wallet so treasury and signing stay aligned."
        actionLabel="Sync wallet now"
        actionPendingLabel="Syncing wallet..."
        actionPending={isSyncingWallet}
        actionDisabled={!sessionWallet || isSyncingWallet || employerLoading || !employer?.id}
        onAction={handleWalletSync}
        diagnostics={[
          { label: 'Employer record ID', value: employer?.id ?? 'Not resolved' },
          { label: 'Employer owner user ID', value: employer?.owner_user_id ?? 'Not resolved' },
          { label: 'Session sub', value: employer?.owner_user_id ?? 'Not resolved' },
        ]}
      />
    </div>
  )
}
