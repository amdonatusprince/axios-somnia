'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useSignMessage } from 'wagmi'
import { SiweMessage } from 'siwe'
import { somniaTestnet } from '@/lib/wagmi'
import { useAuthStore } from '@/lib/auth-store'
import { AxiosLogo } from '@/components/brand/AxiosLogo'

const STATS = [
  { value: '0.4s', label: 'settlement time' },
  { value: '$0.01', label: 'per transaction' },
  { value: '47+', label: 'countries supported' },
]

const FEATURES = [
  'Pay globally',
  'Settle in 0.5s',
  'Earn yield',
]

function ClientLoginContent() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const setBearerToken = useAuthStore((s) => s.setBearerToken)
  const [authError, setAuthError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const handleSiwe = async () => {
    if (!address) return
    setAuthError(null)
    setBusy(true)
    try {
      const nonceRes = await fetch('/api/auth/nonce', { credentials: 'include' })
      if (!nonceRes.ok) throw new Error('Failed to load sign-in nonce')
      const { nonce } = (await nonceRes.json()) as { nonce: string }

      const siwe = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to Axios.',
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
      const { token } = (await verifyRes.json()) as { token: string }
      setBearerToken(token)
      router.push('/dashboard')
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  const visibleError = authError

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex">
      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 bg-[var(--bg-surface)] border-r border-[var(--border-default)] relative overflow-hidden">
        {/* Mesh background */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20"
            style={{
              background:
                'radial-gradient(circle at center, var(--accent) 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-10"
            style={{
              background:
                'radial-gradient(circle at center, var(--mono) 0%, transparent 70%)',
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative z-10"
        >
          <AxiosLogo
            className="gap-2.5"
            markClassName="h-8 w-8"
            labelClassName="text-[var(--text-primary)] text-lg tracking-tight"
          />
        </motion.div>

        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <p className="text-xs font-mono text-[var(--accent)] tracking-widest uppercase mb-4">
              Payroll for the onchain era
            </p>
            <h1 className="text-[2.5rem] leading-[1.1] font-bold text-[var(--text-primary)] tracking-tight mb-6">
              Pay anyone,{' '}
              <span className="text-[var(--accent)]">anywhere</span>,{' '}
              in seconds.
            </h1>
            <p className="text-[var(--text-secondary)] text-base leading-relaxed max-w-sm">
              AI-native payroll infrastructure on Tempo. Compliance screening,
              gas sponsorship, and salary streaming — fully abstracted from your team.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-10 grid grid-cols-3 gap-4"
          >
            {STATS.map((stat) => (
              <div key={stat.label} className="p-4 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-default)]">
                <div className="number-xl text-[var(--text-primary)]">{stat.value}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{stat.label}</div>
              </div>
            ))}
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-8 space-y-3"
          >
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                <svg className="w-4 h-4 mt-0.5 shrink-0 text-[var(--accent)]" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                </svg>
                {feature}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="relative z-10 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-overlay)] p-4"
        >
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            “We funded treasury, ran payroll, and our team saw funds almost instantly.”
          </p>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Demo employer · Tempo × Stripe HIIT
          </p>
        </motion.div>
      </div>

      {/* Right — auth panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <AxiosLogo
            className="lg:hidden mb-10"
            markClassName="h-7 w-7"
            labelClassName="text-[var(--text-primary)] text-base"
          />

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
              Connect a Somnia testnet wallet, then sign the message to continue.
            </p>
          </div>

          <div className="flex w-full justify-center">
            <ConnectButton />
          </div>

          <button
            type="button"
            onClick={() => void handleSiwe()}
            disabled={!isConnected || !address || busy}
            className="mt-6 w-full h-11 rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-semibold tracking-tight
              hover:opacity-90 active:opacity-80 transition-opacity
              disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Signing…
              </>
            ) : (
              'Sign message & continue'
            )}
          </button>

          {visibleError ? (
            <p className="mt-4 text-center text-xs text-[var(--status-error)] leading-relaxed">
              {visibleError}
            </p>
          ) : null}

          <p className="mt-8 text-center text-xs text-[var(--text-muted)] leading-relaxed">
            By continuing, you agree to Axios&apos;s{' '}
            <Link href="/legal/terms" className="text-[var(--accent)] hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy" className="text-[var(--accent)] hover:underline">
              Privacy Policy
            </Link>
          </p>

          <div className="mt-8 pt-6 border-t border-[var(--border-default)]">
            <p className="text-center text-xs text-[var(--text-muted)]">
              New to Axios?{' '}
              <a href="/register" className="text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] transition-colors">
                Start free →
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Defer client-only wallet UI until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <span className="w-6 h-6 rounded-full border-2 border-[var(--text-muted)] border-t-[var(--accent)] animate-spin" />
      </div>
    )
  }

  return <ClientLoginContent />
}
