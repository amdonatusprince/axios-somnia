'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, useWalletClient } from 'wagmi'
import { encodeFunctionData, keccak256, encodePacked } from 'viem'
import { Loader2, ArrowDownToLine, CheckCircle2, AlertCircle, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { publicClient } from '@/lib/contracts'
import { somniaTestnet } from '@/lib/wagmi'
import { SOMNIA_EXPLORER_URL, PAYROLL_TREASURY_ADDRESS } from '@/lib/constants'
import { formatSusdcUnits, susdcToUnits } from '@/lib/susdc'
import { PayrollTreasuryABI } from '@/lib/abis/PayrollTreasury'
import type { Database } from '@/lib/database.types'

type Employer = Database['public']['Tables']['employers']['Row']

function employerAccountId(signer: `0x${string}`): `0x${string}` {
  return keccak256(encodePacked(['address'], [signer]))
}

type WithdrawStatus = 'idle' | 'withdrawing' | 'success'

interface Props {
  employer: Employer
}

export function OnChainWithdrawWidget({ employer }: Props) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient({ chainId: somniaTestnet.id })
  const queryClient = useQueryClient()

  const [amount, setAmount] = React.useState('')
  const [status, setStatus] = React.useState<WithdrawStatus>('idle')
  const [error, setError] = React.useState<string | null>(null)
  const [withdrawTx, setWithdrawTx] = React.useState<`0x${string}` | null>(null)
  const [lastWithdrawWei, setLastWithdrawWei] = React.useState<bigint | null>(null)
  const [availableWei, setAvailableWei] = React.useState<bigint | null>(null)
  const [lockedWei, setLockedWei] = React.useState<bigint | null>(null)

  const signerAddress = address ?? null
  const adminWallet = employer.employer_admin_wallet

  const refreshBalances = React.useCallback(async () => {
    if (!signerAddress) {
      setAvailableWei(null)
      setLockedWei(null)
      return
    }
    const id = employerAccountId(signerAddress)
    try {
      const [a, l] = await Promise.all([
        publicClient.readContract({
          address: PAYROLL_TREASURY_ADDRESS,
          abi: PayrollTreasuryABI,
          functionName: 'getAvailableBalance',
          args: [id],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: PAYROLL_TREASURY_ADDRESS,
          abi: PayrollTreasuryABI,
          functionName: 'getLockedBalance',
          args: [id],
        }) as Promise<bigint>,
      ])
      setAvailableWei(a)
      setLockedWei(l)
    } catch {
      setAvailableWei(null)
      setLockedWei(null)
    }
  }, [signerAddress])

  React.useEffect(() => {
    void refreshBalances()
  }, [refreshBalances])

  async function handleWithdraw() {
    if (!signerAddress || !walletClient) return
    const trimmed = amount.trim()
    if (!trimmed) return

    let amountWei: bigint
    try {
      amountWei = susdcToUnits(trimmed)
    } catch {
      setError('Enter a valid amount (e.g. 100 or 99.50).')
      return
    }
    if (amountWei <= 0n) return
    if (availableWei !== null && amountWei > availableWei) {
      setError('Amount exceeds available treasury balance.')
      return
    }

    setError(null)
    setWithdrawTx(null)
    setLastWithdrawWei(null)

    try {
      setStatus('withdrawing')
      const data = encodeFunctionData({
        abi: PayrollTreasuryABI,
        functionName: 'withdraw',
        args: [amountWei],
      })
      const hash = await walletClient.sendTransaction({
        account: signerAddress,
        chain: somniaTestnet,
        to: PAYROLL_TREASURY_ADDRESS,
        data,
      })
      setWithdrawTx(hash)
      await publicClient.waitForTransactionReceipt({ hash })

      setLastWithdrawWei(amountWei)
      setStatus('success')
      void queryClient.invalidateQueries({ queryKey: ['treasury'] })
      void refreshBalances()
    } catch (err) {
      setStatus('idle')
      setError(err instanceof Error ? err.message : 'Transaction failed. Please try again.')
    }
  }

  const availableUsdStr =
    availableWei !== null ? formatSusdcUnits(availableWei) : null
  const amountWeiParsed = React.useMemo(() => {
    const t = amount.trim()
    if (!t) return null
    try {
      const w = susdcToUnits(t)
      return w > 0n ? w : null
    } catch {
      return null
    }
  }, [amount])

  const hasInsufficient =
    availableWei !== null && amountWeiParsed !== null && amountWeiParsed > availableWei
  const canWithdraw =
    isConnected &&
    status !== 'withdrawing' &&
    status !== 'success' &&
    amountWeiParsed !== null &&
    Boolean(walletClient) &&
    !hasInsufficient &&
    (availableWei === null || availableWei > 0n)

  if (status === 'success') {
    return (
      <div className="rounded-xl border border-[var(--status-success)] bg-[var(--bg-subtle)] p-5 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-[var(--status-success)] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--text-primary)]">Withdrawal confirmed</p>
          <p className="text-xs text-[var(--text-muted)]">
            {lastWithdrawWei != null
              ? `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Number(formatSusdcUnits(lastWithdrawWei)))} sUSDC sent to your wallet.`
              : 'sUSDC sent to your wallet.'}
          </p>
          {withdrawTx && (
            <a
              href={`${SOMNIA_EXPLORER_URL}/tx/${withdrawTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-[var(--accent)] hover:underline"
            >
              View on explorer ↗
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              setStatus('idle')
              setAmount('')
              setWithdrawTx(null)
              setLastWithdrawWei(null)
            }}
            className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Withdraw again →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-[var(--text-muted)]">
        Pull <strong>available</strong> sUSDC from PayrollTreasury to the wallet that signs (your employer admin). Locked
        funds from an in-flight payroll batch cannot be withdrawn until that run completes or unlocks. Requires a treasury
        contract that includes the <code className="text-[11px]">withdraw</code> function — redeploy if your deployment
        predates this feature.
      </p>

      {signerAddress ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-subtle)]">
          <Wallet className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
          <p className="flex-1 min-w-0 text-xs font-mono text-[var(--text-secondary)] truncate">{signerAddress}</p>
          {availableUsdStr !== null && (
            <span className="text-xs text-[var(--text-muted)] shrink-0 font-mono tabular-nums">
              {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(
                Number(availableUsdStr),
              )}{' '}
              avail.
            </span>
          )}
        </div>
      ) : (
        <div className="px-3 py-2 rounded-lg bg-[var(--bg-subtle)] text-xs text-[var(--text-muted)]">
          Connect your Somnia employer wallet to withdraw.
        </div>
      )}

      {lockedWei !== null && lockedWei > 0n && (
        <p className="text-xs text-[var(--text-secondary)]">
          Locked for payroll:{' '}
          <span className="font-mono tabular-nums">
            {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(
              Number(formatSusdcUnits(lockedWei)),
            )}{' '}
            sUSDC
          </span>{' '}
          (not withdrawable yet)
        </p>
      )}

      <div className="space-y-1.5">
        <label className="text-xs text-[var(--text-muted)]">Amount to withdraw (sUSDC)</label>
        <div
          className={cn(
            'flex items-center gap-2 h-10 px-3 rounded-lg border bg-[var(--bg-base)] transition-colors',
            'focus-within:border-[var(--accent)]',
            hasInsufficient ? 'border-[var(--status-error)]' : 'border-[var(--border-default)]',
          )}
        >
          <span className="text-sm text-[var(--text-muted)]">$</span>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={status === 'withdrawing'}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] focus:outline-none min-w-0"
          />
          <span className="text-xs text-[var(--text-muted)] shrink-0">sUSDC</span>
        </div>
        {availableWei !== null && availableWei > 0n && (
          <button
            type="button"
            onClick={() => setAmount(formatSusdcUnits(availableWei))}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Withdraw max ({formatSusdcUnits(availableWei)} sUSDC)
          </button>
        )}
        {hasInsufficient && availableUsdStr !== null && (
          <p className="text-xs text-[var(--status-error)]">
            Exceeds available ({availableUsdStr} sUSDC in treasury for this wallet)
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--status-error)] px-3 py-2.5">
          <AlertCircle className="h-4 w-4 text-[var(--status-error)] shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--status-error)]">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          void handleWithdraw()
        }}
        disabled={!canWithdraw}
        className={cn(
          'w-full flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium transition-colors',
          canWithdraw
            ? 'bg-[var(--bg-base)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
            : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] cursor-not-allowed',
        )}
      >
        {status === 'withdrawing' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Withdrawing…
          </>
        ) : (
          <>
            <ArrowDownToLine className="h-4 w-4" />
            Withdraw to wallet
          </>
        )}
      </button>

      {adminWallet && signerAddress && adminWallet.toLowerCase() !== signerAddress.toLowerCase() && (
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          Saved admin in settings: <span className="font-mono">{adminWallet.slice(0, 6)}…</span>. On-chain balance is
          keyed by the <strong>connected</strong> wallet; use the same address you used to deposit, or you may see $0
          available.
        </p>
      )}
    </div>
  )
}
