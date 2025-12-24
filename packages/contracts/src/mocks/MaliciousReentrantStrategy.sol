// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC4626} from "openzeppelin-contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";
import {IERC20Metadata} from "openzeppelin-contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract MaliciousReentrantStrategy is ERC4626 {
    error ReentrancyAttempted();

    address public target;
    bytes public callData;
    bool public reenterOnDeposit;
    bool public reenterOnWithdraw;
    bool private entered;

    constructor(IERC20Metadata asset_, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
    {}

    function configureReentry(
        address target_,
        bytes calldata callData_,
        bool onDeposit,
        bool onWithdraw
    ) external {
        target = target_;
        callData = callData_;
        reenterOnDeposit = onDeposit;
        reenterOnWithdraw = onWithdraw;
        entered = false;
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
        internal
        override
    {
        super._deposit(caller, receiver, assets, shares);
        if (reenterOnDeposit) {
            _tryReenter();
        }
    }

    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override {
        if (reenterOnWithdraw) {
            _tryReenter();
        }
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    function _tryReenter() internal {
        if (entered || target == address(0)) {
            return;
        }
        entered = true;
        (bool ok,) = target.call(callData);
        if (ok) {
            revert ReentrancyAttempted();
        }
        revert ReentrancyAttempted();
    }
}
