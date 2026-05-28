import { NextRequest, NextResponse } from 'next/server'
import { getAddress, isAddress } from 'viem'
import { createServerClient } from '@/lib/supabase-server'
import { PAYROLL_TREASURY_ADDRESS } from '@/lib/constants'
import { getCallerEmployer, getPrivyClaims } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const claims = await getPrivyClaims(req)
  if (!claims) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const employer = await getCallerEmployer(req)
  return NextResponse.json({ employer })
}

export async function POST(req: NextRequest) {
  const claims = await getPrivyClaims(req)
  if (!claims) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    companyName?: string
    companySize?: string
    employerAdminWallet?: string
  }
  const companyName = body.companyName?.trim()
  const employerAdminWallet = body.employerAdminWallet?.trim()
  const normalizedEmployerAdminWallet = employerAdminWallet
    ? isAddress(employerAdminWallet)
      ? getAddress(employerAdminWallet)
      : null
    : null

  if (employerAdminWallet && !normalizedEmployerAdminWallet) {
    return NextResponse.json({ error: 'employerAdminWallet must be a valid EVM address' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Check if this user already has an employer record
  const { data: existing } = await supabase
    .from('employers')
    .select('id')
    .eq('owner_user_id', claims.sub)
    .single()

  if (existing) {
    if (normalizedEmployerAdminWallet) {
      await supabase
        .from('employers')
        .update({
          employer_admin_wallet: normalizedEmployerAdminWallet,
          treasury_contract: PAYROLL_TREASURY_ADDRESS,
        })
        .eq('id', existing.id)
    }
    return NextResponse.json({ employerId: existing.id })
  }

  if (!companyName) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('employers')
    .insert({
      owner_user_id: claims.sub,
      company_name: companyName,
      company_size: body.companySize ?? null,
      employer_admin_wallet: normalizedEmployerAdminWallet,
      treasury_contract: PAYROLL_TREASURY_ADDRESS,
      subscription_tier: 'starter',
      active: true,
    })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create employer' }, { status: 500 })
  }

  return NextResponse.json({ employerId: data.id }, { status: 201 })
}
