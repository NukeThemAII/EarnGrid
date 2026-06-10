// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AccessControl} from "openzeppelin-contracts/access/AccessControl.sol";
import {IERC4626} from "openzeppelin-contracts/interfaces/IERC4626.sol";
import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "openzeppelin-contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "openzeppelin-contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";

contract BlendedVault is ERC4626, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error AlreadyScheduled();
    error DepositsPaused();
    error HarvestIncreaseTooHigh();
    error HarvestTooSoon();
    error InvalidAsset();
    error MaxRebalanceExceeded();
    error RebalanceCooldownActive();
    error InvalidBps();
    error InvalidCap();
    error InvalidQueueStrategy();
    error InvalidSweepToken();
    error InvalidTier();
    error InvalidTimelockDelay();
    error MinInitialDeposit();
    error NotEnoughLiquidity();
    error NotAuthorized();
    error NotScheduled();
    error SameBlockHarvest();
    error StrategyAlreadyRegistered();
    error StrategyAccountingFailed(address strategy);
    error StrategyDisabled();
    error StrategyDepositLimitExceeded(address strategy, uint256 amount, uint256 maxDeposit);
    error StrategyNotRegistered();
    error StrategyNotSynchronous();
    error TierLimitExceeded();
    error TimelockNotReady();
    error TimelockRequired();
    error WithdrawalsPaused();
    error ZeroAddress();
    error ZeroAssets();
    error ZeroShares();

    bytes32 public constant CURATOR_ROLE = keccak256("CURATOR_ROLE");
    bytes32 public constant ALLOCATOR_ROLE = keccak256("ALLOCATOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    uint256 public constant MAX_BPS = 10_000;
    uint256 public constant FEE_BPS = 300;
    uint256 public constant MIN_TIMELOCK_DELAY = 1 days;

    bytes32 private constant ACTION_ADD_STRATEGY = keccak256("ADD_STRATEGY");
    bytes32 private constant ACTION_CAP_INCREASE = keccak256("CAP_INCREASE");
    bytes32 private constant ACTION_MAX_DAILY_INCREASE = keccak256("MAX_DAILY_INCREASE");
    bytes32 private constant ACTION_TIMELOCK_DELAY = keccak256("TIMELOCK_DELAY");
    bytes32 private constant ACTION_TIER_LIMITS = keccak256("TIER_LIMITS");
    bytes32 private constant ACTION_REBALANCE_COOLDOWN = keccak256("REBALANCE_COOLDOWN");
    bytes32 private constant ACTION_MAX_REBALANCE_AMOUNT = keccak256("MAX_REBALANCE_AMOUNT");

    struct StrategyConfig {
        bool registered;
        bool enabled;
        uint8 tier;
        uint256 capAssets;
        bool isSynchronous;
    }

    mapping(address => StrategyConfig) public strategies;
    address[] public strategyList;
    address[] public depositQueue;
    address[] public withdrawQueue;
    mapping(address => uint256) public cachedStrategyAssets;

    uint256[3] public tierMaxBps;
    uint256 public idleLiquidityBps;
    uint256 public minInitialDeposit;

    address public feeRecipient;
    uint256 public highWatermarkAssetsPerShare;
    uint256 public lastHarvestBlock;
    uint256 public lastHarvestTimestamp;
    uint256 public minHarvestInterval;
    uint256 public maxDailyIncreaseBps;
    uint256 public rebalanceCooldown;
    uint256 public lastRebalanceTimestamp;
    uint256 public maxRebalanceAmountBps;

    bool public pausedDeposits;
    bool public pausedWithdrawals;

    uint256 public timelockDelay;
    mapping(bytes32 => uint256) public scheduledAt;

    event StrategyAdded(address indexed strategy, uint8 tier, uint256 capAssets, bool isSynchronous);
    event StrategyRemoved(address indexed strategy);
    event CapUpdated(address indexed strategy, uint256 oldCap, uint256 newCap);
    event TierLimitsUpdated(uint256[3] oldLimits, uint256[3] newLimits);
    event QueuesUpdated(bytes32 depositQueueHash, bytes32 withdrawQueueHash);
    event Rebalanced(
        address[] withdrawStrategies,
        uint256[] withdrawAmounts,
        address[] depositStrategies,
        uint256[] depositAmounts
    );
    event FeeAccrued(uint256 profitAssets, uint256 feeAssets, uint256 feeShares);
    event Paused(bool deposits, bool withdrawals);
    event ChangeScheduled(bytes32 indexed id, bytes32 indexed action, uint256 executeAfter);
    event ChangeCancelled(bytes32 indexed id);
    event ChangeExecuted(bytes32 indexed id, bytes32 indexed action);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event IdleLiquidityBpsUpdated(uint256 oldBps, uint256 newBps);
    event MinInitialDepositUpdated(uint256 oldMin, uint256 newMin);
    event MinHarvestIntervalUpdated(uint256 oldInterval, uint256 newInterval);
    event MaxDailyIncreaseBpsUpdated(uint256 oldBps, uint256 newBps);
    event RebalanceCooldownUpdated(uint256 oldCooldown, uint256 newCooldown);
    event MaxRebalanceAmountBpsUpdated(uint256 oldBps, uint256 newBps);
    event TimelockDelayUpdated(uint256 oldDelay, uint256 newDelay);

    constructor(
        IERC20Metadata asset_,
        string memory name_,
        string memory symbol_,
        address owner_,
        address curator_,
        address allocator_,
        address guardian_,
        address feeRecipient_,
        uint256[3] memory tierMaxBps_,
        uint256 idleLiquidityBps_,
        uint256 minInitialDeposit_,
        uint256 maxDailyIncreaseBps_,
        uint256 minHarvestInterval_,
        uint256 timelockDelay_
    ) ERC4626(asset_) ERC20(name_, symbol_) {
        if (owner_ == address(0) || feeRecipient_ == address(0)) {
            revert ZeroAddress();
        }
        if (timelockDelay_ < MIN_TIMELOCK_DELAY) {
            revert InvalidTimelockDelay();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
        _grantRole(CURATOR_ROLE, curator_);
        _grantRole(ALLOCATOR_ROLE, allocator_);
        _grantRole(GUARDIAN_ROLE, guardian_);

        _setTierMaxBps(tierMaxBps_);
        _setIdleLiquidityBps(idleLiquidityBps_);

        feeRecipient = feeRecipient_;
        minInitialDeposit = minInitialDeposit_;
        _setMaxDailyIncreaseBps(maxDailyIncreaseBps_);
        minHarvestInterval = minHarvestInterval_;
        timelockDelay = timelockDelay_;
        highWatermarkAssetsPerShare = 1e18;
        rebalanceCooldown = 6 hours;
        maxRebalanceAmountBps = 5000;
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function maxDeposit(address) public view override returns (uint256) {
        return pausedDeposits ? 0 : type(uint256).max;
    }

    function maxMint(address) public view override returns (uint256) {
        return pausedDeposits ? 0 : type(uint256).max;
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        if (pausedWithdrawals) return 0;
        uint256 ownerAssets = super.maxWithdraw(owner);
        uint256 liquidity = _availableLiquidity();
        return ownerAssets < liquidity ? ownerAssets : liquidity;
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        if (pausedWithdrawals) return 0;
        uint256 ownerShares = super.maxRedeem(owner);
        uint256 liquidity = _availableLiquidity();
        uint256 liquidityShares = convertToShares(liquidity);
        return ownerShares < liquidityShares ? ownerShares : liquidityShares;
    }

    function totalAssets() public view override returns (uint256) {
        uint256 total = IERC20(asset()).balanceOf(address(this));
        uint256 len = strategyList.length;
        for (uint256 i = 0; i < len; i++) {
            address strategy = strategyList[i];
            uint256 shares = IERC20(strategy).balanceOf(address(this));
            if (shares == 0) {
                continue;
            }
            total += _safePreviewRedeem(strategy, shares);
        }
        return total;
    }

    function assetsPerShare() public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return 1e18;
        }
        return (totalAssets() * 1e18) / supply;
    }

    function getStrategies() external view returns (address[] memory) {
        return strategyList;
    }

    function getDepositQueue() external view returns (address[] memory) {
        return depositQueue;
    }

    function getWithdrawQueue() external view returns (address[] memory) {
        return withdrawQueue;
    }

    function strategyAssets(address strategy) public view returns (uint256) {
        if (!strategies[strategy].registered) {
            revert StrategyNotRegistered();
        }
        uint256 shares = IERC20(strategy).balanceOf(address(this));
        if (shares == 0) {
            return 0;
        }
        return _safePreviewRedeem(strategy, shares);
    }

    function deposit(uint256 assets, address receiver)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        if (pausedDeposits) {
            revert DepositsPaused();
        }
        if (assets == 0) {
            revert ZeroAssets();
        }
        uint256 supplyBefore = totalSupply();
        if (supplyBefore == 0 && assets < minInitialDeposit) {
            revert MinInitialDeposit();
        }
        shares = previewDeposit(assets);
        if (shares == 0) {
            revert ZeroShares();
        }
        shares = super.deposit(assets, receiver);
        if (supplyBefore == 0) {
            highWatermarkAssetsPerShare = assetsPerShare();
        }
        _allocateIdle();
    }

    function mint(uint256 shares, address receiver)
        public
        override
        nonReentrant
        returns (uint256 assets)
    {
        if (pausedDeposits) {
            revert DepositsPaused();
        }
        if (shares == 0) {
            revert ZeroShares();
        }
        uint256 supplyBefore = totalSupply();
        assets = previewMint(shares);
        if (assets == 0) {
            revert ZeroAssets();
        }
        if (supplyBefore == 0 && assets < minInitialDeposit) {
            revert MinInitialDeposit();
        }
        assets = super.mint(shares, receiver);
        if (supplyBefore == 0) {
            highWatermarkAssetsPerShare = assetsPerShare();
        }
        _allocateIdle();
    }

    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        if (pausedWithdrawals) {
            revert WithdrawalsPaused();
        }
        shares = super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256 assets)
    {
        if (pausedWithdrawals) {
            revert WithdrawalsPaused();
        }
        assets = super.redeem(shares, receiver, owner);
    }

    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override {
        _ensureLiquidity(assets);
        super._withdraw(caller, receiver, owner, assets, shares);
        if (totalSupply() == 0) {
            highWatermarkAssetsPerShare = 1e18;
        }
    }

    function setDepositQueue(address[] calldata newQueue) external onlyRole(ALLOCATOR_ROLE) {
        _setDepositQueue(newQueue);
    }

    function setWithdrawQueue(address[] calldata newQueue) external onlyRole(ALLOCATOR_ROLE) {
        _setWithdrawQueue(newQueue);
    }

    function pauseDeposits() external onlyRole(GUARDIAN_ROLE) {
        pausedDeposits = true;
        emit Paused(pausedDeposits, pausedWithdrawals);
    }

    function unpauseDeposits() external onlyRole(GUARDIAN_ROLE) {
        pausedDeposits = false;
        emit Paused(pausedDeposits, pausedWithdrawals);
    }

    function pauseWithdrawals() external onlyRole(GUARDIAN_ROLE) {
        pausedWithdrawals = true;
        emit Paused(pausedDeposits, pausedWithdrawals);
    }

    function unpauseWithdrawals() external onlyRole(GUARDIAN_ROLE) {
        pausedWithdrawals = false;
        emit Paused(pausedDeposits, pausedWithdrawals);
    }

    function setFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRecipient == address(0)) {
            revert ZeroAddress();
        }
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    function setIdleLiquidityBps(uint256 newBps) external onlyCuratorOrOwner {
        _setIdleLiquidityBps(newBps);
    }

    function setMinInitialDeposit(uint256 newMin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldMin = minInitialDeposit;
        minInitialDeposit = newMin;
        emit MinInitialDepositUpdated(oldMin, newMin);
    }

    function setMinHarvestInterval(uint256 newInterval) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldInterval = minHarvestInterval;
        minHarvestInterval = newInterval;
        emit MinHarvestIntervalUpdated(oldInterval, newInterval);
    }

    function setMaxDailyIncreaseBps(uint256 newBps) external onlyCuratorOrOwner {
        uint256 oldBps = maxDailyIncreaseBps;
        if (newBps > oldBps) {
            revert TimelockRequired();
        }
        _setMaxDailyIncreaseBps(newBps);
    }

    function scheduleMaxDailyIncreaseBps(uint256 newBps, bytes32 salt)
        external
        onlyCuratorOrOwner
        returns (bytes32 id)
    {
        bytes memory data = abi.encode(newBps);
        id = _scheduleChange(ACTION_MAX_DAILY_INCREASE, data, salt);
    }

    function executeMaxDailyIncreaseBps(uint256 newBps, bytes32 salt) external onlyCuratorOrOwner {
        bytes memory data = abi.encode(newBps);
        _consumeChange(ACTION_MAX_DAILY_INCREASE, data, salt);
        _setMaxDailyIncreaseBps(newBps);
    }

    function setTimelockDelay(uint256 newDelay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTimelockDelay(newDelay, true);
    }

    function scheduleTimelockDelay(uint256 newDelay, bytes32 salt)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        returns (bytes32 id)
    {
        if (newDelay < MIN_TIMELOCK_DELAY) {
            revert InvalidTimelockDelay();
        }
        bytes memory data = abi.encode(newDelay);
        id = _scheduleChange(ACTION_TIMELOCK_DELAY, data, salt);
    }

    function executeTimelockDelay(uint256 newDelay, bytes32 salt)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newDelay < MIN_TIMELOCK_DELAY) {
            revert InvalidTimelockDelay();
        }
        bytes memory data = abi.encode(newDelay);
        _consumeChange(ACTION_TIMELOCK_DELAY, data, salt);
        _setTimelockDelay(newDelay, false);
    }

    function scheduleAddStrategy(
        address strategy,
        uint8 tier,
        uint256 capAssets,
        bool isSynchronous,
        bytes32 salt
    ) external onlyCuratorOrOwner returns (bytes32 id) {
        bytes memory data = abi.encode(strategy, tier, capAssets, isSynchronous);
        id = _scheduleChange(ACTION_ADD_STRATEGY, data, salt);
    }

    function executeAddStrategy(
        address strategy,
        uint8 tier,
        uint256 capAssets,
        bool isSynchronous,
        bytes32 salt
    ) external onlyCuratorOrOwner {
        bytes memory data = abi.encode(strategy, tier, capAssets, isSynchronous);
        _consumeChange(ACTION_ADD_STRATEGY, data, salt);
        _addStrategy(strategy, tier, capAssets, isSynchronous);
    }

    function removeStrategy(address strategy) external onlyCuratorOrOwner {
        StrategyConfig storage config = strategies[strategy];
        if (!config.registered) {
            revert StrategyNotRegistered();
        }
        config.enabled = false;
        _removeFromQueue(depositQueue, strategy);
        _removeFromQueue(withdrawQueue, strategy);
        emit StrategyRemoved(strategy);
        emit QueuesUpdated(keccak256(abi.encode(depositQueue)), keccak256(abi.encode(withdrawQueue)));
    }

    function forceRemoveStrategy(address strategy) external onlyGuardianOrOwner {
        StrategyConfig storage config = strategies[strategy];
        if (!config.registered) {
            revert StrategyNotRegistered();
        }
        config.enabled = false;
        _removeFromQueue(depositQueue, strategy);
        _removeFromQueue(withdrawQueue, strategy);
        emit StrategyRemoved(strategy);
        emit QueuesUpdated(keccak256(abi.encode(depositQueue)), keccak256(abi.encode(withdrawQueue)));
    }

    function setCap(address strategy, uint256 newCap) external onlyCuratorOrOwner {
        StrategyConfig storage config = strategies[strategy];
        if (!config.registered) {
            revert StrategyNotRegistered();
        }
        uint256 oldCap = config.capAssets;
        if (newCap > oldCap) {
            revert TimelockRequired();
        }
        config.capAssets = newCap;
        emit CapUpdated(strategy, oldCap, newCap);
    }

    function scheduleCapIncrease(
        address strategy,
        uint256 newCap,
        bytes32 salt
    ) external onlyCuratorOrOwner returns (bytes32 id) {
        bytes memory data = abi.encode(strategy, newCap);
        id = _scheduleChange(ACTION_CAP_INCREASE, data, salt);
    }

    function executeCapIncrease(
        address strategy,
        uint256 newCap,
        bytes32 salt
    ) external onlyCuratorOrOwner {
        StrategyConfig storage config = strategies[strategy];
        if (!config.registered) {
            revert StrategyNotRegistered();
        }
        uint256 oldCap = config.capAssets;
        if (newCap <= oldCap) {
            revert TimelockRequired();
        }
        bytes memory data = abi.encode(strategy, newCap);
        _consumeChange(ACTION_CAP_INCREASE, data, salt);
        config.capAssets = newCap;
        emit CapUpdated(strategy, oldCap, newCap);
    }

    function setTierMaxBps(uint256[3] calldata newBps) external onlyCuratorOrOwner {
        if (
            newBps[0] > tierMaxBps[0] ||
            newBps[1] > tierMaxBps[1] ||
            newBps[2] > tierMaxBps[2]
        ) {
            revert TimelockRequired();
        }
        _setTierMaxBps(newBps);
    }

    function scheduleTierMaxBps(uint256[3] calldata newBps, bytes32 salt)
        external
        onlyCuratorOrOwner
        returns (bytes32 id)
    {
        bytes memory data = abi.encode(newBps);
        id = _scheduleChange(ACTION_TIER_LIMITS, data, salt);
    }

    function executeTierMaxBps(uint256[3] calldata newBps, bytes32 salt)
        external
        onlyCuratorOrOwner
    {
        bytes memory data = abi.encode(newBps);
        _consumeChange(ACTION_TIER_LIMITS, data, salt);
        _setTierMaxBps(newBps);
    }

    function setRebalanceCooldown(uint256 newCooldown) external onlyCuratorOrOwner {
        if (newCooldown > rebalanceCooldown) {
            revert TimelockRequired();
        }
        _setRebalanceCooldown(newCooldown);
    }

    function scheduleRebalanceCooldown(uint256 newCooldown, bytes32 salt)
        external
        onlyCuratorOrOwner
        returns (bytes32 id)
    {
        bytes memory data = abi.encode(newCooldown);
        id = _scheduleChange(ACTION_REBALANCE_COOLDOWN, data, salt);
    }

    function executeRebalanceCooldown(uint256 newCooldown, bytes32 salt) external onlyCuratorOrOwner {
        bytes memory data = abi.encode(newCooldown);
        _consumeChange(ACTION_REBALANCE_COOLDOWN, data, salt);
        _setRebalanceCooldown(newCooldown);
    }

    function setMaxRebalanceAmountBps(uint256 newBps) external onlyCuratorOrOwner {
        if (newBps > maxRebalanceAmountBps) {
            revert TimelockRequired();
        }
        _setMaxRebalanceAmountBps(newBps);
    }

    function scheduleMaxRebalanceAmount(uint256 newBps, bytes32 salt)
        external
        onlyCuratorOrOwner
        returns (bytes32 id)
    {
        bytes memory data = abi.encode(newBps);
        id = _scheduleChange(ACTION_MAX_REBALANCE_AMOUNT, data, salt);
    }

    function executeMaxRebalanceAmount(uint256 newBps, bytes32 salt) external onlyCuratorOrOwner {
        bytes memory data = abi.encode(newBps);
        _consumeChange(ACTION_MAX_REBALANCE_AMOUNT, data, salt);
        _setMaxRebalanceAmountBps(newBps);
    }

    function cancelScheduled(bytes32 id) external onlyCuratorOrOwner {
        if (scheduledAt[id] == 0) {
            revert NotScheduled();
        }
        delete scheduledAt[id];
        emit ChangeCancelled(id);
    }

    function rebalance(
        address[] calldata withdrawStrategies,
        uint256[] calldata withdrawAmounts,
        address[] calldata depositStrategies,
        uint256[] calldata depositAmounts
    ) external onlyRole(ALLOCATOR_ROLE) nonReentrant {
        if (withdrawStrategies.length != withdrawAmounts.length) {
            revert InvalidQueueStrategy();
        }
        if (depositStrategies.length != depositAmounts.length) {
            revert InvalidQueueStrategy();
        }

        if (block.timestamp < lastRebalanceTimestamp + rebalanceCooldown) {
            revert RebalanceCooldownActive();
        }

        uint256 totalBefore = totalAssets();
        uint256 maxMove = (totalBefore * maxRebalanceAmountBps) / MAX_BPS;
        uint256 totalMoved;

        uint256[3] memory tierExposure = _currentTierExposure();

        for (uint256 i = 0; i < withdrawStrategies.length; i++) {
            address strategy = withdrawStrategies[i];
            uint256 amount = withdrawAmounts[i];
            if (amount == 0) {
                continue;
            }
            StrategyConfig storage config = strategies[strategy];
            if (!config.registered) {
                revert StrategyNotRegistered();
            }
            if (totalMoved + amount > maxMove) {
                revert MaxRebalanceExceeded();
            }
            _withdrawFromStrategy(strategy, amount);
            totalMoved += amount;
            if (amount <= tierExposure[config.tier]) {
                tierExposure[config.tier] -= amount;
            } else {
                tierExposure[config.tier] = 0;
            }
        }

        uint256 total = totalAssets();
        for (uint256 i = 0; i < depositStrategies.length; i++) {
            uint256 amount = depositAmounts[i];
            if (amount == 0) {
                continue;
            }
            if (totalMoved + amount > maxMove) {
                revert MaxRebalanceExceeded();
            }
            _depositToStrategy(depositStrategies[i], amount, total, tierExposure);
            totalMoved += amount;
        }

        lastRebalanceTimestamp = block.timestamp;
        emit Rebalanced(withdrawStrategies, withdrawAmounts, depositStrategies, depositAmounts);
    }

    function harvest() external onlyRole(ALLOCATOR_ROLE) nonReentrant {
        if (lastHarvestBlock == block.number) {
            revert SameBlockHarvest();
        }
        if (lastHarvestTimestamp != 0 && block.timestamp < lastHarvestTimestamp + minHarvestInterval) {
            revert HarvestTooSoon();
        }

        uint256 supply = totalSupply();
        if (supply == 0) {
            lastHarvestBlock = block.number;
            lastHarvestTimestamp = block.timestamp;
            return;
        }

        uint256 currentAssetsPerShare = assetsPerShare();
        if (currentAssetsPerShare <= highWatermarkAssetsPerShare) {
            lastHarvestBlock = block.number;
            lastHarvestTimestamp = block.timestamp;
            return;
        }

        if (maxDailyIncreaseBps != 0 && lastHarvestTimestamp != 0) {
            uint256 elapsed = block.timestamp - lastHarvestTimestamp;
            uint256 maxIncrease =
                (highWatermarkAssetsPerShare * maxDailyIncreaseBps * elapsed) /
                (MAX_BPS * 1 days);
            if (currentAssetsPerShare > highWatermarkAssetsPerShare + maxIncrease) {
                revert HarvestIncreaseTooHigh();
            }
        }

        uint256 profitAssets =
            ((currentAssetsPerShare - highWatermarkAssetsPerShare) * supply) / 1e18;
        uint256 feeAssets = (profitAssets * FEE_BPS) / MAX_BPS;
        uint256 feeShares = _feeSharesForAssets(feeAssets, supply);

        if (feeShares > 0) {
            _mint(feeRecipient, feeShares);
        }

        highWatermarkAssetsPerShare = currentAssetsPerShare;
        lastHarvestBlock = block.number;
        lastHarvestTimestamp = block.timestamp;

        emit FeeAccrued(profitAssets, feeAssets, feeShares);
    }

    function sweepNonUSDC(IERC20 token, address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(token) == address(asset())) {
            revert InvalidAsset();
        }
        if (strategies[address(token)].registered) {
            revert InvalidSweepToken();
        }
        token.safeTransfer(to, token.balanceOf(address(this)));
    }

    function _allocateIdle() internal {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle == 0) {
            return;
        }
        uint256 total = totalAssets();
        uint256 targetIdle = (total * idleLiquidityBps) / MAX_BPS;
        if (idle <= targetIdle) {
            return;
        }
        uint256 toAllocate = idle - targetIdle;
        if (toAllocate == 0) {
            return;
        }

        uint256[3] memory tierExposure = _currentTierExposure();

        uint256 len = depositQueue.length;
        for (uint256 i = 0; i < len; i++) {
            address strategy = depositQueue[i];
            if (toAllocate == 0) {
                break;
            }
            uint256 amount = _maxAllocatable(strategy, toAllocate, total, tierExposure);
            if (amount == 0) {
                continue;
            }
            _depositToStrategy(strategy, amount, total, tierExposure);
            toAllocate -= amount;
        }
    }

    function _ensureLiquidity(uint256 assets) internal {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle >= assets) {
            return;
        }
        uint256 remaining = assets - idle;
        uint256 len = withdrawQueue.length;
        for (uint256 i = 0; i < len; i++) {
            address strategy = withdrawQueue[i];
            if (remaining == 0) {
                break;
            }
            StrategyConfig storage config = strategies[strategy];
            if (!config.registered) {
                continue;
            }
            if (!config.isSynchronous) {
                continue;
            }
            uint256 available = IERC4626(strategy).maxWithdraw(address(this));
            if (available == 0) {
                continue;
            }
            uint256 amount = remaining < available ? remaining : available;
            _withdrawFromStrategy(strategy, amount);
            remaining -= amount;
        }
        if (remaining > 0) {
            revert NotEnoughLiquidity();
        }
    }

    function _depositToStrategy(
        address strategy,
        uint256 amount,
        uint256 total,
        uint256[3] memory tierExposure
    ) internal {
        StrategyConfig storage config = strategies[strategy];
        if (!config.registered) {
            revert StrategyNotRegistered();
        }
        if (!config.enabled) {
            revert StrategyDisabled();
        }
        if (!config.isSynchronous) {
            revert StrategyNotSynchronous();
        }

        uint256 currentAssets = _strategyAssetsStrict(strategy);
        if (currentAssets + amount > config.capAssets) {
            revert InvalidCap();
        }

        uint256 maxDepositAmount = _maxDepositOrZero(strategy);
        if (amount > maxDepositAmount) {
            revert StrategyDepositLimitExceeded(strategy, amount, maxDepositAmount);
        }

        uint256 tierLimit = (total * tierMaxBps[config.tier]) / MAX_BPS;
        if (tierExposure[config.tier] + amount > tierLimit) {
            revert TierLimitExceeded();
        }

        IERC20(asset()).forceApprove(strategy, amount);
        IERC4626(strategy).deposit(amount, address(this));

        cachedStrategyAssets[strategy] = currentAssets + amount;
        tierExposure[config.tier] += amount;
    }

    function _withdrawFromStrategy(address strategy, uint256 amount) internal {
        uint256 available = IERC4626(strategy).maxWithdraw(address(this));
        if (amount > available) {
            revert NotEnoughLiquidity();
        }
        IERC4626(strategy).withdraw(amount, address(this), address(this));
        uint256 cached = cachedStrategyAssets[strategy];
        cachedStrategyAssets[strategy] = cached > amount ? cached - amount : 0;
    }

    function _maxAllocatable(
        address strategy,
        uint256 remaining,
        uint256 total,
        uint256[3] memory tierExposure
    ) internal view returns (uint256) {
        StrategyConfig storage config = strategies[strategy];
        if (!config.registered || !config.enabled || !config.isSynchronous) {
            return 0;
        }
        uint256 shares = IERC20(strategy).balanceOf(address(this));
        (uint256 currentAssets, bool ok) = _previewRedeemWithStatus(strategy, shares);
        if (!ok) {
            return 0;
        }
        uint256 maxByCap = 0;
        if (config.capAssets > currentAssets) {
            maxByCap = config.capAssets - currentAssets;
        }
        uint256 tierLimit = (total * tierMaxBps[config.tier]) / MAX_BPS;
        uint256 maxByTier = 0;
        if (tierLimit > tierExposure[config.tier]) {
            maxByTier = tierLimit - tierExposure[config.tier];
        }
        uint256 maxDepositAmount = _maxDepositOrZero(strategy);
        uint256 max = _min(remaining, _min(maxByCap, _min(maxByTier, maxDepositAmount)));
        return max;
    }

    function _addStrategy(
        address strategy,
        uint8 tier,
        uint256 capAssets,
        bool isSynchronous
    ) internal {
        if (strategy == address(0)) {
            revert ZeroAddress();
        }
        if (strategies[strategy].registered) {
            revert StrategyAlreadyRegistered();
        }
        if (tier > 2) {
            revert InvalidTier();
        }
        if (capAssets == 0) {
            revert InvalidCap();
        }
        if (!isSynchronous) {
            revert StrategyNotSynchronous();
        }
        if (IERC4626(strategy).asset() != address(asset())) {
            revert InvalidAsset();
        }
        strategies[strategy] = StrategyConfig({
            registered: true,
            enabled: true,
            tier: tier,
            capAssets: capAssets,
            isSynchronous: isSynchronous
        });
        strategyList.push(strategy);
        emit StrategyAdded(strategy, tier, capAssets, isSynchronous);
    }

    function _setTierMaxBps(uint256[3] memory newBps) internal {
        if (newBps[0] > MAX_BPS || newBps[1] > MAX_BPS || newBps[2] > MAX_BPS) {
            revert InvalidBps();
        }
        uint256[3] memory old = tierMaxBps;
        tierMaxBps = newBps;
        emit TierLimitsUpdated(old, newBps);
    }

    function _setIdleLiquidityBps(uint256 newBps) internal {
        if (newBps > MAX_BPS) {
            revert InvalidBps();
        }
        uint256 oldBps = idleLiquidityBps;
        idleLiquidityBps = newBps;
        emit IdleLiquidityBpsUpdated(oldBps, newBps);
    }

    function _setMaxDailyIncreaseBps(uint256 newBps) internal {
        if (newBps > MAX_BPS) {
            revert InvalidBps();
        }
        uint256 oldBps = maxDailyIncreaseBps;
        maxDailyIncreaseBps = newBps;
        emit MaxDailyIncreaseBpsUpdated(oldBps, newBps);
    }

    function _setRebalanceCooldown(uint256 newCooldown) internal {
        uint256 oldCooldown = rebalanceCooldown;
        rebalanceCooldown = newCooldown;
        emit RebalanceCooldownUpdated(oldCooldown, newCooldown);
    }

    function _setMaxRebalanceAmountBps(uint256 newBps) internal {
        if (newBps > MAX_BPS) {
            revert InvalidBps();
        }
        uint256 oldBps = maxRebalanceAmountBps;
        maxRebalanceAmountBps = newBps;
        emit MaxRebalanceAmountBpsUpdated(oldBps, newBps);
    }

    function _scheduleChange(bytes32 action, bytes memory data, bytes32 salt)
        internal
        returns (bytes32 id)
    {
        id = keccak256(abi.encode(action, data, salt));
        if (scheduledAt[id] != 0) {
            revert AlreadyScheduled();
        }
        uint256 eta = block.timestamp + timelockDelay;
        scheduledAt[id] = eta;
        emit ChangeScheduled(id, action, eta);
    }

    function _consumeChange(bytes32 action, bytes memory data, bytes32 salt) internal {
        bytes32 id = keccak256(abi.encode(action, data, salt));
        uint256 eta = scheduledAt[id];
        if (eta == 0) {
            revert NotScheduled();
        }
        if (block.timestamp < eta) {
            revert TimelockNotReady();
        }
        delete scheduledAt[id];
        emit ChangeExecuted(id, action);
    }

    function _setDepositQueue(address[] calldata newQueue) internal {
        uint256 len = newQueue.length;
        for (uint256 i = 0; i < len; i++) {
            StrategyConfig storage config = strategies[newQueue[i]];
            if (!config.registered || !config.enabled) {
                revert InvalidQueueStrategy();
            }
        }
        delete depositQueue;
        for (uint256 i = 0; i < len; i++) {
            depositQueue.push(newQueue[i]);
        }
        emit QueuesUpdated(keccak256(abi.encode(depositQueue)), keccak256(abi.encode(withdrawQueue)));
    }

    function _setWithdrawQueue(address[] calldata newQueue) internal {
        uint256 len = newQueue.length;
        for (uint256 i = 0; i < len; i++) {
            if (!strategies[newQueue[i]].registered) {
                revert InvalidQueueStrategy();
            }
        }
        delete withdrawQueue;
        for (uint256 i = 0; i < len; i++) {
            withdrawQueue.push(newQueue[i]);
        }
        emit QueuesUpdated(keccak256(abi.encode(depositQueue)), keccak256(abi.encode(withdrawQueue)));
    }

    function _removeFromQueue(address[] storage queue, address strategy) internal {
        uint256 i = 0;
        while (i < queue.length) {
            if (queue[i] == strategy) {
                queue[i] = queue[queue.length - 1];
                queue.pop();
            } else {
                i += 1;
            }
        }
    }

    function _currentTierExposure() internal view returns (uint256[3] memory exposure) {
        uint256 len = strategyList.length;
        for (uint256 i = 0; i < len; i++) {
            address strategy = strategyList[i];
            StrategyConfig storage config = strategies[strategy];
            if (!config.registered) {
                continue;
            }
            uint256 shares = IERC20(strategy).balanceOf(address(this));
            uint256 assets = _safePreviewRedeem(strategy, shares);
            exposure[config.tier] += assets;
        }
    }

    function _feeSharesForAssets(uint256 feeAssets, uint256 supply) internal view returns (uint256) {
        if (feeAssets == 0) {
            return 0;
        }
        uint256 total = totalAssets();
        if (total <= feeAssets) {
            return 0;
        }
        // Mint shares to represent feeAssets without inflating assets.
        return (feeAssets * supply) / (total - feeAssets);
    }

    /// @notice Safely call previewRedeem on a strategy, falling back to cached assets
    /// @dev Prevents a reverting/bricked strategy from DOS'ing the vault
    function _safePreviewRedeem(address strategy, uint256 shares) internal view returns (uint256) {
        (uint256 assets,) = _previewRedeemWithStatus(strategy, shares);
        return assets;
    }

    function _previewRedeemWithStatus(address strategy, uint256 shares)
        internal
        view
        returns (uint256 assets, bool ok)
    {
        if (shares == 0) {
            return (0, true);
        }
        try IERC4626(strategy).previewRedeem(shares) returns (uint256 value) {
            return (value, true);
        } catch {
            return (cachedStrategyAssets[strategy], false);
        }
    }

    function _strategyAssetsStrict(address strategy) internal view returns (uint256) {
        uint256 shares = IERC20(strategy).balanceOf(address(this));
        if (shares == 0) {
            return 0;
        }
        try IERC4626(strategy).previewRedeem(shares) returns (uint256 assets) {
            return assets;
        } catch {
            revert StrategyAccountingFailed(strategy);
        }
    }

    /// @notice Calculate total available liquidity for withdrawals
    /// @dev Returns idle USDC + sum of strategy maxWithdraw amounts
    function _availableLiquidity() internal view returns (uint256) {
        uint256 liquidity = IERC20(asset()).balanceOf(address(this));
        uint256 len = withdrawQueue.length;
        for (uint256 i = 0; i < len; i++) {
            address strategy = withdrawQueue[i];
            StrategyConfig storage config = strategies[strategy];
            if (!config.registered || !config.isSynchronous) {
                continue;
            }
            try IERC4626(strategy).maxWithdraw(address(this)) returns (uint256 available) {
                liquidity += available;
            } catch {
                // Strategy is bricked - skip it
            }
        }
        return liquidity;
    }

    function _maxDepositOrZero(address strategy) internal view returns (uint256) {
        try IERC4626(strategy).maxDeposit(address(this)) returns (uint256 amount) {
            return amount;
        } catch {
            return 0;
        }
    }

    function _setTimelockDelay(uint256 newDelay, bool enforceDecreaseGuard) internal {
        if (newDelay < MIN_TIMELOCK_DELAY) {
            revert InvalidTimelockDelay();
        }
        uint256 oldDelay = timelockDelay;
        if (enforceDecreaseGuard && newDelay < oldDelay) {
            revert TimelockRequired();
        }
        timelockDelay = newDelay;
        emit TimelockDelayUpdated(oldDelay, newDelay);
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    modifier onlyCuratorOrOwner() {
        if (!hasRole(CURATOR_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotAuthorized();
        }
        _;
    }

    modifier onlyGuardianOrOwner() {
        if (!hasRole(GUARDIAN_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotAuthorized();
        }
        _;
    }
}
