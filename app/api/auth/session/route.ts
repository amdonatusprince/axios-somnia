import { NextRequest, NextResponse } from 'next/server'
import { getPrivyClaims } from '@/lib/auth'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const claims = await getPrivyClaims(req)
  if (!claims) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true, sub: claims.sub })
}
