/**
 * lib/auth.ts — server-side auth helpers for API route handlers.
 * Verifies Axios session JWTs (wallet SIWE) and resolves employer/employee records.
 */
import { NextRequest } from 'next/server'
import { getAddress, isAddress } from 'viem'
import { createServerClient } from '@/lib/supabase-server'
import { verifySessionJwt } from '@/lib/session-jwt'
import { getEmployerOnchainIdentity } from '@/lib/employer-onchain'
import type { Database } from '@/lib/database.types'

/** When SIWE cannot resolve an employer by wallet, `sub` is `wallet:0x…` — parse it for lookups. */
function getWalletFromWalletSub(sub: string): `0x${string}` | null {
  if (!sub.startsWith('wallet:')) return null
  const raw = sub.slice('wallet:'.length)
  if (!isAddress(raw)) return null
  return getAddress(raw)
}

export type Employer = Database['public']['Tables']['employers']['Row']
export type Employee = Database['public']['Tables']['employees']['Row']

export interface PrivyClaims {
  sub: string
  exp?: number
  /** SIWE signer — used for PayrollTreasury balance key when present */
  wallet?: string
}

function getAdminUserIds() {
  return (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function isPlatformAdminUserId(userId: string | null | undefined) {
  if (!userId) return false
  return getAdminUserIds().includes(userId)
}

/** Legacy Privy JWT payload decode (unsigned) — used only as fallback when HS256 verify fails. */
export function decodePrivyToken(token: string): PrivyClaims | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const decoded = JSON.parse(atob(padded)) as { sub?: string; exp?: number }
    if (!decoded.sub) return null
    if (decoded.exp && decoded.exp * 1000 < Date.now()) return null
    return { sub: decoded.sub, exp: decoded.exp }
  } catch {
    return null
  }
}

/**
 * Extract session claims from Authorization header or axios-token cookie.
 * If a stale Bearer token is sent (in-memory from login) but verification fails,
 * we still try the httpOnly cookie — otherwise every API returns 401 until refresh.
 */
export async function getPrivyClaims(req: NextRequest): Promise<PrivyClaims | null> {
  const cookie = req.cookies.get('axios-token')?.value
  const authHeader = req.headers.get('authorization')

  if (authHeader?.startsWith('Bearer ')) {
    const raw = authHeader.slice(7)
    const verified = await verifySessionJwt(raw)
    if (verified) return verified
    // Bearer invalid/expired — fall through to cookie before legacy decode
  }

  if (cookie) {
    const verified = await verifySessionJwt(cookie)
    if (verified) return verified
  }

  if (authHeader?.startsWith('Bearer ')) {
    const decoded = decodePrivyToken(authHeader.slice(7))
    if (decoded) return decoded
  }

  return null
}

export async function getCallerAdmin(req: NextRequest): Promise<PrivyClaims | null> {
  const claims = await getPrivyClaims(req)
  if (!claims) return null
  if (!isPlatformAdminUserId(claims.sub)) return null
  return claims
}

/** Resolve the employer record for the authenticated caller. */
export async function getCallerEmployer(req: NextRequest): Promise<Employer | null> {
  const claims = await getPrivyClaims(req)
  if (!claims) return null

  const supabase = createServerClient()
  const { data } = await supabase
    .from('employers')
    .select('*')
    .eq('owner_user_id', claims.sub)
    .eq('active', true)
    .maybeSingle()

  if (data) return data

  // SIWE issued `sub` as wallet:0x… when no row matched employer_admin_wallet at login — still resolve by wallet
  const sessionWallet = getWalletFromWalletSub(claims.sub)
  if (!sessionWallet) return null

  const { data: byWallet } = await supabase
    .from('employers')
    .select('*')
    .eq('active', true)
    .eq('employer_admin_wallet', sessionWallet)
    .maybeSingle()

  if (byWallet) return byWallet

  const { data: byWalletLower } = await supabase
    .from('employers')
    .select('*')
    .eq('active', true)
    .eq('employer_admin_wallet', sessionWallet.toLowerCase() as `0x${string}`)
    .maybeSingle()

  return byWalletLower ?? null
}

