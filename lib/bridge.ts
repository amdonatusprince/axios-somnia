/**
 * lib/bridge.ts — Bridge API client wrapper.
 * All Bridge calls must go through this module. Never call Bridge directly from components.
 *
 * Real Bridge base URLs (enable when BRIDGE_MOCK is not true and BRIDGE_API_KEY is set):
 *   Production: https://api.bridge.xyz/v0
 *   Sandbox:    https://api.sandbox.bridge.xyz/v0
 */

// ─── Re-enable real Bridge later: uncomment and wire BRIDGE_BASE in bridgeRequest ─────
// const BRIDGE_PRODUCTION = 'https://api.bridge.xyz/v0'
// const BRIDGE_SANDBOX = 'https://api.sandbox.bridge.xyz/v0'
// const BRIDGE_BASE =
//   process.env.NODE_ENV === 'production' ? BRIDGE_PRODUCTION : BRIDGE_SANDBOX

/**
 * When true, no outbound calls to Bridge; use deterministic mock responses.
 *
 * - `BRIDGE_MOCK=true` / `1` → always mock
 * - `BRIDGE_MOCK=false` / `0` → never mock (needs valid `BRIDGE_API_KEY` unless you like 401s)
 * - Unset: in **development**, default to mock so placeholder keys don’t hit real Bridge. Set
 *   `BRIDGE_USE_REAL_BRIDGE=true` when you want the sandbox API with a real key on localhost.
 * - **production**: defaults to real Bridge (mock only if `BRIDGE_MOCK=true`).
 */
export function isBridgeMock(): boolean {
  if (process.env.BRIDGE_MOCK === 'true' || process.env.BRIDGE_MOCK === '1') return true
  if (process.env.BRIDGE_MOCK === 'false' || process.env.BRIDGE_MOCK === '0') return false
  if (process.env.NODE_ENV === 'development' && process.env.BRIDGE_USE_REAL_BRIDGE !== 'true') {
    return true
  }
  return false
}

function getAppOrigin(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (!url) {
    throw new Error('NEXT_PUBLIC_APP_URL is not set')
  }
  return url.replace(/\/$/, '')
}

function shortIdFromString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(16).padStart(8, 'f').slice(0, 16)
}

function mockBridgeResponse(path: string, options?: RequestInit): unknown {
  const method = (options?.method ?? 'GET').toUpperCase()
  if (method !== 'POST') {
    throw new Error(`Bridge mock: unsupported ${method} ${path}`)
  }

  let body: Record<string, unknown> = {}
  if (options?.body && typeof options.body === 'string') {
    try {
      body = JSON.parse(options.body) as Record<string, unknown>
    } catch {
      body = {}
    }
  }

  if (path === '/customers') {
    const email = String(body.email ?? 'mock@example.com')
    const type = body.type === 'business' ? 'business' : 'individual'
    const id =
      type === 'business' ? `mock_cust_biz_${shortIdFromString(email)}` : `mock_cust_${shortIdFromString(email)}`
    return {
      id,
      type,
      status: 'active',
      email,
    }
  }

  if (path === '/kyc_links') {
    const redirectUri = String(body.redirect_uri ?? '')
    // Match `/bridge-mock` host to redirect_uri so dev port in employee-onboarding matches this URL
    let mockBase = getAppOrigin()
    if (redirectUri) {
      try {
        mockBase = new URL(redirectUri).origin
      } catch {
        /* keep getAppOrigin */
      }
    }
    const mockUrl = `${mockBase}/bridge-mock?redirect=${encodeURIComponent(redirectUri)}`
    return { url: mockUrl }
  }

  const vaMatch = path.match(/^\/customers\/([^/]+)\/virtual_accounts$/)
  if (vaMatch) {
    const [, customerId] = vaMatch
    return {
      id: `mock_va_${customerId?.slice(0, 8) ?? '1'}`,
      account_number: '990000000001',
      routing_number: '110000000',
      bank_name: 'Mock Bridge Bank (simulated)',
    }
  }

  const cardMatch = path.match(/^\/customers\/([^/]+)\/card_accounts$/)
  if (cardMatch) {
    const [, customerId] = cardMatch
    return {
      id: `mock_card_${customerId?.slice(0, 8) ?? '1'}`,
      card_number_last4: '4242',
      expiration_month: 12,
      expiration_year: 2030,
      status: 'active',
    }
  }

  if (path === '/transfers') {
    const amount = String(body.amount ?? '0')
    const currency = String(body.currency ?? 'usd')
    return {
      id: `mock_tx_${Date.now()}`,
      status: 'completed',
      amount,
      currency,
      created_at: new Date().toISOString(),
    }
  }

  throw new Error(`Bridge mock: unhandled path ${path}`)
}

