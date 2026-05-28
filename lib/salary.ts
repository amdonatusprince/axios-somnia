/** Seconds per year (365.25 days) — matches on-chain / payroll conventions. */
export const SECONDS_PER_YEAR = 365.25 * 24 * 3600

/**
 * `salary_amount` in the DB is “per payroll cycle” (see employer team UI).
 * Map to an approximate annual USD figure for per-second accrual display.
 */
export function annualSalaryUsd(
  salaryAmount: number | null,
  payFrequency: string | null | undefined,
): number | null {
  if (salaryAmount == null || !Number.isFinite(salaryAmount)) return null
  switch (payFrequency) {
    case 'monthly':
      return salaryAmount * 12
    case 'biweekly':
      return salaryAmount * 26
    case 'weekly':
      return salaryAmount * 52
    case 'stream':
      // Stream uses the same stored per-cycle amount as other modes; annualize like monthly unless product stores gross differently.
      return salaryAmount * 12
    default:
      return salaryAmount * 12
  }
}

/** Human USD accrued per second from an annual salary (for BalanceTicker / demos). */
export function usdPerSecondFromAnnual(annualUsd: number): number {
  return annualUsd / SECONDS_PER_YEAR
}
