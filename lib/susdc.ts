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

/** @deprecated Use susdcToUnits */
export const susdcToUnits = susdcToUnits
/** @deprecated Use formatSusdcUnits */
export const formatSusdcUnits = formatSusdcUnits
/** @deprecated Use susdcUnitsToNumber */
export const susdcUnitsToNumber = susdcUnitsToNumber