export async function bridgeRequest<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  if (isBridgeMock()) {
    return mockBridgeResponse(path, options) as T
  }

  const BRIDGE_BASE =
    process.env.NODE_ENV === 'production'
      ? 'https://api.bridge.xyz/v0'
      : 'https://api.sandbox.bridge.xyz/v0'

  const apiKey = process.env.BRIDGE_API_KEY
  if (!apiKey) {
    throw new Error('BRIDGE_API_KEY is required when BRIDGE_MOCK is not enabled')
  }

  const res = await fetch(`${BRIDGE_BASE}${path}`, {
    ...options,
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Bridge API ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

// ── Employer KYB ──────────────────────────────────────────────────────────────

export interface BridgeCustomer {
  id: string
  type: 'individual' | 'business'
  status: string
  email: string
}

export async function createEmployerCustomer(opts: {
  companyName: string
  email: string
  idempotencyKey: string
}): Promise<BridgeCustomer> {
  return bridgeRequest<BridgeCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({ type: 'business', company_name: opts.companyName, email: opts.email }),
    headers: { 'Idempotency-Key': opts.idempotencyKey },
  })
}

// ── Virtual Account (deposit) ─────────────────────────────────────────────────

export interface BridgeVirtualAccount {
  id: string
  account_number: string
  routing_number: string
  bank_name: string
  swift_bic?: string
}

export async function createVirtualAccount(opts: {
  customerId: string
  currency: string
  idempotencyKey: string
}): Promise<BridgeVirtualAccount> {
  return bridgeRequest<BridgeVirtualAccount>(
    `/customers/${opts.customerId}/virtual_accounts`,
    {
      method: 'POST',
      body: JSON.stringify({ currency: opts.currency, destination: 'usdb' }),
      headers: { 'Idempotency-Key': opts.idempotencyKey },
    }
  )
}

// ── Visa Card issuance ────────────────────────────────────────────────────────

export interface BridgeCardAccount {
  id: string
  card_number_last4: string
  expiration_month: number
  expiration_year: number
  status: string
}

export async function issueCard(opts: {
  customerId: string
  idempotencyKey: string
}): Promise<BridgeCardAccount> {
  return bridgeRequest<BridgeCardAccount>(
    `/customers/${opts.customerId}/card_accounts`,
    {
      method: 'POST',
      body: JSON.stringify({ card_type: 'prepaid_debit', currency: 'usd' }),
      headers: { 'Idempotency-Key': opts.idempotencyKey },
    }
  )
}

// ── Off-ramp transfer ─────────────────────────────────────────────────────────

export interface BridgeTransfer {
  id: string
  status: string
  amount: string
  currency: string
  created_at: string
}

export async function createOffRampTransfer(opts: {
  customerId: string
  amount: string
  currency: string
  destinationType: 'ach' | 'sepa' | 'spei' | 'pix'
  bankAccountId: string
  idempotencyKey: string
}): Promise<BridgeTransfer> {
  return bridgeRequest<BridgeTransfer>('/transfers', {
    method: 'POST',
    body: JSON.stringify({
      customer_id: opts.customerId,
      amount: opts.amount,
      currency: opts.currency,
      source: { payment_rail: 'bridge_wallet' },
      destination: {
        payment_rail: opts.destinationType,
        bank_account_id: opts.bankAccountId,
      },
    }),
    headers: { 'Idempotency-Key': opts.idempotencyKey },
  })
}
