import { SignJWT, jwtVerify } from 'jose'

const textEncoder = new TextEncoder()

function getSecretKey(): Uint8Array {
  const secret =
    process.env.SESSION_JWT_SECRET ??
    process.env.MPP_SECRET_KEY ??
    (process.env.NODE_ENV !== 'production' ? 'dev-insecure-axiosecretkey-minlen!!' : '')
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_JWT_SECRET (or MPP_SECRET_KEY) must be set to at least 16 characters')
  }
  return textEncoder.encode(secret)
}

export async function signSessionJwt(
  sub: string,
  opts?: { wallet?: `0x${string}` }
): Promise<string> {
  const payload =
    opts?.wallet != null ? { wallet: opts.wallet.toLowerCase() as `0x${string}` } : {}
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretKey())
}

export async function verifySessionJwt(token: string): Promise<{ sub: string; wallet?: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (typeof payload.sub !== 'string' || !payload.sub) return null
    const wallet = typeof payload.wallet === 'string' ? payload.wallet : undefined
    return { sub: payload.sub, wallet }
  } catch {
    return null
  }
}
