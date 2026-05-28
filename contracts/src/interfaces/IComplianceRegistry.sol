// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice On-chain compliance gate (replaces Tempo TIP-403 precompile for Somnia).
interface IComplianceRegistry {
    function isAuthorized(uint64 policyId, address wallet) external view returns (bool);
}
