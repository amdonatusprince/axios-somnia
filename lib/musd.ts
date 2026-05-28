import { formatUnits, parseUnits } from 'viem'
import { MUSD_DECIMALS } from '@/lib/constants'

/** Convert a human USD amount (from DB or API) to MUSD base units (wei-style). */
export function musdToUnits(amount: number | string): bigint {
  const s =
    typeof amount === 'string'
      ? amount.trim()
      : amount.toLocaleString('en-US', { maximumFractionDigits: MUSD_DECIMALS, useGrouping: false })
  return parseUnits(s, MUSD_DECIMALS)
}

/** Format raw MUSD units as a decimal string. */
export function formatMusdUnits(units: bigint): string {
  return formatUnits(units, MUSD_DECIMALS)
}

/** Convert raw MUSD units to a JS number for JSON / display (avoid for very large values). */
export function musdUnitsToNumber(units: bigint): number {
  return Number(formatUnits(units, MUSD_DECIMALS))
}
