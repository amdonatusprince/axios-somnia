'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useState } from 'react'
import { AxiosLogo } from '@/components/brand/AxiosLogo'
import { Button } from '@/components/ui/button'

/**
 * Only allow redirects back to this app (open-redirect safe).
 * In development, `NEXT_PUBLIC_APP_URL` often uses :3000 while `pnpm dev` runs on another port;
 * those URLs differ by origin but same hostname, so we allow same-hostname http(s) on localhost.
 */
function safeSameOriginRedirect(redirect: string | null): string | null {
  if (!redirect?.trim()) return null
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    const u = new URL(redirect.trim(), base)
    if (typeof window === 'undefined') return u.toString()

    if (u.origin === window.location.origin) return u.toString()

    const dev =
      process.env.NODE_ENV === 'development' &&
      u.hostname === window.location.hostname &&
      (u.protocol === 'http:' || u.protocol === 'https:')
    if (dev) return u.toString()

    return null
  } catch {
    return null
  }
}

function BridgeMockInner() {
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirect')
  const redirect = useMemo(() => safeSameOriginRedirect(rawRedirect), [rawRedirect])

  const employeeId = useMemo(() => {
    if (!redirect) return null
    const m = redirect.match(/\/kyc\/([^/?]+)/)
    return m?.[1] ?? null
  }, [redirect])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function complete() {
    setError(null)
    setBusy(true)
    try {
      if (employeeId) {
        const res = await fetch('/api/bridge-mock/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId }),
        })
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error ?? res.statusText)
        }
      }
      if (redirect) {
        window.location.href = redirect
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-8">
        <AxiosLogo markClassName="h-7 w-7" labelClassName="text-[var(--text-primary)] text-base" />
        <div className="w-full rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 shadow-xl shadow-black/10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Simulated Bridge</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Axios KYC (Simulated)
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            Click below to approve this employee in the database and return to your app — same as a successful webhook would do.
          </p>

          {!redirect ? (
            <p className="mt-6 text-sm text-[var(--status-error)]">
              Missing <code className="text-xs">redirect</code> query. Open KYC from the employee link in the app.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4 text-xs text-[var(--text-muted)] break-all">
                Return to: {redirect}
              </div>
              {error ? <p className="text-sm text-[var(--status-error)]">{error}</p> : null}
              <Button className="w-full" disabled={busy} onClick={() => void complete()}>
                {busy ? 'Saving…' : 'Complete simulated verification'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function BridgeMockClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--text-muted)]">
          Loading…
        </div>
      }
    >
      <BridgeMockInner />
    </Suspense>
  )
}
