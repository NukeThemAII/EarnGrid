// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC4626} from "openzeppelin-contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";
import {IERC20Metadata} from "openzeppelin-contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IMintableBurnableERC20 {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

contract MockERC4626Strategy is ERC4626 {
    uint256 public liquidityLimit;

    constructor(IERC20Metadata asset_, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
    {
        liquidityLimit = type(uint256).max;
    }

    function setLiquidityLimit(uint256 newLimit) external {
        liquidityLimit = newLimit;
    }

    function simulateYield(uint256 amount) external {
        IMintableBurnableERC20(address(asset())).mint(address(this), amount);
    }

    function simulateLoss(uint256 amount) external {
        IMintableBurnableERC20(address(asset())).burn(address(this), amount);
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        uint256 max = super.maxWithdraw(owner);
        return max < liquidityLimit ? max : liquidityLimit;
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        uint256 max = super.maxRedeem(owner);
        if (liquidityLimit == type(uint256).max) {
            return max;
        }
        uint256 sharesForLimit = previewWithdraw(liquidityLimit);
        return max < sharesForLimit ? max : sharesForLimit;
    }
}
