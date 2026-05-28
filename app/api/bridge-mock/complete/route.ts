import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { isBridgeMock } from '@/lib/bridge'

/**
 * POST /api/bridge-mock/complete
 * Marks an employee KYC as approved (simulates Bridge webhook). Only active when BRIDGE_MOCK=true.
 */
export async function POST(req: NextRequest) {
  if (!isBridgeMock()) {
    return NextResponse.json({ error: 'Bridge mock is disabled' }, { status: 404 })
  }

  const body = (await req.json().catch(() => ({}))) as { employeeId?: string }
  const employeeId = body.employeeId?.trim()
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('employees')
    .update({
      kyc_status: 'approved',
      kyc_verified_at: new Date().toISOString(),
    })
    .eq('id', employeeId)
    .eq('active', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
