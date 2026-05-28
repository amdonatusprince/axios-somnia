// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IComplianceRegistry} from "./interfaces/IComplianceRegistry.sol";

/// @title ComplianceRegistry
/// @notice Owner-managed deny list per policy. When a policy is active, a wallet is
///         authorized if it is not explicitly blocked.
contract ComplianceRegistry is IComplianceRegistry {
    address public owner;

    mapping(uint64 => bool) public policyActive;
    mapping(uint64 => mapping(address => bool)) public walletBlocked;

    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event PolicyCreated(uint64 indexed policyId);
    event WalletBlockSet(uint64 indexed policyId, address indexed wallet, bool blocked);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Activate a policy id for use by employers (default: no wallets blocked).
    function createPolicy(uint64 policyId) external onlyOwner {
        policyActive[policyId] = true;
        emit PolicyCreated(policyId);
    }

    function setBlocked(uint64 policyId, address wallet, bool blocked) external onlyOwner {
        require(policyActive[policyId], "policy inactive");
        walletBlocked[policyId][wallet] = blocked;
        emit WalletBlockSet(policyId, wallet, blocked);
    }

    /// @inheritdoc IComplianceRegistry
    function isAuthorized(uint64 policyId, address wallet) external view returns (bool) {
        if (!policyActive[policyId]) return true;
        return !walletBlocked[policyId][wallet];
    }
}
