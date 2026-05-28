'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface BalanceTickerProps {
  /** Starting balance in USD (sUSDC / ERC-20 human amount) */
  balance: number
  /** USD added per second (from annual salary ÷ seconds per year) */
  ratePerSecond?: number
  currency?: string
  className?: string
}

export function BalanceTicker({ balance, ratePerSecond = 0, currency = 'USD', className }: BalanceTickerProps) {
  const [current, setCurrent] = React.useState(balance)
  const startRef = React.useRef({ balance, timestamp: Date.now() })

  React.useEffect(() => {
    startRef.current = { balance, timestamp: Date.now() }
    setCurrent(balance)
  }, [balance])

  React.useEffect(() => {
    if (ratePerSecond <= 0) return

    const id = setInterval(() => {
      const elapsed = (Date.now() - startRef.current.timestamp) / 1000
      setCurrent(startRef.current.balance + ratePerSecond * elapsed)
    }, 1000)

    return () => clearInterval(id)
  }, [ratePerSecond])

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(current)

  const prefix = currency === 'USD' ? '$' : `${currency} `

  return <span className={cn('font-mono tabular-nums text-[var(--accent)]', className)}>{prefix}{formatted}</span>
}
