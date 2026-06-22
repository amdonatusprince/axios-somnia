# Axios


Axios is a borderless enterprise payroll on the Somnia testnet with x402 integrated machine payments

# Submission Resources
Link to Presentation: https://drive.google.com/file/d/1sR3dscVXEL7bLOG87fLT7sPWDj24a3xj/view?usp=sharing

Link to Demo Video: https://youtu.be/DQ6Ilbq-hws

Live Demo Link: https://axios-mezo.up.railway.app/

## What it does

Axios runs payroll through Foundry-deployed contracts (`PayrollTreasury`, `PayrollBatcher`, `EmployeeRegistry`, `StreamVesting`, `YieldRouter`) using standard **ERC-20** transfers and fixed memos. Compliance checks use the on-chain **ComplianceRegistry**. Programmatic access uses `/api/mpp/*` routes; payment middleware is a **no-op shim** in `lib/mpp.ts` today—wire **x402** verification there for paid calls.

## Architecture

| Layer | Technology |
|-------|-----------|
| Chain | Somnia testnet (chain ID **50312**) |
| Stablecoin | sUSDC (6 decimals — deploy via `pnpm run contracts:deploy:somnia`) |
| Compliance | `ComplianceRegistry` (owner-managed allow/block) |
| Machine payments | MPP route handlers + `/.well-known/x402` discovery |
| Fiat rails | Stripe Bridge API (where enabled) |
| Wallets | RainbowKit + wagmi + viem (Somnia testnet) |
| Agent signing | Vincent / Lit Protocol PKPs (optional) |
| Frontend | Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui |
| Database | Supabase (PostgreSQL, RLS) |
| Auth | SIWE + `SESSION_JWT_SECRET`, httpOnly `axios-token` 

