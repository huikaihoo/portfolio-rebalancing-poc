# GitHub Copilot / AI Agent Instructions ✅

## Quick summary

- This is a TypeScript Proof-of-Concept that computes **integer-share** portfolio rebalances respecting a required cash buffer. The program is run with **Bun** (no build step required). The math uses **decimal.js** for precise money math.

## Start here (commands) 🔧

- Install deps: `bun install`
- Run demo: `bun run index.ts` (prints before/after status and expected trades)
- Run tests: `bun test` (uses `bun:test`; see `rebalancer.test.ts` for scenarios)

## Big picture & key files 🧭

- `index.ts` — simple demo scenario and expected outputs (useful for quick manual checks).
- `rebalancer.ts` — core algorithm (class `SimpleRebalancer`) that implements the 5-step process from `specification.md`.
- `interface.ts` — canonical shapes (`AssetInput`, `GlobalInput`, `TradeInstruction`, `RebalanceResult`), and contracts (`IPortfolioRebalancer`, `IPortfolioReporter`) — use these when adding or validating inputs/outputs.
- `reporter.ts` — prints aligned tables and formatting helpers; useful for validating human-readable outputs in demos.
- `rebalancer.test.ts` & `test_suite.md` — authoritative tests and test descriptions that mirror the specification; add new tests here for edge cases.
- `specification.md` — canonical process flow and example calculations; follow it when extending logic.

## Project-specific conventions & patterns ⚙️

- Money & percentages use `Decimal` (from `decimal.js`) everywhere for arithmetic and comparisons. Do not use native `number` for monetary calculations.
- Shares are always integers. `TradeInstruction.shareChange` is positive for BUY, negative for SELL.
- Target allocations are `Decimal` in range [0,1] (e.g., `new Decimal(0.25)` for 25%). The code assumes allocations sum to 1 in tests/spec.
- Sales use `ceil(|ideal|)` (conservative), buys use `floor(ideal)` and then a top-up reduction/top-up loop to fit the budget (see `executeOptimizedTrades` in `rebalancer.ts`).
- Output formatting: currency uses `.toFixed(2)` and reporter aligns columns using fixed WIDTHS — tests and human verification depend on this formatting.

## Optimization specifics to preserve 📌

- Conservative sales: for each negative ideal share change, sell `ceil(abs(ideal))` to increase liquidity.
- Purchase budget: `C_purchase_max = C_old + C_new + C_sales - C_req`.
- If initial buy cost > budget → iteratively _reduce_ from assets with smallest fractional part first.
- If initial buy cost < budget → _top up_ purchases prioritizing largest fractional parts until the budget is exhausted.
- A refinement loop attempts global swaps (sell 1 of X to buy multiple of Y) when it reduces the total percentage drift — keep this behavior and its threshold check if you change the objective function.

## Testing guidance 🧪

- Tests run under Bun: `bun test`. The file `rebalancer.test.ts` captures required scenarios (TC-01..TC-07). Add tests when adding behavior (edge cases, rounding changes, different optimization targets).
- Use direct comparisons to expected integer share results and exact remainder cash values (e.g., `expect(result.remainderCash.toNumber()).toBe(58)`).

## Common pitfalls & how to avoid them ⚠️

- Mixing `number` with `Decimal` causes precision and comparison bugs — prefer creating `new Decimal(...)` for any numeric literal used in calculations or tests.
- Changing widths/formatting in `reporter.ts` may break human-readable expectations in `index.ts` demos; update demos/tests accordingly.
- Do not assume `targetAllocation` sums to 1; tests and `specification.md` do, but defensive checks are safe to add if you change scope.

## When modifying the algorithm ✍️

- Update `specification.md` and `test_suite.md` with the precise new expected outcomes and rationale.
- Add tests showing the exact numeric expectations (integer shares & remainder cash) to prevent regressions.
- Keep the `Decimal` math and the swap/refinement loop semantics, or document why those choices changed.

---

If anything is unclear or you'd like more examples (e.g., a short PR template for algorithm changes), tell me which section to expand and I'll iterate. 🙋‍♂️
