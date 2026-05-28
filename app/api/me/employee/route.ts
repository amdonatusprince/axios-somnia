import { NextRequest, NextResponse } from 'next/server'
import { requireEmployeeSession } from '@/lib/auth'

/** GET /api/me/employee — return the authenticated user's employee record. */
export async function GET(req: NextRequest) {
  const session = await requireEmployeeSession(req)
  if (!session.ok) {
    if (session.reason === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      {
        error: 'No employee profile',
        detail:
          'This account is not linked to an employee record. Employer accounts use /dashboard; employees must accept an invite and sign in with the payroll wallet on file.',
      },
      { status: 403 }
    )
  }
  return NextResponse.json(session.employee)
}
