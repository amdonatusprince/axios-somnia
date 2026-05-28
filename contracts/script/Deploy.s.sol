// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/sUSDC.sol";
import "../src/ComplianceRegistry.sol";
import "../src/PayrollTreasury.sol";
import "../src/PayrollBatcher.sol";
import "../src/EmployeeRegistry.sol";
import "../src/StreamVesting.sol";
import "../src/YieldRouter.sol";

contract Deploy is Script {
    /// Initial mint for deployer: 1,000,000 sUSDC (6 decimals).
    uint256 constant INITIAL_MINT = 1_000_000 * 10 ** 6;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        sUSDC stablecoin = new sUSDC();
        console2.log("sUSDC:", address(stablecoin));
        stablecoin.mint(deployer, INITIAL_MINT);

        ComplianceRegistry compliance = new ComplianceRegistry();
        console2.log("ComplianceRegistry:", address(compliance));

        PayrollTreasury treasury = new PayrollTreasury(address(stablecoin));
        console2.log("PayrollTreasury:", address(treasury));

        PayrollBatcher batcher = new PayrollBatcher(address(stablecoin), address(treasury));
        console2.log("PayrollBatcher:", address(batcher));

        treasury.setBatcher(address(batcher));

        EmployeeRegistry registry = new EmployeeRegistry(address(compliance));
        console2.log("EmployeeRegistry:", address(registry));

        StreamVesting vesting = new StreamVesting(address(stablecoin));
        console2.log("StreamVesting:", address(vesting));

        YieldRouter yieldRouter = new YieldRouter(address(stablecoin));
        console2.log("YieldRouter:", address(yieldRouter));

        vm.stopBroadcast();

        console2.log("\n=== Deployment Complete ===");
        console2.log("NEXT_PUBLIC_SUSDC_ADDRESS=", address(stablecoin));
        console2.log("NEXT_PUBLIC_COMPLIANCE_REGISTRY=", address(compliance));
        console2.log("NEXT_PUBLIC_PAYROLL_TREASURY=", address(treasury));
        console2.log("NEXT_PUBLIC_PAYROLL_BATCHER=", address(batcher));
        console2.log("NEXT_PUBLIC_EMPLOYEE_REGISTRY=", address(registry));
        console2.log("NEXT_PUBLIC_STREAM_VESTING=", address(vesting));
        console2.log("NEXT_PUBLIC_YIELD_ROUTER=", address(yieldRouter));
    }
}
