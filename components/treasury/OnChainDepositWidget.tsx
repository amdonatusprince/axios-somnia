'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, useWalletClient } from 'wagmi'
import { encodeFunctionData } from 'viem'
import { Loader2, ArrowRight, CheckCircle2, AlertCircle, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { publicClient } from '@/lib/contracts'
import { mezoTestnet } from '@/lib/wagmi'
import { MEZO_EXPLORER_URL, MUSD_ADDRESS, PAYROLL_TREASURY_ADDRESS } from '@/lib/constants'
import { formatMusdUnits, musdToUnits } from '@/lib/musd'
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
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient({ chainId: mezoTestnet.id })
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

  React.useEffect(() => {
    if (!signerAddress) return
    let cancelled = false
    publicClient
      .readContract({
        address: MUSD_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [signerAddress],
      })
      .then((bal) => {
        if (!cancelled) setWalletBalance(bal as bigint)
      })
      .catch(() => {
        if (!cancelled) setWalletBalance(null)
      })
    return () => {
      cancelled = true
    }
  }, [signerAddress])

  async function handleDeposit() {
    if (!signerAddress || !walletClient) return
    const trimmed = amount.trim()
    if (!trimmed) return

    let amountWei: bigint
    try {
      amountWei = musdToUnits(trimmed)
    } catch {
      setError('Enter a valid amount (e.g. 100 or 99.50).')
      return
    }
    if (amountWei <= 0n) return
    if (walletBalance !== null && amountWei > walletBalance) {
      setError('Insufficient MUSD balance in this wallet.')
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
      const approveHash = await walletClient.sendTransaction({
        account: signerAddress,
        chain: mezoTestnet,
        to: MUSD_ADDRESS,
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
      const depositHash = await walletClient.sendTransaction({
        account: signerAddress,
        chain: mezoTestnet,
        to: PAYROLL_TREASURY_ADDRESS,
        data: depositData,
      })
      setDepositTx(depositHash)
      await publicClient.waitForTransactionReceipt({ hash: depositHash })

      setLastDepositWei(amountWei)
      setStatus('success')
      void queryClient.invalidateQueries({ queryKey: ['treasury'] })
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
      const w = musdToUnits(t)
      return w > 0n ? w : null
    } catch {
      return null
    }
  }, [amount])

  const walletBalanceUsdStr =
    walletBalance !== null ? formatMusdUnits(walletBalance) : null
  const hasInsufficientBalance =
    walletBalance !== null &&
    amountWeiParsed !== null &&
    amountWeiParsed > walletBalance
  const canDeposit =
    isConnected &&
    !isLoading &&
    status !== 'success' &&
    amountWeiParsed !== null &&
    Boolean(walletClient) &&
    !hasInsufficientBalance

  if (status === 'success') {
    return (
      <div className="rounded-xl border border-[var(--status-success)] bg-[var(--bg-subtle)] p-5 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-[var(--status-success)] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--text-primary)]">Deposit confirmed</p>
          <p className="text-xs text-[var(--text-muted)]">
            {lastDepositWei != null
              ? `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 18 }).format(Number(formatMusdUnits(lastDepositWei)))} MUSD deposited. Your payroll balance will update shortly.`
              : 'Deposit confirmed. Your payroll balance will update shortly.'}
          </p>
          {depositTx && (
            <a
              href={`${MEZO_EXPLORER_URL}/tx/${depositTx}`}
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
          {walletBalanceUsdStr !== null && (
            <span className="text-xs text-[var(--text-muted)] shrink-0 font-mono tabular-nums">
              {new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 18,
              }).format(Number(walletBalanceUsdStr))}{' '}
              MUSD
            </span>
          )}
        </div>
      ) : (
        <div className="px-3 py-2 rounded-lg bg-[var(--bg-subtle)] text-xs text-[var(--text-muted)]">
          Connect your Mezo wallet to deposit MUSD into treasury.
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
        <label className="text-xs text-[var(--text-muted)]">Amount (MUSD)</label>
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
          <span className="text-xs text-[var(--text-muted)] shrink-0">MUSD</span>
        </div>
        {hasInsufficientBalance && walletBalanceUsdStr !== null && (
          <p className="text-xs text-[var(--status-error)]">
            Insufficient balance (
            {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 18 }).format(
              Number(walletBalanceUsdStr),
            )}{' '}
            MUSD available)
          </p>
        )}
      </div>

      {(status === 'approving' || status === 'depositing' || approveTx) && (
        <div className="space-y-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
          <DepositStep
            index={1}
            label="Approve MUSD"
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

      <button
        onClick={() => {
          void handleDeposit()
        }}
        disabled={!canDeposit}
        className={cn(
          'w-full flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium transition-colors',
          canDeposit ? 'bg-[var(--accent)] text-white hover:opacity-90' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] cursor-not-allowed',
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
            href={`${MEZO_EXPLORER_URL}/tx/${txHash}`}
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
