'use client'

import * as React from 'react'
import { useAccount } from 'wagmi'
import { useAuthStore } from '@/lib/auth-store'

export function usePrivyAuthedFetch() {
  const bearerToken = useAuthStore((s) => s.bearerToken)
  const { isConnected } = useAccount()

  return React.useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)

      if (bearerToken) {
        headers.set('Authorization', `Bearer ${bearerToken}`)
      }

      return fetch(input, {
        ...init,
        credentials: 'include',
        headers,
      })
    },
    [bearerToken, isConnected]
  )
}

export function usePrivyAuthedJson() {
  const authedFetch = usePrivyAuthedFetch()

  return React.useCallback(
    async function fetchJson<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
      const res = await authedFetch(input, init)

      if (!res.ok) {
        let message = `${res.status} ${res.statusText}`

        try {
          const body = (await res.json()) as { error?: string }
          if (body.error) {
            message = body.error
          }
        } catch {
          // Ignore JSON parse failures and keep the status-based message.
        }

        throw new Error(message)
      }

      return res.json() as Promise<T>
    },
    [authedFetch]
  )
}
