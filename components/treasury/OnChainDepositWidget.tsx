'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { encodeFunctionData } from 'viem'
import { Loader2, ArrowRight, CheckCircle2, AlertCircle, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { publicClient } from '@/lib/contracts'
import { SOMNIA_EXPLORER_URL, SUSDC_ADDRESS, PAYROLL_TREASURY_ADDRESS } from '@/lib/constants'
import { sendInjectedTransaction } from '@/lib/injected-wallet'
import { formatSusdcDisplay, formatSusdcUnits, susdcToUnits } from '@/lib/susdc'
import { refreshTreasuryBalances } from '@/lib/hooks/useOnchainTreasuryBalance'
import { PayrollTreasuryABI } from '@/lib/abis/PayrollTreasury'
import type { Database } from '@/lib/database.types'

type Employer = Database['public']['Tables']['employers']['Row']

const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

type DepositStatus = 'idle' | 'approving' | 'depositing' | 'success'

interface Props {
  employer: Employer
}

export function OnChainDepositWidget({ employer }: Props) {
  const { address } = useAccount()
  const queryClient = useQueryClient()

  const [amount, setAmount] = React.useState('')
  const [status, setStatus] = React.useState<DepositStatus>('idle')
  const [error, setError] = React.useState<string | null>(null)
  const [approveTx, setApproveTx] = React.useState<`0x${string}` | null>(null)
  const [depositTx, setDepositTx] = React.useState<`0x${string}` | null>(null)
  const [walletBalance, setWalletBalance] = React.useState<bigint | null>(null)
  const [lastDepositWei, setLastDepositWei] = React.useState<bigint | null>(null)

  const adminWallet = employer.employer_admin_wallet as `0x${string}` | null
  const signerAddress = address ?? null
  const walletMatchesAdmin =
    Boolean(signerAddress && adminWallet && signerAddress.toLowerCase() === adminWallet.toLowerCase())

  const refreshWalletBalance = React.useCallback(async () => {
    if (!signerAddress) {
      setWalletBalance(null)
      return
    }
    try {
      const bal = (await publicClient.readContract({
        address: SUSDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [signerAddress],
      })) as bigint
      setWalletBalance(bal)
    } catch {
      setWalletBalance(null)
    }
  }, [signerAddress])

  React.useEffect(() => {
    void refreshWalletBalance()
  }, [refreshWalletBalance])

  async function handleDeposit() {
    if (!signerAddress) return
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
    if (walletBalance !== null && amountWei > walletBalance) {
      setError('Insufficient sUSDC balance in this wallet.')
      return
    }

    setError(null)
    setApproveTx(null)
    setDepositTx(null)
    setLastDepositWei(null)

    try {
      setStatus('approving')
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [PAYROLL_TREASURY_ADDRESS, amountWei],
      })
      const approveHash = await sendInjectedTransaction({
        account: signerAddress,
        to: SUSDC_ADDRESS,
        data: approveData,
      })
      setApproveTx(approveHash)
      await publicClient.waitForTransactionReceipt({ hash: approveHash })

      setStatus('depositing')
      const depositData = encodeFunctionData({
        abi: PayrollTreasuryABI,
        functionName: 'deposit',
        args: [amountWei, '0x0000000000000000000000000000000000000000000000000000000000000000'],
      })
      const depositHash = await sendInjectedTransaction({
        account: signerAddress,
        to: PAYROLL_TREASURY_ADDRESS,
        data: depositData,
      })
      setDepositTx(depositHash)
      await publicClient.waitForTransactionReceipt({ hash: depositHash })

      setLastDepositWei(amountWei)
      setStatus('success')
      await refreshTreasuryBalances(queryClient, { employerId: employer.id })
      await refreshWalletBalance()
    } catch (err) {
      setStatus('idle')
      setError(err instanceof Error ? err.message : 'Transaction failed. Please try again.')
    }
  }

  const isLoading = status === 'approving' || status === 'depositing'

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

  const hasInsufficientBalance =
    walletBalance !== null &&
    amountWeiParsed !== null &&
    amountWeiParsed > walletBalance
  const canDeposit =
    Boolean(signerAddress) &&
    !isLoading &&
    status !== 'success' &&
    amountWeiParsed !== null &&
    !hasInsufficientBalance

  const depositBlockedReason = React.useMemo(() => {
    if (!signerAddress) return 'Connect your wallet to deposit.'
    if (!amount.trim()) return 'Enter an amount to deposit.'
    if (amountWeiParsed === null) return 'Enter a valid amount (e.g. 100 or 99.50).'
    if (hasInsufficientBalance) return 'Insufficient sUSDC in this wallet.'
    return null
  }, [signerAddress, amount, amountWeiParsed, hasInsufficientBalance])

  if (status === 'success') {
    return (
      <div className="rounded-xl border border-[var(--status-success)] bg-[var(--bg-subtle)] p-5 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-[var(--status-success)] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--text-primary)]">Deposit confirmed</p>
          <p className="text-xs text-[var(--text-muted)]">
            {lastDepositWei != null
              ? `${formatSusdcDisplay(lastDepositWei)} sUSDC deposited. Treasury available balance updated.`
              : 'Deposit confirmed. Treasury available balance updated.'}
          </p>
          {depositTx && (
            <a
              href={`${SOMNIA_EXPLORER_URL}/tx/${depositTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-[var(--accent)] hover:underline"
            >
              View on explorer ↗
            </a>
          )}
          <button
            onClick={() => {
              setStatus('idle')
              setAmount('')
              setApproveTx(null)
              setDepositTx(null)
              setLastDepositWei(null)
            }}
            className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Deposit more →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {signerAddress ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-subtle)]">
          <Wallet className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
          <p className="flex-1 min-w-0 text-xs font-mono text-[var(--text-secondary)] truncate">{signerAddress}</p>
          {walletBalance !== null && (
            <span className="text-xs text-[var(--text-muted)] shrink-0 tabular-nums">
              {formatSusdcDisplay(walletBalance)} sUSDC
            </span>
          )}
        </div>
      ) : (
        <div className="px-3 py-2 rounded-lg bg-[var(--bg-subtle)] text-xs text-[var(--text-muted)]">
          Connect your Somnia wallet to deposit sUSDC into treasury.
        </div>
      )}

      {adminWallet && signerAddress && !walletMatchesAdmin && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2.5 text-xs text-[var(--text-secondary)] leading-relaxed">
          <p className="font-medium text-[var(--text-primary)]">Wallet differs from saved employer admin</p>
          <p className="mt-1">
            On-chain, the deposit is credited to <strong>whoever signs</strong> (your connected wallet), not the
            contract “owner.” The address in Settings is only a label. To align them, go to{' '}
            <strong>Settings → Sync wallet</strong> after connecting the wallet you want as employer admin. You can
            still deposit with the current wallet — treasury will track that address’s balance.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs text-[var(--text-muted)]">Amount (sUSDC)</label>
        <div
          className={cn(
            'flex items-center gap-2 h-10 px-3 rounded-lg border bg-[var(--bg-base)] transition-colors',
            'focus-within:border-[var(--accent)]',
            hasInsufficientBalance ? 'border-[var(--status-error)]' : 'border-[var(--border-default)]',
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
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] focus:outline-none min-w-0"
          />
          <span className="text-xs text-[var(--text-muted)] shrink-0">sUSDC</span>
        </div>
        {hasInsufficientBalance && walletBalance !== null && (
          <p className="text-xs text-[var(--status-error)]">
            Insufficient balance ({formatSusdcDisplay(walletBalance)} sUSDC available)
          </p>
        )}
      </div>

      {(status === 'approving' || status === 'depositing' || approveTx) && (
        <div className="space-y-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
          <DepositStep
            index={1}
            label="Approve sUSDC"
            sublabel="Allow treasury contract to spend your tokens"
            done={Boolean(approveTx)}
            active={status === 'approving'}
            txHash={approveTx}
          />
          <DepositStep
            index={2}
            label="Deposit to treasury"
            sublabel="Transfer funds to the on-chain treasury contract"
            done={Boolean(depositTx)}
            active={status === 'depositing'}
            txHash={depositTx}
          />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--status-error)] px-3 py-2.5">
          <AlertCircle className="h-4 w-4 text-[var(--status-error)] shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--status-error)]">{error}</p>
        </div>
      )}

      {!canDeposit && depositBlockedReason && !error && (
        <p className="text-xs text-[var(--text-muted)]">{depositBlockedReason}</p>
      )}

      <button
        onClick={() => {
          void handleDeposit()
        }}
        disabled={!canDeposit}
        className={cn(
          'w-full flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium transition-colors',
          canDeposit
            ? 'bg-emerald-800 text-white hover:bg-emerald-700 active:bg-emerald-900'
            : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] cursor-not-allowed',
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {status === 'approving' ? 'Approving…' : 'Depositing…'}
          </>
        ) : (
          <>
            Deposit to treasury
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  )
}

function DepositStep({
  index,
  label,
  sublabel,
  done,
  active,
  txHash,
}: {
  index: number
  label: string
  sublabel: string
  done: boolean
  active: boolean
  txHash: `0x${string}` | null
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          done
            ? 'bg-[var(--status-success)]'
            : active
              ? 'bg-[var(--accent)]'
              : 'bg-[var(--bg-base)] border border-[var(--border-default)]',
        )}
      >
        {done ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
        ) : active ? (
          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
        ) : (
          <span className="text-[10px] font-medium text-[var(--text-muted)]">{index}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-xs font-medium',
            done || active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]',
          )}
        >
          {label}
        </p>
        <p className="text-[11px] text-[var(--text-muted)]">{sublabel}</p>
        {txHash && (
          <a
            href={`${SOMNIA_EXPLORER_URL}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-[var(--accent)] hover:underline"
          >
            {txHash.slice(0, 10)}…{txHash.slice(-6)}
          </a>
        )}
      </div>
    </div>
  )
}
