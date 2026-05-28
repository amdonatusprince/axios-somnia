import type { NextRequest } from 'next/server'

type RouteCtx = { params: Promise<Record<string, string>> }

type Handler =
  | (() => Promise<Response>)
  | ((req: Request) => Promise<Response>)
  | ((req: NextRequest) => Promise<Response>)
  | ((req: NextRequest, ctx: RouteCtx) => Promise<Response>)

/**
 * No-op payment wrapper (replaces mppx on Tempo).
 * Integrate x402 verification in {@link '@/lib/x402'} when enabling paid routes.
 */
function wrapCharge(_options: { amount: string }) {
  return (handler: Handler) => {
    return async (req: NextRequest, ctx: RouteCtx) => {
      const fn = handler as (...args: unknown[]) => Promise<Response>
      if (fn.length >= 2) {
        return fn(req, ctx) as Promise<Response>
      }
      if (fn.length >= 1) {
        return fn(req) as Promise<Response>
      }
      return fn() as Promise<Response>
    }
  }
}

function wrapSession(_options: { amount: string; unitType: string }) {
  return wrapCharge({ amount: _options.amount })
}

export const mppx = {
  charge: wrapCharge,
  session: wrapSession,
}
