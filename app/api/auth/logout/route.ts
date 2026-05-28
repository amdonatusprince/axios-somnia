import { NextResponse } from 'next/server'

const COOKIE_NAME = 'axios-token'

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
  return res
}