/** Match `employees.wallet_address` whether stored checksummed or lowercase. */
async function findEmployeeByWallet(
  supabase: ReturnType<typeof createServerClient>,
  addr: `0x${string}`
): Promise<Employee | null> {
  const checksummed = getAddress(addr)
  for (const w of [checksummed, checksummed.toLowerCase() as `0x${string}`]) {
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('active', true)
      .eq('wallet_address', w)
      .maybeSingle()
    if (data) return data
  }
  return null
}

/**
 * Resolve employee row from JWT claims — same rules as employer wallet fallback:
 * `user_id` match, else `wallet:0x…` sub, else `wallet` claim from SIWE.
 */
async function resolveEmployeeFromClaims(claims: PrivyClaims): Promise<Employee | null> {
  const supabase = createServerClient()

  const { data: byUser } = await supabase
    .from('employees')
    .select('*')
    .eq('user_id', claims.sub)
    .eq('active', true)
    .maybeSingle()
  if (byUser) return byUser

  const fromSub = getWalletFromWalletSub(claims.sub)
  if (fromSub) {
    const row = await findEmployeeByWallet(supabase, fromSub)
    if (row) return row
  }

  if (claims.wallet && isAddress(claims.wallet)) {
    const row = await findEmployeeByWallet(supabase, getAddress(claims.wallet))
    if (row) return row
  }

  return null
}

/** Session + employee resolution for `/api/me/*` — distinguishes “not signed in” vs “signed in but not an employee”. */
export type EmployeeSessionState =
  | { status: 'unauthenticated' }
  | { status: 'no_employee'; claims: PrivyClaims }
  | { status: 'ok'; employee: Employee }

export async function getEmployeeSessionState(req: NextRequest): Promise<EmployeeSessionState> {
  const claims = await getPrivyClaims(req)
  if (!claims) return { status: 'unauthenticated' }
  const employee = await resolveEmployeeFromClaims(claims)
  if (!employee) return { status: 'no_employee', claims }
  return { status: 'ok', employee }
}

/** Resolve the employee record for the authenticated caller. */
export async function getCallerEmployee(req: NextRequest): Promise<Employee | null> {
  const s = await getEmployeeSessionState(req)
  return s.status === 'ok' ? s.employee : null
}

export type EmployeeSessionResult =
  | { ok: true; employee: Employee }
  | { ok: false; reason: 'unauthenticated' }
  | { ok: false; reason: 'not_employee' }

/**
 * Same as getCallerEmployee but distinguishes “no JWT” vs “JWT ok but no employees row”.
 * Use for /api/me/* so we return 401 vs 403 correctly (employer-only sessions hit not_employee).
 */
export async function requireEmployeeSession(req: NextRequest): Promise<EmployeeSessionResult> {
  const s = await getEmployeeSessionState(req)
  if (s.status === 'unauthenticated') return { ok: false, reason: 'unauthenticated' }
  if (s.status === 'no_employee') return { ok: false, reason: 'not_employee' }
  return { ok: true, employee: s.employee }
}

/** Resolve the employer by ID, verifying the caller is the owner. */
export async function getAuthorizedEmployer(
  req: NextRequest,
  employerId: string
): Promise<Employer | null> {
  const claims = await getPrivyClaims(req)
  if (!claims) return null

  const supabase = createServerClient()
  const { data } = await supabase
    .from('employers')
    .select('*')
    .eq('id', employerId)
    .eq('active', true)
    .maybeSingle()

  if (!data) return null

  if (data.owner_user_id === claims.sub) return data

  const sessionWallet = getWalletFromWalletSub(claims.sub)
  if (sessionWallet && data.employer_admin_wallet) {
    try {
      if (getAddress(data.employer_admin_wallet) === sessionWallet) return data
    } catch {
      // invalid stored address
    }
  }

  return null
}

/** On-chain identity for treasury / payroll — prefers SIWE wallet from JWT over DB. */
export async function getEmployerOnchainIdentityForRequest(
  req: NextRequest,
  employer: Employer
) {
  const claims = await getPrivyClaims(req)
  return getEmployerOnchainIdentity(employer, claims?.wallet ?? null)
}

/** Resolve the employee by ID, verifying the caller owns that employee record. */
export async function getAuthorizedEmployee(
  req: NextRequest,
  employeeId: string
): Promise<Employee | null> {
  const claims = await getPrivyClaims(req)
  if (!claims) return null

  const caller = await resolveEmployeeFromClaims(claims)
  if (!caller || caller.id !== employeeId) return null
  return caller
}
