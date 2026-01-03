# portfolio-rebalancing-poc

[![CI](https://github.com/huikaihoo/portfolio-rebalancing-poc/actions/workflows/ci.yml/badge.svg)](https://github.com/huikaihoo/portfolio-rebalancing-poc/actions/workflows/ci.yml)

A compact TypeScript proof-of-concept that computes integer-share portfolio rebalances while preserving a required cash buffer. It uses Bun as the runtime and `decimal.js` for precise monetary math.

## 🔧 Quick start

- Install dependencies:

```bash
bun install
```

- Run the demo:

```bash
bun run index.ts
```

- Run tests:

```bash
bun test
```

---

## 🧭 Project structure (high level)

- `index.ts` — small demo scenario, prints before/after portfolio and expected trades.
- `rebalancer.ts` — core algorithm (`SimpleRebalancer`) implementing the 5-step specification.
- `interface.ts` — canonical types and contracts (`AssetInput`, `GlobalInput`, `TradeInstruction`, etc.).
- `reporter.ts` — console reporting / aligned table output used by the demo.
- `rebalancer.test.ts`, `test_suite.md` — tests and test plan covering required scenarios (TC-01..TC-07).
- `specification.md` — authoritative algorithm description and examples.

---

## ⚙️ Conventions & gotchas

- Use `Decimal` (from `decimal.js`) for all money and percentage math. Avoid mixing `number` with `Decimal` to prevent precision and comparison issues.
- Shares are integers. `TradeInstruction.shareChange` is positive for BUY and negative for SELL.
- The algorithm:
  - Sells conservatively using `ceil(|ideal|)` to generate liquidity.
  - Buys conservatively using `floor(ideal)` then performs top-up or reductions to respect the cash buffer.
  - Includes a refinement loop that may swap shares to minimize percentage drift — preserve this behavior when changing optimization rules.
- Formatting: reporter uses fixed column widths and `toFixed(2)` for currency; changing these can affect expectations in human-facing demos.

---

## 🧪 Testing & extending

- Write tests in `rebalancer.test.ts`. Tests assert exact integer share outcomes and remainder cash values (e.g., `expect(result.remainderCash.toNumber()).toBe(58)`).
- When changing algorithm behavior, update `specification.md` and `test_suite.md` with precise expected outcomes and add corresponding tests to avoid regressions.
