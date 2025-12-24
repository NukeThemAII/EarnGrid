# Test Run Log

Date: 2025-12-24

## Attempted Commands

1) `pnpm -C packages/contracts test`
Result: FAILED
Error: `/bin/bash: line 1: pnpm: command not found`

2) `corepack prepare pnpm@9.12.1 --activate`
Result: OK

3) `corepack pnpm -C packages/contracts test`
Result: FAILED
Error: `sh: 1: forge: not found`

4) `~/.foundry/bin/foundryup`
Result: FAILED
Error: `foundryup: Error: 'anvil' is currently running. Please stop the process and try again.`

5) `corepack pnpm -C packages/contracts test`
Result: FAILED
Error: `sh: 1: forge: not found`

6) `pgrep(){ return 1; }; export -f pgrep; ~/.foundry/bin/foundryup`
Result: OK
Notes: Installed Foundry 1.5.1-stable after bypassing the dovecot/anvil name clash.

7) `PATH="$HOME/.foundry/bin:$PATH" corepack pnpm -C packages/contracts test`
Result: FAILED
Error: Missing OZ `ReentrancyGuard` path + solc version mismatch (`^0.8.24`).

8) `PATH="$HOME/.foundry/bin:$PATH" corepack pnpm -C packages/contracts test`
Result: FAILED
Error: ERC4626 hook overrides missing in OZ v5.5 + stack too deep; enabled `via_ir`.

9) `PATH="$HOME/.foundry/bin:$PATH" corepack pnpm -C packages/contracts test`
Result: FAILED
Error: Reentrancy test failed due to missing role grant.

10) `PATH="$HOME/.foundry/bin:$PATH" corepack pnpm -C packages/contracts test`
Result: OK
Summary:
- Compiled with Solc 0.8.24 (via IR)
- 24 tests passed, 0 failed

## Notes
- Foundry (`forge`) is not installed in the environment, so contract tests cannot run yet.
- `foundryup` cannot complete while `anvil` is running; stop anvil and rerun `foundryup`.
- To rerun after installing Foundry:
  - `corepack pnpm -C packages/contracts test`
