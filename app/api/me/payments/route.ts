import { NextRequest, NextResponse } from 'next/server'
import { requireEmployeeSession } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase-server'

/** GET /api/me/payments?limit=20 — return payment history for the authenticated employee. */
export async function GET(req: NextRequest) {
  const session = await requireEmployeeSession(req)
  if (!session.ok) {
    if (session.reason === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      {
        error: 'Forbidden',
        detail:
          'Payments are only available for employee accounts. Sign in with the wallet on your employee profile, or complete invite onboarding.',
      },
      { status: 403 }
    )
  }
  const employee = session.employee

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '20'), 100)
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('payment_items')
    .select(`
      id, amount, memo_bytes, memo_decoded, status, tx_hash, created_at,
      payroll_run:payroll_runs(id, employer_id, finalized_at, settlement_time_ms, block_number)
    `)
    .eq('employee_id', employee.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = data ?? []

  const employerIds = [
    ...new Set(
      rows
        .map((row) => {
          const pr = row.payroll_run as { employer_id?: string } | { employer_id?: string }[] | null
          const run = Array.isArray(pr) ? pr[0] : pr
          return run?.employer_id
        })
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  let employerNames = new Map<string, string>()
  if (employerIds.length > 0) {
    const { data: emps } = await supabase.from('employers').select('id, company_name').in('id', employerIds)
    employerNames = new Map((emps ?? []).map((e) => [e.id, e.company_name ?? 'Employer']))
  }

  const enriched = rows.map((row) => {
    const pr = row.payroll_run as { employer_id?: string } | null
    const run = Array.isArray(pr) ? pr[0] : pr
    const eid = run?.employer_id
    return {
      ...row,
      employer_company_name: eid ? employerNames.get(eid) ?? null : null,
    }
  })

  return NextResponse.json(enriched)
}
