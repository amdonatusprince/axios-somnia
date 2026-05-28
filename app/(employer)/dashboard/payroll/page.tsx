'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Banknote, Plus, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useEmployer } from '@/lib/hooks/useEmployer'
import { usePrivyAuthedFetch } from '@/lib/hooks/usePrivyAuthedFetch'
import { cn } from '@/lib/utils'

type RunRow = {
  id: string
  status: string
  total_amount: number | null
  employee_count: number | null
  tx_hash: string | null
  finalized_at: string | null
  created_at: string
}

function statusStyles(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-[var(--status-success)]/15 text-[var(--status-success)]'
    case 'pending':
    case 'processing':
    case 'draft':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
    case 'failed':
      return 'bg-[var(--status-error)]/15 text-[var(--status-error)]'
    default:
      return 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
  }
}

export default function PayrollHistoryPage() {
  const router = useRouter()
  const { data: employer, isLoading: employerLoading } = useEmployer()
  const authedFetch = usePrivyAuthedFetch()
  const [runs, setRuns] = React.useState<RunRow[] | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!employer?.id) return
    let cancelled = false
    setLoadError(null)
    authedFetch(`/api/employers/${employer.id}/payroll/runs?limit=30`)
      .then(async (res) => {
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error ?? 'Failed to load payroll runs')
        }
        return res.json() as Promise<{ runs: RunRow[] }>
      })
      .then((data) => {
        if (!cancelled) setRuns(data.runs)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setLoadError(e.message)
          setRuns([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [employer?.id, authedFetch])

  const loading = employerLoading || (employer?.id && runs === null && !loadError)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Payroll</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            View and manage all past payroll runs
          </p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/payroll/new')}
          className="bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 gap-2 w-full min-[400px]:w-auto"
        >
          <Plus className="h-4 w-4" />
          Run Payroll
        </Button>
      </div>

      {loadError && (
        <p className="text-sm text-[var(--status-error)] rounded-lg border border-[var(--status-error)]/30 bg-red-500/5 px-4 py-3">
          {loadError}
        </p>
      )}

      {loading ? (
        <div className="h-48 animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
      ) : !employer?.id ? (
        <EmptyState
          icon={<Banknote className="h-8 w-8 text-[var(--text-muted)]" />}
          title="Employer profile required"
          description="Complete employer setup before viewing payroll history."
        />
      ) : runs?.length === 0 ? (
        <EmptyState
          icon={<Banknote className="h-8 w-8 text-[var(--text-muted)]" />}
          title="No payroll history"
          description="Your payroll history will appear here once you complete a run."
          action={
            <Button
              onClick={() => router.push('/dashboard/payroll/new')}
              className="bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 gap-2 w-full min-[400px]:w-auto"
            >
              <Plus className="h-4 w-4" />
              Run Payroll
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-[var(--border-default)] overflow-hidden divide-y divide-[var(--border-default)]">
          {runs?.map((run) => (
            <Link
              key={run.id}
              href={`/dashboard/payroll/${run.id}`}
              className="flex items-center gap-4 px-4 py-4 hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-subtle)] shrink-0">
                <Banknote className="h-5 w-5 text-[var(--text-muted)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {new Date(run.created_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
                      statusStyles(run.status),
                    )}
                  >
                    {run.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {run.employee_count ?? '—'}{' '}
                  {(run.employee_count ?? 0) === 1 ? 'employee' : 'employees'}
                  {run.total_amount != null && (
                    <>
                      {' · '}
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      }).format(run.total_amount)}{' '}
                      sUSDC
                    </>
                  )}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-[var(--text-muted)] shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
