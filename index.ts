// index.ts

import { Decimal } from "decimal.js";
import type { AssetInput, GlobalInput } from "./interface";
import { SimpleRebalancer } from "./rebalancer";
import { ConsolePortfolioReporter } from "./reporter";

/**
 * SCENARIO A: Overspending / Budget Reduction
 * This scenario matches the revised specification (Section 6).
 * It includes existing cash and requires the logic to reduce buys
 * to maintain the $50.00 cash buffer.
 */

const ASSETS: AssetInput[] = [
  {
    ticker: "A",
    price: new Decimal(9.0),
    currentShares: 100,
    targetAllocation: new Decimal(0.25),
  },
  {
    ticker: "B",
    price: new Decimal(50.0),
    currentShares: 60,
    targetAllocation: new Decimal(0.5),
  },
  {
    ticker: "C",
    price: new Decimal(18.0),
    currentShares: 50,
    targetAllocation: new Decimal(0.25),
  },
];

const GLOBAL_INPUT: GlobalInput = {
  existingCashAmount: new Decimal(100.0), // C_old
  newCapitalAmount: new Decimal(400.0), // C_new
  requiredCashBuffer: new Decimal(50.0), // C_req
};

// Initialize Brain (Rebalancer) and Eyes (Reporter)
const rebalancer = new SimpleRebalancer();
const reporter = new ConsolePortfolioReporter();

// --- 1. SETUP LOG ---
console.log("--- Starting Portfolio Rebalance PoC ---");
console.log(
  `Existing Cash  (C_old): $${GLOBAL_INPUT.existingCashAmount.toFixed(2)}`
);
console.log(
  `New Capital    (C_new): $${GLOBAL_INPUT.newCapitalAmount.toFixed(2)}`
);
console.log(
  `Required Buffer (C_req): $${GLOBAL_INPUT.requiredCashBuffer.toFixed(2)}`
);

// --- 2. CALCULATE AND SHOW STATUS BEFORE ---
// We calculate status with an empty trades array to see the "Current" state
const before = reporter.calculateStatus(ASSETS, []);
reporter.printStatus(
  "Portfolio BEFORE Rebalance",
  before.status,
  before.totalAssetValue,
  GLOBAL_INPUT.existingCashAmount
);

// --- 3. PERFORM REBALANCE CALCULATION ---
const result = rebalancer.calculateRebalance(ASSETS, GLOBAL_INPUT);

// --- 4. DISPLAY TRADE INSTRUCTIONS ---
console.log("\n--- Execution: Trade Instructions (Delta S_i) ---");
for (const trade of result.trades) {
  if (trade.shareChange === 0) {
    console.log(`- ${trade.ticker.padEnd(5)}: HOLD`);
  } else {
    const action = trade.shareChange > 0 ? "BUY " : "SELL";
    console.log(
      `- ${trade.ticker.padEnd(5)}: ${action} ${Math.abs(
        trade.shareChange
      )} shares`
    );
  }
}

// --- 5. CALCULATE AND SHOW STATUS AFTER ---
// Pass the trades and the remainder cash to show the final allocation
const after = reporter.calculateStatus(ASSETS, result.trades);
reporter.printStatus(
  "Portfolio AFTER Rebalance",
  after.status,
  after.totalAssetValue,
  result.remainderCash
);

// --- 6. FINAL CONSTRAINT VERIFICATION ---
const isCashValid = result.remainderCash.gte(GLOBAL_INPUT.requiredCashBuffer);

console.log("\n--- Summary Verification ---");
console.log(`✅ Remainder Cash (C_rem): $${result.remainderCash.toFixed(2)}`);
console.log(
  `   Constraint Check (C_rem >= C_req): ${isCashValid ? "PASS" : "FAIL"}`
);

console.log("\n--- Expected vs. Actual (Specification Check) ---");
console.log(`   Expected Trades: A: BUY 42, B: SELL 7, C: BUY 23`);
console.log(`   Expected C_rem:  $58.00`);
