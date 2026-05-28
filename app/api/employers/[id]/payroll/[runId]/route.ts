import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getAuthorizedEmployer } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string; runId: string }> }

/**
 * GET /api/employers/[id]/payroll/[runId]
 * Single payroll run + payment line items (with employee names).
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id: employerId, runId } = await ctx.params
  const employer = await getAuthorizedEmployer(req, employerId)
  if (!employer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { data: run, error: runErr } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('id', runId)
    .eq('employer_id', employerId)
    .single()

  if (runErr || !run) {
    return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
  }

  const { data: rawItems } = await supabase
    .from('payment_items')
    .select('id, employee_id, amount, status, tx_hash, memo_decoded, created_at')
    .eq('payroll_run_id', runId)
    .order('created_at', { ascending: true })

  const items = rawItems ?? []
  const empIds = [...new Set(items.map((i) => i.employee_id))]
  const { data: employees } =
    empIds.length > 0
      ? await supabase
          .from('employees')
          .select('id, first_name, last_name, wallet_address')
          .in('id', empIds)
      : { data: [] as { id: string; first_name: string | null; last_name: string | null; wallet_address: string | null }[] }

  const empMap = new Map((employees ?? []).map((e) => [e.id, e]))

  return NextResponse.json({
    run,
    items: items.map((row) => ({
      ...row,
      employee: empMap.get(row.employee_id) ?? null,
    })),
  })
}

export const dynamic = 'force-dynamic'
