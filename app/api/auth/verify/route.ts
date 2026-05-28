import { NextRequest, NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { SiweMessage } from 'siwe'
import { createServerClient } from '@/lib/supabase-server'
import { signSessionJwt } from '@/lib/session-jwt'

const COOKIE_NAME = 'axios-token'

/**
 * Verifies a SIWE message + signature, resolves Supabase user id, issues session JWT.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const nonceCookie = req.cookies.get('siwe-nonce')?.value
  if (!nonceCookie) {
    return NextResponse.json({ error: 'Missing nonce cookie — call GET /api/auth/nonce first' }, { status: 400 })
  }

  const body = (await req.json()) as { message?: string; signature?: string }
  if (!body.message || !body.signature) {
    return NextResponse.json({ error: 'message and signature required' }, { status: 400 })
  }

  let siwe: SiweMessage
  try {
    siwe = new SiweMessage(body.message)
  } catch {
    return NextResponse.json({ error: 'Invalid SIWE message' }, { status: 400 })
  }

  if (siwe.nonce !== nonceCookie) {
    return NextResponse.json({ error: 'Nonce mismatch' }, { status: 400 })
  }

  try {
    await siwe.verify({ signature: body.signature })
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const address = getAddress(siwe.address)
  const supabase = createServerClient()

  const { data: employer } = await supabase
    .from('employers')
    .select('owner_user_id')
    .eq('employer_admin_wallet', address)
    .eq('active', true)
    .maybeSingle()

  let sub: string | null = employer?.owner_user_id ?? null

  if (!sub) {
    // Match checksummed or lowercase — same as findEmployeeByWallet in lib/auth.ts
    for (const w of [address, address.toLowerCase() as `0x${string}`]) {
      const { data: employee } = await supabase
        .from('employees')
        .select('user_id')
        .eq('wallet_address', w)
        .eq('active', true)
        .maybeSingle()
      if (employee?.user_id) {
        sub = employee.user_id
        break
      }
    }
  }

  if (!sub) {
    sub = `wallet:${address.toLowerCase()}`
  }

  const token = await signSessionJwt(sub, { wallet: address })
  const res = NextResponse.json({ token, sub })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  res.cookies.set('siwe-nonce', '', { maxAge: 0, path: '/' })
  return res
}
