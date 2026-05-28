import { NextRequest, NextResponse } from 'next/server'
import { encodeFunctionData, keccak256, toBytes } from 'viem'
import { createServerClient } from '@/lib/supabase-server'
import { getAuthorizedEmployer, getEmployerOnchainIdentityForRequest } from '@/lib/auth'
import { treasury, tip403Registry } from '@/lib/contracts'
import { PayrollBatcherABI } from '@/lib/abis/PayrollBatcher'
import { PAYROLL_BATCHER_ADDRESS, SUSDC_ADDRESS, PAYROLL_TREASURY_ADDRESS } from '@/lib/constants'
import { SUSDC_DECIMALS } from '@/lib/constants'
import { susdcToUnits } from '@/lib/susdc'
import { encodeMemo, memoHexToBytea } from '@/lib/memo'
import { getEmployerOnchainIdentityError } from '@/lib/employer-onchain'

type RouteContext = { params: Promise<{ id: string }> }

interface PayrollItem {
  employeeId: string
  walletAddress: string
  amount: string // human-readable, e.g. "3500.00"
  costCenter?: number
}

/**
 * POST /api/employers/[id]/payroll
 *
 * Validates:
 *   1. PayrollTreasury.getAvailableBalance(employerId) >= total (sUSDC deposited via deposit(), not wallet balance)
 *   2. All employee wallets pass TIP-403 isAuthorized check (if policyId set)
 *
 * Returns unsigned `executeBatchPayroll` calldata for the frontend Privy wallet to sign.
 * Does NOT execute the transaction server-side.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: employerId } = await ctx.params

  const employer = await getAuthorizedEmployer(req, employerId)
  if (!employer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    items?: PayrollItem[]
    payPeriod?: string // YYYY-MM-DD
    payrollRunId?: string
  }

  const { items, payPeriod, payrollRunId } = body
  if (!items?.length) {
    return NextResponse.json({ error: 'items array is required' }, { status: 400 })
  }
  if (!payPeriod) {
    return NextResponse.json({ error: 'payPeriod is required (YYYY-MM-DD)' }, { status: 400 })
  }

  const onchainIdentity = await getEmployerOnchainIdentityForRequest(req, employer)
  if (!onchainIdentity) {
    return NextResponse.json(getEmployerOnchainIdentityError(employer), { status: 409 })
  }

  if (!PAYROLL_TREASURY_ADDRESS || PAYROLL_TREASURY_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return NextResponse.json(
      {
        error: 'PayrollTreasury contract address is not configured',
        code: 'PAYROLL_TREASURY_UNCONFIGURED',
        detail: 'Set NEXT_PUBLIC_PAYROLL_TREASURY in your environment to your deployed PayrollTreasury address.',
      },
      { status: 503 },
    )
  }

  // ── 1. Compute total in token units (sUSDC uses 6 decimals on Somnia) ─────
  let totalUnits = 0n
  const amountsInUnits: bigint[] = []

  for (const item of items) {
    const units = susdcToUnits(item.amount)
    amountsInUnits.push(units)
    totalUnits += units
  }

  // ── 2. Validate treasury balance ──────────────────────────────────────────
  const available = (await treasury.read.getAvailableBalance([onchainIdentity.employerAccountId])) as bigint

  if (available < totalUnits) {
    const availableUsd = Number(available) / 10 ** SUSDC_DECIMALS
    const requiredUsd = Number(totalUnits) / 10 ** SUSDC_DECIMALS
    return NextResponse.json(
      {
        error: 'Insufficient treasury balance',
        code: 'INSUFFICIENT_TREASURY_DEPOSIT',
        detail:
          'This check uses sUSDC credited inside the PayrollTreasury contract for your employer account, not your wallet balance. ',
        available: available.toString(),
        required: totalUnits.toString(),
        availableUsd,
        requiredUsd,
        payrollTreasuryAddress: PAYROLL_TREASURY_ADDRESS,
        employerAdminWallet: onchainIdentity.adminWallet,
        employerAccountId: onchainIdentity.employerAccountId,
      },
      { status: 422 }
    )
  }

  // ── 3. Validate TIP-403 compliance for all recipient wallets ─────────────
  if (employer.tip403_policy_id) {
    const policyId = BigInt(employer.tip403_policy_id)
    const complianceResults = await Promise.all(
      items.map((item) =>
        tip403Registry.read
          .isAuthorized([policyId, item.walletAddress as `0x${string}`])
          .then((ok) => ({ wallet: item.walletAddress, ok }))
          .catch(() => ({ wallet: item.walletAddress, ok: false }))
      )
    )

    const blocked = complianceResults.filter((r) => !r.ok)
    if (blocked.length > 0) {
      return NextResponse.json(
        {
          error: 'One or more employee wallets failed TIP-403 compliance check',
          blocked: blocked.map((b) => b.wallet),
        },
        { status: 422 }
      )
    }
  }

  // ── 4. Build 32-byte ISO 20022 memos ─────────────────────────────────────
  const memos: `0x${string}`[] = items.map((item) =>
    encodeMemo({
      employerId: employer.id,
      employeeId: item.employeeId,
      payPeriod,
      costCenter: item.costCenter ?? 0,
      recordHash: keccak256(toBytes(`${employer.id}:${item.employeeId}:${payPeriod}`)).slice(2, 10),
    })
  )

  // ── 5. Build unsigned calldata ────────────────────────────────────────────
  const recipients = items.map((i) => i.walletAddress as `0x${string}`)
  const memoBytes32 = memos.map((m) => m as `0x${string}`)

  const calldata = encodeFunctionData({
    abi: PayrollBatcherABI,
    functionName: 'executeBatchPayroll',
    args: [recipients, amountsInUnits, memoBytes32, onchainIdentity.employerAccountId],
  })

  // ── 6. Persist draft payroll run in Supabase ─────────────────────────────
  const supabase = createServerClient()
  let runId = payrollRunId

  if (!runId) {
    const { data: run } = await supabase
      .from('payroll_runs')
      .insert({
        employer_id: employerId,
        status: 'pending',
        total_amount: Number(totalUnits) / 10 ** SUSDC_DECIMALS,
        employee_count: items.length,
        token_address: SUSDC_ADDRESS,
        created_by: employer.owner_user_id,
      })
      .select('id')
      .single()

    if (run) runId = run.id
  }

  if (runId) {
    await supabase.from('payment_items').insert(
      items.map((item, i) => ({
        payroll_run_id: runId!,
        employee_id: item.employeeId,
        amount: parseFloat(item.amount),
        memo_bytes: memoHexToBytea(memos[i]),
        memo_decoded: {
          employerId: employer.id,
          employeeId: item.employeeId,
          payPeriod,
          costCenter: item.costCenter ?? 0,
        },
      }))
    )
  }

  return NextResponse.json({
    calldata,
    to: PAYROLL_BATCHER_ADDRESS,
    totalAmount: totalUnits.toString(),
    employeeCount: items.length,
    payrollRunId: runId ?? null,
    memos,
    employer_admin_wallet: onchainIdentity.adminWallet,
    employer_account_id: onchainIdentity.employerAccountId,
  })
}
