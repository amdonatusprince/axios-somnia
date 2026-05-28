'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEmployer } from '@/lib/hooks/useEmployer'
import { usePrivyAuthedFetch } from '@/lib/hooks/usePrivyAuthedFetch'
import { SOMNIA_EXPLORER_URL } from '@/lib/constants'
import { cn } from '@/lib/utils'

type PaymentLine = {
  id: string
  employee_id: string
  amount: number
  status: string
  tx_hash: string | null
  memo_decoded: Record<string, unknown> | null
  created_at: string
  employee: {
    id: string
    first_name: string | null
    last_name: string | null
    wallet_address: string | null
  } | null
}

type RunPayload = {
  run: {
    id: string
    status: string
    total_amount: number | null
    employee_count: number | null
    tx_hash: string | null
    finalized_at: string | null
    created_at: string
  }
  items: PaymentLine[]
}

export default function PayrollRunDetailsPage({ params }: { params: Promise<{ runId: string }> }) {
  const router = useRouter()
  const resolvedParams = React.use(params)
  const runId = resolvedParams.runId
  const { data: employer, isLoading: employerLoading } = useEmployer()
  const authedFetch = usePrivyAuthedFetch()
  const [data, setData] = React.useState<RunPayload | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!employer?.id || !runId) return
    let cancelled = false
    setError(null)
    authedFetch(`/api/employers/${employer.id}/payroll/${runId}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error ?? 'Failed to load payroll run')
        }
        return res.json() as Promise<RunPayload>
      })
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [employer?.id, runId, authedFetch])

  const loading = employerLoading || (employer?.id && !data && !error)

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/payroll')}
          className="mb-4 gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Payroll
        </Button>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          Payroll run
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5 font-mono">{runId}</p>
      </div>

      {error && (
        <p className="text-sm text-[var(--status-error)] rounded-lg border border-[var(--status-error)]/30 bg-red-500/5 px-4 py-3">
          {error}
        </p>
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
      ) : data ? (
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] space-y-3">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
                  data.run.status === 'completed'
                    ? 'bg-[var(--status-success)]/15 text-[var(--status-success)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]',
                )}
              >
                {data.run.status}
              </span>
              {data.run.tx_hash && (
                <a
                  href={`${SOMNIA_EXPLORER_URL}/tx/${data.run.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-mono text-[var(--accent)] hover:underline"
                >
                  {data.run.tx_hash.slice(0, 10)}…{data.run.tx_hash.slice(-8)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[var(--text-muted)]">Created</dt>
                <dd className="font-medium text-[var(--text-primary)]">
                  {new Date(data.run.created_at).toLocaleString()}
                </dd>
              </div>
              {data.run.finalized_at && (
                <div>
                  <dt className="text-[var(--text-muted)]">Finalized</dt>
                  <dd className="font-medium text-[var(--text-primary)]">
                    {new Date(data.run.finalized_at).toLocaleString()}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-[var(--text-muted)]">Total</dt>
                <dd className="font-mono font-semibold text-[var(--text-primary)]">
                  {data.run.total_amount != null
                    ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      }).format(data.run.total_amount)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Employees</dt>
                <dd className="font-medium text-[var(--text-primary)]">
                  {data.run.employee_count ?? data.items.length}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Payments</h2>
            <div className="rounded-xl border border-[var(--border-default)] overflow-hidden divide-y divide-[var(--border-default)]">
              {data.items.map((line) => {
                const name = line.employee
                  ? `${line.employee.first_name ?? ''} ${line.employee.last_name ?? ''}`.trim() ||
                    'Employee'
                  : 'Unknown employee'
                return (
                  <div
                    key={line.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 bg-[var(--bg-surface)]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{name}</p>
                      {line.employee?.wallet_address && (
                        <p className="text-xs font-mono text-[var(--text-muted)] truncate">
                          {line.employee.wallet_address}
                        </p>
                      )}
                      <p className="text-[10px] text-[var(--text-muted)] mt-1 uppercase tracking-wide">
                        {line.status}
                      </p>
                    </div>
                    <div className="font-mono text-sm font-semibold text-[var(--text-primary)] sm:text-right">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      }).format(line.amount)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            Amounts are stored and displayed in USD; on-chain settlement uses sUSDC (18 decimals).
          </p>
        </div>
      ) : null}
    </div>
  )
}
