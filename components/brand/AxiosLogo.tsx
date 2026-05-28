import * as React from 'react'
import { cn } from '@/lib/utils'

interface AxiosMarkProps extends React.SVGProps<SVGSVGElement> {}

/** Rounded-square mark with an “A” monogram (Axios), emerald accents on deep slate. */
export function AxiosMark({ className, ...props }: AxiosMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
      {...props}
    >
      <rect x="1" y="1" width="30" height="30" rx="10" fill="#0B1220" />
      <rect x="1.5" y="1.5" width="29" height="29" rx="9.5" stroke="#1E293B" />
      <circle cx="24.5" cy="8.5" r="7" fill="#34D399" fillOpacity="0.14" />
      <circle cx="10" cy="24.5" r="6.5" fill="#059669" fillOpacity="0.2" />
      {/* Letter A — two legs + crossbar, geometric sans */}
      <path
        d="M8.5 24L16 6.75L23.5 24"
        stroke="#FFFFFF"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.75 17.25H20.25"
        stroke="#FFFFFF"
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <circle cx="16" cy="6.75" r="1.35" fill="#34D399" />
    </svg>
  )
}

interface AxiosLogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  showWordmark?: boolean
  markClassName?: string
  labelClassName?: string
}

export function AxiosLogo({
  className,
  showWordmark = true,
  markClassName,
  labelClassName,
  ...props
}: AxiosLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} {...props}>
      <AxiosMark className={cn('h-7 w-7', markClassName)} />
      {showWordmark ? (
        <span className={cn('font-semibold tracking-tight', labelClassName)}>Axios</span>
      ) : null}
    </span>
  )
}
