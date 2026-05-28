# Axios


Axios is a borderless enterprise payroll on Somnia testnet with x402 integrated machine payments

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
| Wallets | RainbowKit + wagmi + viem (Somnia testnet); `@mezo-org/passport` removed for Next 15 / webpack compatibility |
| Agent signing | Vincent / Lit Protocol PKPs (optional) |
| Frontend | Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui |
| Database | Supabase (PostgreSQL, RLS) |
| Auth | SIWE + `SESSION_JWT_SECRET`, httpOnly `axios-token` cookie |

## MPP endpoints

See route files under `app/api/mpp/`. Charges are defined in comments per route; the current `mppx` helper passes requests through for local development.

## Smart contracts

Deploy with Foundry from `contracts/` (set `DEPLOYER_PRIVATE_KEY`, use Somnia RPC). After deploy, copy addresses into `.env.local`.

```bash
cd contracts
forge build
forge script script/Deploy.s.sol --broadcast --rpc-url https://dream-rpc.somnia.network/
```

Use the [Somnia faucet](https://testnet.somnia.network/) for testnet STT (gas).

## Local development

```bash
pnpm install
cp .env.local.example .env.local
# fill in env vars
pnpm dev
```

## Demo agent

```bash
npx ts-node scripts/demo-agent.ts
```

The script calls public MPP endpoints against `NEXT_PUBLIC_APP_URL` (default `http://localhost:3000`). MPP payment headers are optional while the server uses the no-op payment shim.

Set `LIT_USAGE_KEY` and `VINCENT_PKP_ETH_ADDRESS` to activate live PKP signing in step 1b. Without them, the step runs in stub mode.

To provision Vincent's env vars:

```bash
DELEGATEE_PRIVATE_KEY=0x... npx ts-node scripts/setup-vincent.ts
```

See `VINCENT_SETUP.md` for the full setup flow.

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Public app origin. |
| `NEXT_PUBLIC_SOMNIA_RPC` | Somnia testnet RPC (defaults in `lib/constants.ts` if unset). |
| `NEXT_PUBLIC_SOMNIA_CHAIN_ID` | `50312` for testnet. |
| `NEXT_PUBLIC_SUSDC_ADDRESS` | sUSDC token address. |
| `NEXT_PUBLIC_COMPLIANCE_REGISTRY` | Deployed ComplianceRegistry. |
| `NEXT_PUBLIC_PAYROLL_*` | Deployed protocol contract addresses. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project id for RainbowKit. |
| `SESSION_JWT_SECRET` | Server-only HS256 secret for session JWTs. |
| `SUPABASE_SERVICE_KEY` | Server-only Supabase service role. |
| `BRIDGE_API_KEY` / `BRIDGE_WEBHOOK_SECRET` | Bridge integration. |
| `AXIOS_TREASURY_ADDRESS` | Fee recipient for x402 discovery (`REMLO_TREASURY_ADDRESS` still accepted). |
| `AXIOS_AGENT_PRIVATE_KEY` | Server agent for demo/on-chain calls (`REMLO_AGENT_PRIVATE_KEY` still accepted). |
| `ADMIN_USER_IDS` | Comma-separated subs allowed for `/admin`. |
| `DEPLOYER_PRIVATE_KEY` | Contract deployment key. |
| `LIT_API_KEY` / `LIT_USAGE_KEY` / `VINCENT_PKP_ETH_ADDRESS` | Optional Lit / Vincent signing. |

Ensure `employers.employer_admin_wallet` matches the connected wallet used for treasury and payroll signing.
