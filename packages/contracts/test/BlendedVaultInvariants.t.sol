// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";

import {BlendedVault} from "../src/BlendedVault.sol";
import {MockERC20USDC} from "../src/mocks/MockERC20USDC.sol";
import {MockERC4626Strategy} from "../src/mocks/MockERC4626Strategy.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "openzeppelin-contracts/interfaces/IERC4626.sol";

// ---------------------------------------------------------------------------
// Handler — wraps vault operations with bounded inputs and ghost tracking
// ---------------------------------------------------------------------------
contract BlendedVaultHandler is Test {
    BlendedVault public vault;
    MockERC20USDC public usdc;

    // Registered strategy addresses tracked for rebalance / strategy ops
    address[] public strategies;

    // Actors for deposit / withdraw
    address[] public actors;
    address internal currentActor; // set by useActor modifier

    // Ghost variables
    uint256 public ghost_totalDepositAssets;
    uint256 public ghost_totalWithdrawAssets;

    // ── Constructor & setup ──────────────────────────────────────────────

    constructor(BlendedVault _vault, MockERC20USDC _usdc) {
        vault = _vault;
        usdc = _usdc;

        // Create 5 actors and seed them with USDC
        for (uint256 i = 0; i < 5; i++) {
            actors.push(makeAddr(string(abi.encodePacked("actor", i))));
            usdc.mint(actors[i], 1_000_000e6); // 1M USDC each
        }
    }

    /// Register a strategy address so the handler knows about it for rebalance
    function addStrategyAddr(address strat) external {
        strategies.push(strat);
    }

    // ── Actor helper ─────────────────────────────────────────────────────

    modifier useActor(uint256 actorSeed) {
        currentActor = actors[bound(actorSeed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
        currentActor = address(0);
    }

    // ── User-facing vault operations ─────────────────────────────────────

    function deposit(uint256 amount, uint256 actorSeed) external useActor(actorSeed) {
        uint256 maxDep = usdc.balanceOf(currentActor) / 2;
        if (maxDep == 0) return;
        amount = bound(amount, 1e6, maxDep); // 1 USDC .. half of actor balance

        usdc.approve(address(vault), amount);
        vault.deposit(amount, currentActor);
        ghost_totalDepositAssets += amount;
    }

    function withdraw(uint256 amount, uint256 actorSeed) external useActor(actorSeed) {
        uint256 vaultShares = vault.balanceOf(currentActor);
        if (vaultShares == 0) return;

        // Don't try to withdraw more shares than we have
        uint256 maxAssets = vault.maxWithdraw(currentActor);
        if (maxAssets == 0) return;

        amount = bound(amount, 1e6, maxAssets); // 1 USDC .. maxWithdraw
        vault.withdraw(amount, currentActor, currentActor);
        ghost_totalWithdrawAssets += amount;
    }

    // ── Allocator operations ────────────────────────────────────────────

    function rebalance(uint256 withdrawIdx, uint256 depositIdx, uint256 amountSeed)
        external
    {
        // Need at least two strategies to do a rebalance
        if (strategies.length < 2) return;

        address withdrawStrat = strategies[withdrawIdx % strategies.length];
        address depositStrat = strategies[depositIdx % strategies.length];

        // Must be registered & enabled
        (bool wReg,,,,) = vault.strategies(withdrawStrat);
        (bool dReg,,,,) = vault.strategies(depositStrat);
        if (!wReg || !dReg) return;

        // Determine how much we can withdraw from the withdraw strategy
        uint256 stratShares = IERC20(withdrawStrat).balanceOf(address(vault));
        if (stratShares == 0) return;

        uint256 maxW = IERC4626(withdrawStrat).maxWithdraw(address(vault));
        if (maxW == 0) return;

        // Bounded withdraw amount
        uint256 wAmount = bound(amountSeed, 1e6, maxW);

        // Build array for rebalance call
        address[] memory wStrats = new address[](1);
        wStrats[0] = withdrawStrat;
        uint256[] memory wAmounts = new uint256[](1);
        wAmounts[0] = wAmount;

        // Allocator role needed
        bytes32 allocatorRole = vault.ALLOCATOR_ROLE();
        bool hasRole = vault.hasRole(allocatorRole, address(this));
        if (!hasRole) return; // skip - can't rebalance without role

        address[] memory dStrats = new address[](1);
        dStrats[0] = depositStrat;
        uint256[] memory dAmounts = new uint256[](1);
        // Only try to deposit a small amount - may fail due to caps/tiers, and that's ok
        dAmounts[0] = wAmount / 10 + 1;

        // Rebalance can revert for many valid reasons (caps, tiers, etc.)
        // We catch reverts so the invariant fuzzer keeps running
        vm.prank(address(this));
        try vault.rebalance(wStrats, wAmounts, dStrats, dAmounts) {
            // success
        } catch {
            // expected failures are OK - caps, tier limits, etc.
        }
    }

    function harvest() external {
        bytes32 allocatorRole = vault.ALLOCATOR_ROLE();
        if (!vault.hasRole(allocatorRole, address(this))) return;

        // Harvest can revert (same block, too soon, increase too high, etc.)
        vm.prank(address(this));
        try vault.harvest() {
            // success
        } catch {
            // expected
        }
    }

    // ── Strategy manipulation (simulate yield / loss) ───────────────────

    function simulateYield(uint256 stratIdx, uint256 amountSeed) external {
        if (stratIdx >= strategies.length) return;
        MockERC4626Strategy strat = MockERC4626Strategy(strategies[stratIdx]);

        // Only yield if vault has shares in this strategy
        uint256 shares = IERC20(address(strat)).balanceOf(address(vault));
        if (shares == 0) return;

        // Bound yield to a reasonable fraction of TVL
        uint256 currentAssets = strat.previewRedeem(shares);
        uint256 yieldAmt = bound(amountSeed, 1e6, currentAssets / 10); // up to 10% yield

        if (yieldAmt == 0) return;

        // Anyone can call simulateYield on the mock
        strat.simulateYield(yieldAmt);
    }

    function simulateLoss(uint256 stratIdx, uint256 amountSeed) external {
        if (stratIdx >= strategies.length) return;
        MockERC4626Strategy strat = MockERC4626Strategy(strategies[stratIdx]);

        uint256 shares = IERC20(address(strat)).balanceOf(address(vault));
        if (shares == 0) return;

        uint256 vaultAssetsInStrat = strat.previewRedeem(shares);
        if (vaultAssetsInStrat <= 1e6) return; // nothing meaningful to lose

        uint256 lossAmt = bound(amountSeed, 1e6, vaultAssetsInStrat / 10); // up to 10% loss

        if (lossAmt == 0) return;
        strat.simulateLoss(lossAmt);
    }
}

// ---------------------------------------------------------------------------
// Invariant tests
// ---------------------------------------------------------------------------
contract BlendedVaultInvariants is Test {
    uint256 internal constant USDC = 1e6;

    BlendedVault vault;
    BlendedVaultHandler handler;
    MockERC20USDC usdc;
    MockERC4626Strategy stratA;
    MockERC4626Strategy stratB;

    function setUp() public {
        // ── Deploy base contracts ────────────────────────────────────────
        address owner = makeAddr("owner");
        address curator = makeAddr("curator");
        address allocator = makeAddr("allocator");
        address guardian = makeAddr("guardian");
        address feeRecipient = makeAddr("feeRecipient");

        usdc = new MockERC20USDC();

        uint256[3] memory tierMaxBps = [uint256(10_000), uint256(10_000), uint256(10_000)];
        vault = new BlendedVault(
            usdc,
            "Blended Vault USDC",
            "bvUSDC",
            owner,
            curator,
            allocator,
            guardian,
            feeRecipient,
            tierMaxBps,
            0,               // idleLiquidityBps - 0 means deploy all to strategies
            1 * USDC,        // minInitialDeposit
            0,               // maxDailyIncreaseBps
            30 minutes,      // minHarvestInterval
            1 days           // timelockDelay
        );

        stratA = new MockERC4626Strategy(usdc, "Strategy A", "sA");
        stratB = new MockERC4626Strategy(usdc, "Strategy B", "sB");

        // ── Add strategies via timelock ──────────────────────────────────
        bytes32 saltA = keccak256("STRAT_A");
        bytes32 saltB = keccak256("STRAT_B");

        vm.startPrank(curator);
        vault.scheduleAddStrategy(address(stratA), 0, 1_000_000 * USDC, true, saltA);
        vault.scheduleAddStrategy(address(stratB), 1, 1_000_000 * USDC, true, saltB);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);

        vm.startPrank(curator);
        vault.executeAddStrategy(address(stratA), 0, 1_000_000 * USDC, true, saltA);
        vault.executeAddStrategy(address(stratB), 1, 1_000_000 * USDC, true, saltB);
        vm.stopPrank();

        // ── Set deposit / withdraw queues ────────────────────────────────
        address[] memory depositQ = new address[](2);
        depositQ[0] = address(stratA);
        depositQ[1] = address(stratB);
        address[] memory withdrawQ = new address[](2);
        withdrawQ[0] = address(stratA);
        withdrawQ[1] = address(stratB);

        vm.prank(allocator);
        vault.setDepositQueue(depositQ);
        vm.prank(allocator);
        vault.setWithdrawQueue(withdrawQ);

        // ── Deploy handler and grant it ALLOCATOR_ROLE ───────────────────
        handler = new BlendedVaultHandler(vault, usdc);
        handler.addStrategyAddr(address(stratA));
        handler.addStrategyAddr(address(stratB));

        // Grant ALLOCATOR_ROLE to the handler so it can call rebalance & harvest
        vm.startPrank(owner);
        vault.grantRole(vault.ALLOCATOR_ROLE(), address(handler));
        vm.stopPrank();

        // Seed the vault with a first deposit so there's always TVL
        usdc.mint(address(this), 10_000 * USDC);
        usdc.approve(address(vault), 10_000 * USDC);
        vault.deposit(10_000 * USDC, address(this));

        // ── Configure Foundry invariant fuzzing ──────────────────────────
        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = BlendedVaultHandler.deposit.selector;
        selectors[1] = BlendedVaultHandler.withdraw.selector;
        selectors[2] = BlendedVaultHandler.rebalance.selector;
        selectors[3] = BlendedVaultHandler.harvest.selector;
        selectors[4] = BlendedVaultHandler.simulateYield.selector;
        selectors[5] = BlendedVaultHandler.simulateLoss.selector;
        selectors[6] = BlendedVaultHandler.addStrategyAddr.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));

        // Set invariant test parameters: 1,000 runs with 100 calls each
        // (can be overridden via FOUNDRY_INVARIANT_RUNS env or foundry.toml)
    }

    // ── Invariant 1: totalAssets >= idle USDC balance ─────────────────

    function invariant_totalAssets_always_covers_idle() public view {
        uint256 idle = IERC20(address(usdc)).balanceOf(address(vault));
        uint256 total = vault.totalAssets();

        // totalAssets must always be at least the idle balance
        assertGe(total, idle, "totalAssets < idle USDC - assets created from thin air");
    }

    // ── Invariant 2: sum(strategyAssets) + idle == totalAssets ─────────

    function invariant_strategy_assets_plus_idle_equals_totalAssets() public view {
        uint256 idle = IERC20(address(usdc)).balanceOf(address(vault));
        uint256 total = vault.totalAssets();

        // Sum strategy assets using the vault's own strategyAssets() view
        address[] memory strats = vault.getStrategies();
        uint256 sumStrat;
        for (uint256 i = 0; i < strats.length; i++) {
            // Only count registered strategies
            (bool registered,,,,) = vault.strategies(strats[i]);
            if (!registered) continue;

            // Skip strategies where vault has no shares
            uint256 shares = IERC20(strats[i]).balanceOf(address(vault));
            if (shares == 0) continue;

            uint256 sAssets = vault.strategyAssets(strats[i]);
            sumStrat += sAssets;
        }

        // Allow a 1 wei rounding difference due to previewRedeem rounding
        uint256 computed = sumStrat + idle;
        if (total < computed) {
            uint256 diff = computed - total;
            assertLe(diff, 2, "totalAssets is less than strategyAssets + idle by more than rounding");
        } else {
            uint256 diff = total - computed;
            assertLe(diff, 2, "totalAssets exceeds strategyAssets + idle by more than rounding");
        }
    }
}
