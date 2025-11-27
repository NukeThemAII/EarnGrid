// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";
import {IERC4626} from "openzeppelin-contracts/interfaces/IERC4626.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {IEarnGridVault} from "../interfaces/IEarnGridVault.sol";

/// @notice Lightweight ERC4626-style mock used to test periphery flows.
contract MockEarnGridVault is ERC20, IEarnGridVault {
    IERC20 public immutable assetToken;

    struct StrategyMeta {
        uint256 cap;
        uint256 allocPoint;
        uint256 totalManagedAssets;
        bool enabled;
    }

    mapping(address => StrategyMeta) internal strategies;
    address[] internal supply;
    address[] internal withdrawQ;
    uint256 internal allocationPoints;

    constructor(IERC20 _asset) ERC20("Mock EarnGrid Shares", "mEG") {
        assetToken = _asset;
    }

    function setStrategy(address id, uint256 cap, uint256 allocPoint, uint256 totalManagedAssets, bool enabled) external {
        strategies[id] = StrategyMeta({cap: cap, allocPoint: allocPoint, totalManagedAssets: totalManagedAssets, enabled: enabled});
        allocationPoints += allocPoint;
        supply.push(id);
        withdrawQ.push(id);
    }

    function totalAssets() public view override returns (uint256) {
        return assetToken.balanceOf(address(this));
    }

    function asset() public view override returns (address) {
        return address(assetToken);
    }

    function totalAllocationPoints() external view returns (uint256) {
        return allocationPoints;
    }

    function supplyQueue(uint256 index) external view returns (address) {
        return supply[index];
    }

    function withdrawalQueue(uint256 index) external view returns (address) {
        return withdrawQ[index];
    }

    function getStrategy(address strategy) external view returns (StrategyData memory) {
        StrategyMeta memory meta = strategies[strategy];
        return
            StrategyData({
                cap: meta.cap,
                allocPoint: meta.allocPoint,
                totalManagedAssets: meta.totalManagedAssets,
                enabled: meta.enabled
            });
    }

    function convertToShares(uint256 assets) public view override returns (uint256) {
        uint256 supplyShares = totalSupply();
        return supplyShares == 0 ? assets : (assets * supplyShares) / totalAssets();
    }

    function convertToAssets(uint256 shares) public view override returns (uint256) {
        uint256 supplyShares = totalSupply();
        return supplyShares == 0 ? shares : (shares * totalAssets()) / supplyShares;
    }

    function maxDeposit(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256) {
        uint256 shares = convertToShares(assets);
        assetToken.transferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);
        return shares;
    }

    function maxMint(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function previewMint(uint256 shares) public view returns (uint256) {
        uint256 supplyShares = totalSupply();
        return supplyShares == 0 ? shares : (shares * totalAssets()) / supplyShares;
    }

    function mint(uint256 shares, address receiver) external returns (uint256) {
        uint256 assets = previewMint(shares);
        assetToken.transferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);
        return assets;
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        return convertToAssets(balanceOf(owner));
    }

    function previewWithdraw(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256) {
        uint256 shares = convertToShares(assets);
        if (msg.sender != owner) {
            uint256 allowed = allowance(owner, msg.sender);
            if (allowed < shares) revert("ERC20: insufficient allowance");
            _approve(owner, msg.sender, allowed - shares);
        }

        _burn(owner, shares);
        assetToken.transfer(receiver, assets);
        return shares;
    }

    function maxRedeem(address owner) external view returns (uint256) {
        return balanceOf(owner);
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256) {
        if (msg.sender != owner) {
            uint256 allowed = allowance(owner, msg.sender);
            if (allowed < shares) revert("ERC20: insufficient allowance");
            _approve(owner, msg.sender, allowed - shares);
        }
        uint256 assets = convertToAssets(shares);
        _burn(owner, shares);
        assetToken.transfer(receiver, assets);
        return assets;
    }
}
