import { NextRequest } from 'next/server'
import { streamVesting } from '@/lib/contracts'
import { createServerClient } from '@/lib/supabase-server'
import { formatSusdcUnits } from '@/lib/susdc'

/** 365.25 * 24 * 3600 — demo ~$100k/yr in sUSDC (18 decimals). */
const SECONDS_PER_YEAR = 31557600n
const SALARY_PER_SECOND = (100_000n * 10n ** 18n) / SECONDS_PER_YEAR

/**
 * GET /api/mpp/employee/balance/stream
 * MPP-5 — previously $0.001/tick via mppx session; now streams without Tempo payment channel.
 *
 * Query params: ?employeeId=emp_123
 * Legacy compatibility: ?address=0x...
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const employeeId = url.searchParams.get('employeeId')
  const legacyAddress = url.searchParams.get('address') as `0x${string}` | null

  let address: `0x${string}` | null = legacyAddress
  if (!address && employeeId) {
    const supabase = createServerClient()
    const { data: employee } = await supabase
      .from('employees')
      .select('wallet_address')
      .eq('id', employeeId)
      .single()

    address = (employee?.wallet_address as `0x${string}` | null) ?? null
  }

  let baseBalance = BigInt(0)
  if (address?.startsWith('0x')) {
    baseBalance = (await streamVesting.read.getAccruedBalance([address])) as bigint
  }

  const startTime = Date.now()
  let tick = 0

  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        tick++
        const elapsed = BigInt(Math.floor((Date.now() - startTime) / 1000))
        const accrued = baseBalance + elapsed * SALARY_PER_SECOND
        const accruedUsd = formatSusdcUnits(accrued)

        const data = JSON.stringify({
          tick,
          employeeId: employeeId ?? null,
          address: address ?? null,
          balance: accrued.toString(),
          balanceUsd: accruedUsd,
          accrued_raw: accrued.toString(),
          accrued_usd: accruedUsd,
          salary_per_second_usd: formatSusdcUnits(SALARY_PER_SECOND),
          timestamp: Date.now(),
        })

        controller.enqueue(`data: ${data}\n\n`)

        if (tick >= 60) {
          clearInterval(interval)
          controller.close()
        }
      }, 1000)

      req.signal?.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
