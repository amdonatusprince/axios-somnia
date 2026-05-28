import { encodePacked, getAddress, isAddress, keccak256 } from 'viem'

type EmployerOnchainIdentity = {
  company_name?: string | null
  employer_admin_wallet?: string | null
}

export function normalizeEmployerAdminWallet(wallet: string | null | undefined): `0x${string}` | null {
  if (!wallet || !isAddress(wallet)) return null
  return getAddress(wallet)
}

export function getEmployerOnchainAccountIdFromWallet(wallet: string): `0x${string}` {
  const normalizedWallet = normalizeEmployerAdminWallet(wallet)
  if (!normalizedWallet) {
    throw new Error('Employer admin wallet is invalid.')
  }

  return keccak256(encodePacked(['address'], [normalizedWallet]))
}

/**
 * Prefer `sessionWallet` (SIWE address from JWT) when set so `getAvailableBalance` matches the wallet
 * that deposited into PayrollTreasury, even if `employers.employer_admin_wallet` is stale.
 */
export function getEmployerOnchainIdentity(
  employer: EmployerOnchainIdentity,
  sessionWallet?: string | null
): { adminWallet: `0x${string}`; employerAccountId: `0x${string}` } | null {
  const fromSession = normalizeEmployerAdminWallet(sessionWallet ?? undefined)
  const fromDb = normalizeEmployerAdminWallet(employer.employer_admin_wallet)
  const adminWallet = fromSession ?? fromDb
  if (!adminWallet) return null

  return {
    adminWallet,
    employerAccountId: getEmployerOnchainAccountIdFromWallet(adminWallet),
  }
}

export function getEmployerOnchainIdentityError(employer?: EmployerOnchainIdentity | null) {
  const companyName = employer?.company_name?.trim() || 'This employer'

  return {
    error: `${companyName} does not have a canonical on-chain admin wallet configured yet.`,
    code: 'EMPLOYER_ADMIN_WALLET_MISSING',
    detail:
      'Treasury, payroll, and yield reads now require the employer admin wallet that funds PayrollTreasury so the app can derive the correct on-chain employer account key.',
  }
}
