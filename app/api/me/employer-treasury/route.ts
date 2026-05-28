import { NextRequest, NextResponse } from 'next/server'
import { requireEmployeeSession } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase-server'
import { treasury } from '@/lib/contracts'
import { getEmployerOnchainIdentity, getEmployerOnchainIdentityError } from '@/lib/employer-onchain'
import { MUSD_DECIMALS } from '@/lib/constants'

/**
 * GET /api/me/employer-treasury
 * Read-only PayrollTreasury balances for the authenticated employee’s employer.
 * Uses `employers.employer_admin_wallet` from the DB only (not the employee’s SIWE wallet)
 * so the on-chain account id matches deposits from the employer dashboard.
 */
export async function GET(_req: NextRequest) {
  const session = await requireEmployeeSession(_req)
  if (!session.ok) {
    if (session.reason === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Forbidden', detail: 'Employee session required.' },
      { status: 403 }
    )
  }

  const supabase = createServerClient()
  const { data: employer, error } = await supabase
    .from('employers')
    .select('*')
    .eq('id', session.employee.employer_id)
    .eq('active', true)
    .maybeSingle()

  if (error || !employer) {
    return NextResponse.json({ error: 'Employer not found' }, { status: 404 })
  }

  const onchainIdentity = getEmployerOnchainIdentity(employer, null)
  if (!onchainIdentity) {
    return NextResponse.json(getEmployerOnchainIdentityError(employer), { status: 409 })
  }

  const [available, locked] = await Promise.all([
    treasury.read.getAvailableBalance([onchainIdentity.employerAccountId]) as Promise<bigint>,
    treasury.read.getLockedBalance([onchainIdentity.employerAccountId]) as Promise<bigint>,
  ])

  const scale = 10 ** MUSD_DECIMALS
  const availableUsd = Number(available) / scale
  const lockedUsd = Number(locked) / scale

  return NextResponse.json({
    employer_id: employer.id,
    company_name: employer.company_name ?? null,
    available_usd: availableUsd,
    locked_usd: lockedUsd,
    total_usd: availableUsd + lockedUsd,
    available_raw: available.toString(),
    locked_raw: locked.toString(),
  })
}
