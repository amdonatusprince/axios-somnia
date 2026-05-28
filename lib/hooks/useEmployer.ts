'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePrivyAuthedJson } from '@/lib/hooks/usePrivyAuthedFetch'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Employer = Database['public']['Tables']['employers']['Row']

export function useEmployer() {
  const fetchJson = usePrivyAuthedJson()

  return useQuery<Employer | null>({
    queryKey: ['employer'],
    queryFn: async () => {
      const response = await fetchJson<{ employer: Employer | null }>('/api/employers')
      return response.employer
    },
    staleTime: 60_000,
  })
}

// Realtime subscription for payroll_runs changes
export function usePayrollRunsRealtime(employerId: string | undefined, onUpdate: () => void) {
  React.useEffect(() => {
    if (!employerId) return

    const channel = supabase
      .channel(`payroll_runs:${employerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payroll_runs',
          filter: `employer_id=eq.${employerId}`,
        },
        () => onUpdate(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [employerId, onUpdate])
}

export function usePaymentItemsRealtime(employerId: string | undefined, onUpdate: () => void) {
  React.useEffect(() => {
    if (!employerId) return

    const channel = supabase
      .channel(`payment_items:${employerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_items',
          filter: `employer_id=eq.${employerId}`,
        },
        () => onUpdate(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [employerId, onUpdate])
}
