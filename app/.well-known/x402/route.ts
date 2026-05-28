import { NextResponse } from 'next/server'
import { SOMNIA_CHAIN_ID, SUSDC_ADDRESS } from '@/lib/constants'
import { getAxiosTreasuryAddress } from '@/lib/x402'

/**
 * GET /.well-known/x402
 * Payment method discovery for Axios on Somnia testnet (sUSDC).
 */
export async function GET(): Promise<NextResponse> {
  const recipient = getAxiosTreasuryAddress() ?? '0x0000000000000000000000000000000000000000'

  return NextResponse.json(
    {
      accepts: [
        {
          scheme: 'exact',
          network: `eip155:${SOMNIA_CHAIN_ID}`,
          asset: SUSDC_ADDRESS,
          currency: 'sUSDC',
          recipient,
          extra: {
            name: 'Axios',
            chain: 'somnia-testnet',
          },
        },
      ],
      openapi: '/api/openapi.json',
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    },
  )
}
