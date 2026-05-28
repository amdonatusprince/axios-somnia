#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS="$ROOT/contracts"
RPC="${SOMNIA_RPC_URL:-https://dream-rpc.somnia.network/}"
GAS_LIMIT="${SOMNIA_DEPLOY_GAS_LIMIT:-10000000}"

if [[ -z "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
  echo "DEPLOYER_PRIVATE_KEY is required (0x-prefixed hex)." >&2
  exit 1
fi

if [[ "${DEPLOYER_PRIVATE_KEY}" != 0x* ]]; then
  DEPLOYER_PRIVATE_KEY="0x${DEPLOYER_PRIVATE_KEY}"
fi

DEPLOYER="$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")"
echo "Deployer: $DEPLOYER"
echo "RPC: $RPC"

deploy() {
  local path="$1"
  local name="$2"
  shift 2
  forge create "$path:$name" \
    --rpc-url "$RPC" \
    --private-key "$DEPLOYER_PRIVATE_KEY" \
    --legacy \
    --broadcast \
    --gas-limit "$GAS_LIMIT" \
    "$@" 2>&1 | awk '/Deployed to:/ { print $3; exit }'
}

cd "$CONTRACTS"

echo "Deploying sUSDC..."
SUSDC="$(deploy src/sUSDC.sol sUSDC)"
echo "sUSDC=$SUSDC"

echo "Minting 1,000,000 sUSDC to deployer..."
cast send "$SUSDC" "mint(address,uint256)" "$DEPLOYER" 1000000000000 \
  --rpc-url "$RPC" --private-key "$DEPLOYER_PRIVATE_KEY" --legacy >/dev/null

echo "Deploying ComplianceRegistry..."
COMPLIANCE="$(deploy src/ComplianceRegistry.sol ComplianceRegistry)"
echo "ComplianceRegistry=$COMPLIANCE"

echo "Deploying PayrollTreasury..."
TREASURY="$(deploy src/PayrollTreasury.sol PayrollTreasury --constructor-args "$SUSDC")"
echo "PayrollTreasury=$TREASURY"

echo "Deploying PayrollBatcher..."
BATCHER="$(deploy src/PayrollBatcher.sol PayrollBatcher --constructor-args "$SUSDC" "$TREASURY")"
echo "PayrollBatcher=$BATCHER"

echo "Linking batcher on treasury..."
cast send "$TREASURY" "setBatcher(address)" "$BATCHER" \
  --rpc-url "$RPC" --private-key "$DEPLOYER_PRIVATE_KEY" --legacy >/dev/null

echo "Deploying EmployeeRegistry..."
REGISTRY="$(deploy src/EmployeeRegistry.sol EmployeeRegistry --constructor-args "$COMPLIANCE")"
echo "EmployeeRegistry=$REGISTRY"

echo "Deploying StreamVesting..."
VESTING="$(deploy src/StreamVesting.sol StreamVesting --constructor-args "$SUSDC")"
echo "StreamVesting=$VESTING"

echo "Deploying YieldRouter..."
YIELD="$(deploy src/YieldRouter.sol YieldRouter --constructor-args "$SUSDC")"
echo "YieldRouter=$YIELD"

cat <<EOF

=== Deployment Complete ===
NEXT_PUBLIC_SUSDC_ADDRESS=$SUSDC
NEXT_PUBLIC_COMPLIANCE_REGISTRY=$COMPLIANCE
NEXT_PUBLIC_PAYROLL_TREASURY=$TREASURY
NEXT_PUBLIC_PAYROLL_BATCHER=$BATCHER
NEXT_PUBLIC_EMPLOYEE_REGISTRY=$REGISTRY
NEXT_PUBLIC_STREAM_VESTING=$VESTING
NEXT_PUBLIC_YIELD_ROUTER=$YIELD
EOF
