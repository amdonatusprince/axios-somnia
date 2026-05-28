'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useSignMessage } from 'wagmi'
import { SiweMessage } from 'siwe'
import { somniaTestnet } from '@/lib/wagmi'
import { useAuthStore } from '@/lib/auth-store'
import { AxiosLogo } from '@/components/brand/AxiosLogo'

interface InviteInfo {
  employeeId: string
  email: string
  firstName: string | null
  lastName: string | null
  jobTitle: string | null
  department: string | null
  salaryAmount: number | null
  salaryCurrency: string | null
  payFrequency: string | null
}

type Step = 'loading' | 'invalid' | 'claimed' | 'welcome' | 'claiming' | 'done'

export default function InvitePage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const setBearerToken = useAuthStore((s) => s.setBearerToken)

  const [step, setStep] = React.useState<Step>('loading')
  const [invite, setInvite] = React.useState<InviteInfo | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [authBusy, setAuthBusy] = React.useState(false)

  React.useEffect(() => {
    if (!token) {
      setStep('invalid')
      return
    }
    void verifyToken(token)
  }, [token])

  async function verifyToken(t: string) {
    try {
      const res = await fetch(`/api/invite/${t}`)
      if (res.status === 409) {
        setStep('claimed')
        return
      }
      if (!res.ok) {
        setStep('invalid')
        return
      }
      const data = (await res.json()) as InviteInfo
      setInvite(data)
      setStep('welcome')
    } catch {
      setStep('invalid')
    }
  }

  async function signInThenClaim() {
    if (!address || !token || !invite) return
    setAuthBusy(true)
    setError(null)
    try {
      const nonceRes = await fetch('/api/auth/nonce', { credentials: 'include' })
      if (!nonceRes.ok) throw new Error('Failed to load sign-in nonce')
      const { nonce } = (await nonceRes.json()) as { nonce: string }

      const siwe = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to Axios and accept your payroll invite.',
        uri: window.location.origin,
        version: '1',
        chainId: somniaTestnet.id,
        nonce,
      })
      const message = siwe.prepareMessage()
      const signature = await signMessageAsync({ message })

      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      })
      if (!verifyRes.ok) {
        const err = (await verifyRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? 'Verification failed')
      }
      const { token: jwt } = (await verifyRes.json()) as { token: string }
      setBearerToken(jwt)

      setStep('claiming')
      const res = await fetch(`/api/invite/${token}/claim`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ walletAddress: address }),
      })

      if (res.status === 403) {
        const body = (await res.json()) as { error?: string }
        setError(body.error ?? 'This account cannot claim employee invites.')
        setStep('welcome')
        return
      }

      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? 'Failed to claim invite')
      }

      setStep('done')
      setTimeout(() => router.push('/portal'), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setStep('welcome')
    } finally {
      setAuthBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <AxiosLogo className="mb-10" markClassName="h-7 w-7" labelClassName="text-[var(--text-primary)] text-base" />

        {step === 'loading' && (
          <div className="space-y-3">
            <div className="h-6 w-48 bg-[var(--bg-subtle)] rounded animate-pulse" />
            <div className="h-4 w-full bg-[var(--bg-subtle)] rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-[var(--bg-subtle)] rounded animate-pulse" />
          </div>
        )}

        {step === 'claimed' && (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[var(--status-pending)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11V7m0 8h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.93 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Invite already claimed</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              This invite has already been accepted. Sign in to access your employee portal.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="mt-6 w-full h-11 rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Sign in
            </button>
          </div>
        )}

        {step === 'invalid' && (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[var(--status-error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Invalid invite link</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              This link may have expired or already been used. Contact your employer for a new invite.
            </p>
          </div>
        )}

        {invite && (step === 'welcome' || step === 'claiming') && (
          <>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">
              You&apos;ve been invited to Axios
            </h2>
            <p className="text-[var(--text-secondary)] text-sm mb-8">
              Connect your Somnia testnet wallet and sign in once to link this invite to your wallet address.
            </p>

            <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {invite.email && (
                  <div>
                    <div className="text-[var(--text-muted)] text-xs mb-0.5">Email</div>
                    <div className="text-[var(--text-primary)] font-medium">{invite.email}</div>
                  </div>
                )}
                {invite.jobTitle && (
                  <div>
                    <div className="text-[var(--text-muted)] text-xs mb-0.5">Role</div>
                    <div className="text-[var(--text-primary)] font-medium">{invite.jobTitle}</div>
                  </div>
                )}
                {invite.salaryAmount && (
                  <div>
                    <div className="text-[var(--text-muted)] text-xs mb-0.5">Salary</div>
                    <div className="number-lg text-[var(--text-primary)]">
                      ${invite.salaryAmount.toLocaleString()}{' '}
                      <span className="text-[var(--text-muted)] font-normal text-xs">
                        {invite.salaryCurrency}/{invite.payFrequency}
                      </span>
                    </div>
                  </div>
                )}
                {invite.department && (
                  <div>
                    <div className="text-[var(--text-muted)] text-xs mb-0.5">Department</div>
                    <div className="text-[var(--text-primary)] font-medium">{invite.department}</div>
                  </div>
                )}
              </div>
            </div>

            {step === 'claiming' ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin mx-auto mb-4" />
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Setting up your account</h2>
                <p className="text-sm text-[var(--text-secondary)]">Claiming your invite…</p>
              </div>
            ) : (
              <>
                {error && <p className="text-xs text-[var(--status-error)] mb-4 px-1">{error}</p>}
                <div className="flex flex-col gap-3">
                  <ConnectButton chainStatus="none" showBalance={false} />
                  <button
                    onClick={() => void signInThenClaim()}
                    disabled={!isConnected || !address || authBusy}
                    className="w-full h-11 rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-semibold
                hover:opacity-90 active:opacity-80 transition-opacity
                disabled:opacity-60 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
                  >
                    {authBusy ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      'Sign in & accept invite'
                    )}
                  </button>
                </div>
                <p className="mt-4 text-center text-xs text-[var(--text-muted)]">Somnia testnet · sUSDC payroll</p>
              </>
            )}
          </>
        )}

        {step === 'done' && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">You&apos;re all set!</h2>
            <p className="text-sm text-[var(--text-secondary)]">Redirecting to your portal…</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
