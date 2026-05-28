'use client'

import * as React from 'react'
import { useAuthStore } from '@/lib/auth-store'

/**
 * True when the user has a valid session (Bearer in memory or session cookie).
 */
export function useAuthedApiEnabled() {
  const bearerToken = useAuthStore((s) => s.bearerToken)
  const [sessionOk, setSessionOk] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch('/api/auth/session', { credentials: 'include' })
      if (!cancelled) setSessionOk(res.ok)
    })()
    return () => {
      cancelled = true
    }
  }, [bearerToken])

  return Boolean(bearerToken) || sessionOk
}
