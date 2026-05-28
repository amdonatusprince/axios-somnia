// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ComplianceRegistry.sol";
import "../src/PayrollTreasury.sol";
import "../src/PayrollBatcher.sol";
import "../src/EmployeeRegistry.sol";
import "../src/StreamVesting.sol";
import "../src/YieldRouter.sol";

contract Deploy is Script {
    /// MUSD on Mezo testnet — https://mezo.org/docs/users/resources/contracts-reference/
    address constant MUSD_TESTNET = 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        ComplianceRegistry compliance = new ComplianceRegistry();
        console2.log("ComplianceRegistry:", address(compliance));

        PayrollTreasury treasury = new PayrollTreasury(MUSD_TESTNET);
        console2.log("PayrollTreasury:", address(treasury));

        PayrollBatcher batcher = new PayrollBatcher(MUSD_TESTNET, address(treasury));
        console2.log("PayrollBatcher:", address(batcher));

        treasury.setBatcher(address(batcher));

        EmployeeRegistry registry = new EmployeeRegistry(address(compliance));
        console2.log("EmployeeRegistry:", address(registry));

        StreamVesting vesting = new StreamVesting(MUSD_TESTNET);
        console2.log("StreamVesting:", address(vesting));

        YieldRouter yieldRouter = new YieldRouter(MUSD_TESTNET);
        console2.log("YieldRouter:", address(yieldRouter));

        vm.stopBroadcast();

        console2.log("\n=== Deployment Complete ===");
        console2.log("NEXT_PUBLIC_COMPLIANCE_REGISTRY=", address(compliance));
        console2.log("NEXT_PUBLIC_PAYROLL_TREASURY=", address(treasury));
        console2.log("NEXT_PUBLIC_PAYROLL_BATCHER=", address(batcher));
        console2.log("NEXT_PUBLIC_EMPLOYEE_REGISTRY=", address(registry));
        console2.log("NEXT_PUBLIC_STREAM_VESTING=", address(vesting));
        console2.log("NEXT_PUBLIC_YIELD_ROUTER=", address(yieldRouter));
    }
}
