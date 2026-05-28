// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title PayrollTreasury
/// @notice Holds employer payroll funds. Accepts ERC-20 deposits, tracks per-employer
///         available and locked balances, and releases funds to PayrollBatcher on demand.
///         IMPORTANT: Never uses BALANCE/SELFBALANCE opcodes — all balance tracking is
///         done via explicit accounting against ERC-20 balanceOf().
contract PayrollTreasury {
    struct EmployerAccount {
        uint256 balance;
        uint256 lockedBalance;
        uint256 gasBudget;
        uint64 policyId;
        address admin;
        bool active;
    }

    mapping(bytes32 => EmployerAccount) public employers;

    IERC20 public immutable payToken;

    address public owner;
    address public batcher;

    event Deposited(bytes32 indexed employerId, address indexed sender, uint256 amount, bytes32 memo);
    event Withdrawn(bytes32 indexed employerId, address indexed recipient, uint256 amount);
    event GasFunded(bytes32 indexed employerId, address indexed sender, uint256 amount);
    event BatcherSet(address indexed batcher);
    event Locked(bytes32 indexed employerId, uint256 amount);
    event Released(bytes32 indexed employerId, address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyBatcher() {
        require(msg.sender == batcher, "not batcher");
        _;
    }

    constructor(address _payToken) {
        payToken = IERC20(_payToken);
        owner = msg.sender;
    }

    function setBatcher(address _batcher) external onlyOwner {
        batcher = _batcher;
        emit BatcherSet(_batcher);
    }

    function deposit(uint256 amount, bytes32 memo) external {
        require(amount > 0, "zero amount");
        require(payToken.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
        bytes32 employerId = keccak256(abi.encodePacked(msg.sender));
        employers[employerId].balance += amount;
        if (!employers[employerId].active) {
            employers[employerId].admin = msg.sender;
            employers[employerId].active = true;
        }
        emit Deposited(employerId, msg.sender, amount, memo);
    }

    /// @notice Withdraw available (not locked) payroll balance back to the employer admin wallet.
    /// @dev Only the registered admin for this employer id (same address that deposited) may withdraw.
    function withdraw(uint256 amount) external {
        require(amount > 0, "zero amount");
        bytes32 employerId = keccak256(abi.encodePacked(msg.sender));
        EmployerAccount storage acc = employers[employerId];
        require(acc.active, "inactive");
        require(acc.admin == msg.sender, "not admin");
        require(acc.balance >= amount, "insufficient balance");
        acc.balance -= amount;
        require(payToken.transfer(msg.sender, amount), "transfer failed");
        emit Withdrawn(employerId, msg.sender, amount);
    }

    function fundGasBudget(uint256 amount) external {
        require(amount > 0, "zero amount");
        require(payToken.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
        bytes32 employerId = keccak256(abi.encodePacked(msg.sender));
        employers[employerId].gasBudget += amount;
        emit GasFunded(employerId, msg.sender, amount);
    }

    /// @notice Lock funds for a pending payroll run. Called by PayrollBatcher before executing.
    function lockFunds(bytes32 employerId, uint256 amount) external onlyBatcher {
        require(employers[employerId].balance >= amount, "insufficient balance");
        employers[employerId].balance -= amount;
        employers[employerId].lockedBalance += amount;
        emit Locked(employerId, amount);
    }

    /// @notice Release locked funds to a recipient. Called by PayrollBatcher after each transfer.
    function releaseTo(bytes32 employerId, address recipient, uint256 amount) external onlyBatcher {
        require(employers[employerId].lockedBalance >= amount, "insufficient locked");
        employers[employerId].lockedBalance -= amount;
        require(payToken.transfer(recipient, amount), "transfer failed");
        emit Released(employerId, recipient, amount);
    }

    /// @notice Unlock funds back to available (e.g. failed payroll run).
    function unlockFunds(bytes32 employerId, uint256 amount) external onlyBatcher {
        require(employers[employerId].lockedBalance >= amount, "insufficient locked");
        employers[employerId].lockedBalance -= amount;
        employers[employerId].balance += amount;
    }

    function getAvailableBalance(bytes32 employerId) external view returns (uint256) {
        return employers[employerId].balance;
    }

    function getLockedBalance(bytes32 employerId) external view returns (uint256) {
        return employers[employerId].lockedBalance;
    }

    function getEmployerAccount(bytes32 employerId) external view returns (EmployerAccount memory) {
        return employers[employerId];
    }
}
