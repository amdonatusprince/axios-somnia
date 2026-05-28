import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizedEmployee } from '@/lib/auth'
import { susdcToken } from '@/lib/contracts'
import { createServerClient } from '@/lib/supabase-server'
import { SUSDC_DECIMALS } from '@/lib/constants'
import { susdcUnitsToNumber } from '@/lib/susdc'

type RouteContext = { params: Promise<{ id: string }> }

/** Sum of recorded payroll payouts (excludes failed rows). Matches employer PayrollTreasury → employee wallet. */
async function sumPayrollReceivedUsd(employeeId: string): Promise<number> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('payment_items')
    .select('amount')
    .eq('employee_id', employeeId)
    .neq('status', 'failed')

  if (error || !data?.length) return 0
  return data.reduce((sum, row) => sum + Number(row.amount), 0)
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id: employeeId } = await ctx.params
  const employee = await getAuthorizedEmployee(req, employeeId)

  if (!employee) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payrollReceivedUsd = await sumPayrollReceivedUsd(employeeId)

  if (!employee.wallet_address) {
    return NextResponse.json({
      wallet_address: null,
      available_raw: '0',
      /** @deprecated Prefer wallet_susdc_usd — same meaning: on-chain sUSDC in the saved wallet. */
      available_usd: 0,
      wallet_susdc_usd: 0,
      payroll_received_usd: payrollReceivedUsd,
      decimals: SUSDC_DECIMALS,
    })
  }

  const balance = (await susdcToken.read.balanceOf([employee.wallet_address as `0x${string}`])) as bigint
  const walletSusdc = susdcUnitsToNumber(balance)

  return NextResponse.json({
    wallet_address: employee.wallet_address,
    available_raw: balance.toString(),
    /** On-chain sUSDC ERC-20 balance of the payroll wallet (may differ if funds moved). */
    wallet_susdc_usd: walletSusdc,
    /** Legacy alias — same as wallet_susdc_usd. */
    available_usd: walletSusdc,
    /** Total of payroll line items credited from employer treasury (Axios records). */
    payroll_received_usd: payrollReceivedUsd,
    decimals: SUSDC_DECIMALS,
  })
}
