import { NextResponse } from 'next/server'
import { MEZO_CHAIN_ID, MUSD_ADDRESS } from '@/lib/constants'
import { getAxiosTreasuryAddress } from '@/lib/x402'

/**
 * GET /.well-known/x402
 * Payment method discovery for Axios on Mezo testnet (MUSD).
 */
export async function GET(): Promise<NextResponse> {
  const recipient = getAxiosTreasuryAddress() ?? '0x0000000000000000000000000000000000000000'

  return NextResponse.json(
    {
      accepts: [
        {
          scheme: 'exact',
          network: `eip155:${MEZO_CHAIN_ID}`,
          asset: MUSD_ADDRESS,
          currency: 'MUSD',
          recipient,
          extra: {
            name: 'Axios',
            chain: 'mezo-testnet',
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
