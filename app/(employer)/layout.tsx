'use client'

import * as React from 'react'
import { useAccount } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { Web3Provider } from '@/components/providers/Web3Provider'
import { EmployerSidebar } from '@/components/employer/EmployerSidebar'
import { EmployerHeader } from '@/components/employer/EmployerHeader'
import { useEmployer } from '@/lib/hooks/useEmployer'
import { usePrivyAuthedFetch } from '@/lib/hooks/usePrivyAuthedFetch'

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Provider>
      <EmployerLayoutShell>{children}</EmployerLayoutShell>
    </Web3Provider>
  )
}

function EmployerLayoutShell({ children }: { children: React.ReactNode }) {
  const { address } = useAccount()
  const authedFetch = usePrivyAuthedFetch()
  const queryClient = useQueryClient()
  const { data: employer } = useEmployer()
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const syncAttemptRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 1279px)')
    setCollapsed(mql.matches)
    const handler = (e: MediaQueryListEvent) => setCollapsed(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  React.useEffect(() => {
    const employerAdminWallet = address ?? null

    if (!employer?.id || !employer?.company_name || !employerAdminWallet) {
      return
    }

    if (employer.employer_admin_wallet?.toLowerCase() === employerAdminWallet.toLowerCase()) {
      return
    }

    const syncKey = `${employer.id}:${employerAdminWallet}`
    if (syncAttemptRef.current === syncKey) {
      return
    }
    syncAttemptRef.current = syncKey

    let cancelled = false

    void (async () => {
      const response = await authedFetch('/api/employers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: employer.company_name,
          companySize: employer.company_size ?? undefined,
          employerAdminWallet,
        }),
      })

      if (!response.ok || cancelled) return

      await queryClient.invalidateQueries({ queryKey: ['employer'] })
    })()

    return () => {
      cancelled = true
    }
  }, [
    address,
    authedFetch,
    employer?.company_name,
    employer?.company_size,
    employer?.employer_admin_wallet,
    employer?.id,
    queryClient,
  ])

  return (
    <div className="flex h-screen bg-[var(--bg-base)] overflow-hidden">
      <EmployerSidebar
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <EmployerHeader onMobileMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
