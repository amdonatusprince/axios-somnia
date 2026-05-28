import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'

function isLocalHost(host: string | null | undefined) {
  if (!host) return false
  const hostname = host.split(':')[0]?.toLowerCase()
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]' ||
    hostname === '::1'
  )
}

function normalizeOrigin(raw: string | null): string | undefined {
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    return `${url.protocol}//${url.host}`.replace(/\/$/, '')
  } catch {
    return undefined
  }
}

function resolveAppUrl(host: string | null, proto: string | null): string | undefined {
  if (!host) return undefined
  let p = proto
  if (!p) {
    p = host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https'
  }
  return `${p}://${host}`.replace(/\/$/, '')
}

/**
 * Prefer the incoming request host so generated absolute URLs match the dev port (e.g. :3002).
 * When undefined, callers fall back to NEXT_PUBLIC_APP_URL.
 */
export async function getAppUrlFromRequest(): Promise<string | undefined> {
  const h = await headers()
  const forwardedHost = h.get('x-forwarded-host')
  const host = h.get('host')
  const headerOrigin = normalizeOrigin(h.get('origin')) ?? normalizeOrigin(h.get('referer'))

  if (headerOrigin && isLocalHost(forwardedHost ?? host)) {
    return headerOrigin
  }

  return resolveAppUrl(forwardedHost ?? host, h.get('x-forwarded-proto')) ?? headerOrigin
}

/** Same as getAppUrlFromRequest for Route Handlers (no `headers()` from next/headers). */
export function getAppUrlFromNextRequest(req: NextRequest): string | undefined {
  const forwardedHost = req.headers.get('x-forwarded-host')
  const host = req.headers.get('host')
  const headerOrigin = normalizeOrigin(req.headers.get('origin')) ?? normalizeOrigin(req.headers.get('referer'))

  if (headerOrigin && isLocalHost(forwardedHost ?? host)) {
    return headerOrigin
  }

  return resolveAppUrl(forwardedHost ?? host, req.headers.get('x-forwarded-proto')) ?? headerOrigin
}
