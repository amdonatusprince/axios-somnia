import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'

/**
 * Issues a short-lived nonce for SIWE (stored in httpOnly cookie).
 */
export async function GET(): Promise<NextResponse> {
  const nonce = randomBytes(16).toString('hex')
  const res = NextResponse.json({ nonce })
  res.cookies.set('siwe-nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}
