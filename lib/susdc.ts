import { formatUnits, parseUnits } from 'viem'
import { SUSDC_DECIMALS } from '@/lib/constants'

/** Convert a human USD amount (from DB or API) to sUSDC base units. */
export function susdcToUnits(amount: number | string): bigint {
  const s =
    typeof amount === 'string'
      ? amount.trim()
      : amount.toLocaleString('en-US', { maximumFractionDigits: SUSDC_DECIMALS, useGrouping: false })
  return parseUnits(s, SUSDC_DECIMALS)
}

/** Format raw sUSDC units as a decimal string. */
export function formatSusdcUnits(units: bigint): string {
  return formatUnits(units, SUSDC_DECIMALS)
}

/** Convert raw sUSDC units to a JS number for JSON / display (avoid for very large values). */
export function susdcUnitsToNumber(units: bigint): number {
  return Number(formatUnits(units, SUSDC_DECIMALS))
}

/** Human-readable sUSDC amount with grouping (e.g. 10,000.00). */
export function formatSusdcDisplay(
  amount: bigint | number | string,
  options?: { minFractionDigits?: number; maxFractionDigits?: number },
): string {
  const minFractionDigits = options?.minFractionDigits ?? 2
  const maxFractionDigits = options?.maxFractionDigits ?? 6

  let value: number
  if (typeof amount === 'bigint') {
    value = susdcUnitsToNumber(amount)
  } else if (typeof amount === 'string') {
    value = Number(amount)
  } else {
    value = amount
  }

  if (!Number.isFinite(value)) return '0.00'

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  }).format(value)
}
