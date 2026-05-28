import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import { createServerClient } from '@/lib/supabase-server'
import { getAuthorizedEmployer, getEmployerOnchainIdentityForRequest } from '@/lib/auth'
import { payrollBatcher, publicClient, getServerWalletClient, getAgentPrivateKeyFromEnv } from '@/lib/contracts'
import { musdToUnits } from '@/lib/musd'
import { getEmployerOnchainIdentityError } from '@/lib/employer-onchain'
import { byteaMemoToHex } from '@/lib/memo'

type RouteContext = { params: Promise<{ id: string; runId: string }> }

/**
 * POST /api/employers/[id]/payroll/[runId]/execute
 * Server-side payroll execution — the Axios agent wallet signs the on-chain tx,
 * so the employer never needs a wallet popup. Employer auth is enforced via
 * getAuthorizedEmployer (session JWT).
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: employerId, runId } = await ctx.params

  const employer = await getAuthorizedEmployer(req, employerId)
  if (!employer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const onchainIdentity = await getEmployerOnchainIdentityForRequest(req, employer)
  if (!onchainIdentity) {
    return NextResponse.json(getEmployerOnchainIdentityError(employer), { status: 409 })
  }

  const supabase = createServerClient()

  const { data: run } = await supabase
    .from('payroll_runs')
    .select('id, status, employer_id')
    .eq('id', runId)
    .eq('employer_id', employerId)
    .single()

  if (!run) {
    return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
  }
  if (run.status !== 'pending') {
    return NextResponse.json({ error: `Payroll run is ${run.status}, not pending` }, { status: 409 })
  }

  const { data: items } = await supabase
    .from('payment_items')
    .select('id, employee_id, amount, memo_bytes')
    .eq('payroll_run_id', runId)

  if (!items?.length) {
    return NextResponse.json({ error: 'No payment items found' }, { status: 400 })
  }

  const employeeIds = items.map((i) => i.employee_id)
  const { data: employees } = await supabase
    .from('employees')
    .select('id, wallet_address')
    .in('id', employeeIds)

  const walletMap = new Map<string, string>(
    (employees ?? [])
      .filter((e) => e.wallet_address)
      .map((e) => [e.id, e.wallet_address as string]),
  )

  const missing = employeeIds.filter((id) => !walletMap.has(id))
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `${missing.length} employee(s) missing wallet addresses` },
      { status: 422 },
    )
  }

  const recipients = items.map((i) => walletMap.get(i.employee_id)! as `0x${string}`)
  const amounts = items.map((i) => musdToUnits(i.amount))
  const memos = items.map((i) => byteaMemoToHex(i.memo_bytes))

  if (memos.some((m) => !m)) {
    return NextResponse.json(
      { error: 'One or more payment items are missing a valid 32-byte memo' },
      { status: 422 },
    )
  }

  const agentKey = getAgentPrivateKeyFromEnv()
  if (!agentKey) {
    return NextResponse.json(
      {
        error: 'Server agent wallet not configured',
        code: 'AGENT_PRIVATE_KEY_INVALID',
        detail:
          'Set AXIOS_AGENT_PRIVATE_KEY in .env.local to a valid key: 0x plus 64 hexadecimal characters (32 bytes). Replace placeholders like 0xYourServerAgentPrivateKey. The wallet address must be authorized as an agent on PayrollBatcher.',
      },
      { status: 503 },
    )
  }

  const walletClient = getServerWalletClient(agentKey)
  const agentAddress = privateKeyToAccount(agentKey).address

  let txHash: `0x${string}`
  try {
    txHash = await walletClient.writeContract({
      address: payrollBatcher.address,
      abi: payrollBatcher.abi,
      functionName: 'executeBatchPayroll',
      args: [recipients, amounts, memos as `0x${string}`[], onchainIdentity.employerAccountId],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('not authorized agent') || msg.includes('authorized agent')) {
      return NextResponse.json(
        {
          error: 'Payroll agent wallet is not authorized on PayrollBatcher',
          code: 'AGENT_NOT_AUTHORIZED_ON_BATCHER',
          detail:
            'Only the batcher owner or addresses in authorizedAgents may call executeBatchPayroll. On-chain, call authorizeAgent(agent) on PayrollBatcher from the deployer/owner wallet.',
          payroll_batcher_address: payrollBatcher.address,
          agent_address: agentAddress,
          hint: `cast send ${payrollBatcher.address} "authorizeAgent(address)" ${agentAddress} --rpc-url $MEZO_RPC --private-key <OWNER_KEY>`,
        },
        { status: 403 },
      )
    }
    console.error('[payroll execute] writeContract failed', err)
    return NextResponse.json(
      {
        error: 'Payroll execution failed',
        detail: msg.length > 800 ? `${msg.slice(0, 800)}…` : msg,
      },
      { status: 500 },
    )
  }

  let blockNumber: number | null = null
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
    blockNumber = Number(receipt.blockNumber)
  } catch (e) {
    console.warn('[payroll execute] waitForTransactionReceipt', e)
  }
  const finalizedAt = new Date().toISOString()

  await Promise.all([
    supabase
      .from('payroll_runs')
      .update({
        status: 'completed',
        tx_hash: txHash,
        finalized_at: finalizedAt,
        ...(blockNumber != null ? { block_number: blockNumber } : {}),
      })
      .eq('id', runId),
    supabase
      .from('payment_items')
      .update({ tx_hash: txHash, status: 'confirmed' })
      .eq('payroll_run_id', runId),
  ])

  return NextResponse.json({
    success: true,
    tx_hash: txHash,
    payroll_run_id: runId,
    recipient_count: recipients.length,
  })
}
