import { expect, test, describe, beforeEach } from "bun:test";
import { Decimal } from "decimal.js";
import { SimpleRebalancer } from "./rebalancer";
import type { AssetInput, GlobalInput } from "./interface";

describe("SimpleRebalancer Test Suite", () => {
  let rebalancer: SimpleRebalancer;

  beforeEach(() => {
    rebalancer = new SimpleRebalancer();
  });

  test("TC-01: Ideal Whole-Number Case", () => {
    const assets: AssetInput[] = [
      {
        ticker: "A",
        price: new Decimal(10),
        currentShares: 0,
        targetAllocation: new Decimal(1),
      },
    ];
    const globalInput: GlobalInput = {
      existingCashAmount: new Decimal(0),
      newCapitalAmount: new Decimal(100),
      requiredCashBuffer: new Decimal(0),
    };

    const result = rebalancer.calculateRebalance(assets, globalInput);

    const tradeA = result.trades.find((t) => t.ticker === "A");
    expect(tradeA?.shareChange).toBe(10);
    expect(result.remainderCash.toNumber()).toBe(0);
  });

  test("TC-02: Overspending (Reduction Logic)", () => {
    const assets: AssetInput[] = [
      {
        ticker: "A",
        price: new Decimal(7),
        currentShares: 0,
        targetAllocation: new Decimal(1),
      },
    ];
    const globalInput: GlobalInput = {
      existingCashAmount: new Decimal(10),
      newCapitalAmount: new Decimal(0),
      requiredCashBuffer: new Decimal(5),
    };

    const result = rebalancer.calculateRebalance(assets, globalInput);

    const tradeA = result.trades.find((t) => t.ticker === "A");
    // Initial math wants 1.42 shares -> Floor(1) = 7 USD.
    // Remainder 10 - 7 = 3. 3 < 5 (buffer), so must reduce to 0.
    expect(tradeA?.shareChange).toBe(0);
    expect(result.remainderCash.toNumber()).toBe(10);
  });

  test("TC-03: Underspending (Top-up Logic)", () => {
    const assets: AssetInput[] = [
      {
        ticker: "A",
        price: new Decimal(30),
        currentShares: 0,
        targetAllocation: new Decimal(0.5),
      },
      {
        ticker: "B",
        price: new Decimal(30),
        currentShares: 0,
        targetAllocation: new Decimal(0.5),
      },
    ];
    const globalInput: GlobalInput = {
      existingCashAmount: new Decimal(100),
      newCapitalAmount: new Decimal(0),
      requiredCashBuffer: new Decimal(0),
    };

    const result = rebalancer.calculateRebalance(assets, globalInput);

    const totalShares = result.trades.reduce(
      (sum, t) => sum + t.shareChange,
      0
    );
    // 100 / 30 = 3.33 total shares possible. Should buy 3 shares total.
    expect(totalShares).toBe(3);
    expect(result.remainderCash.toNumber()).toBe(10);
  });

  test("TC-04: Global Optimization (The Balanced Swap)", () => {
    const assets: AssetInput[] = [
      {
        ticker: "A",
        price: new Decimal(9),
        currentShares: 100,
        targetAllocation: new Decimal(0.25),
      },
      {
        ticker: "B",
        price: new Decimal(50),
        currentShares: 60,
        targetAllocation: new Decimal(0.5),
      },
      {
        ticker: "C",
        price: new Decimal(18),
        currentShares: 50,
        targetAllocation: new Decimal(0.25),
      },
    ];
    const globalInput: GlobalInput = {
      existingCashAmount: new Decimal(100),
      newCapitalAmount: new Decimal(400),
      requiredCashBuffer: new Decimal(50),
    };

    const result = rebalancer.calculateRebalance(assets, globalInput);

    const tradeA = result.trades.find((t) => t.ticker === "A");
    const tradeB = result.trades.find((t) => t.ticker === "B");
    const tradeC = result.trades.find((t) => t.ticker === "C");

    // Optimized Result based on % Drift minimization
    expect(tradeA?.shareChange).toBe(44);
    expect(tradeB?.shareChange).toBe(-7);
    expect(tradeC?.shareChange).toBe(22);
    expect(result.remainderCash.toNumber()).toBe(58);
  });

  test("TC-05: Capital Integration (Old + New Cash)", () => {
    const assets: AssetInput[] = [
      {
        ticker: "A",
        price: new Decimal(10),
        currentShares: 0,
        targetAllocation: new Decimal(1),
      },
    ];
    const globalInput: GlobalInput = {
      existingCashAmount: new Decimal(50),
      newCapitalAmount: new Decimal(50),
      requiredCashBuffer: new Decimal(0),
    };

    const result = rebalancer.calculateRebalance(assets, globalInput);
    const tradeA = result.trades.find((t) => t.ticker === "A");

    expect(tradeA?.shareChange).toBe(10);
  });

  test("TC-06: Zero Change (Already Balanced)", () => {
    const assets: AssetInput[] = [
      {
        ticker: "A",
        price: new Decimal(10),
        currentShares: 10,
        targetAllocation: new Decimal(1),
      },
    ];
    const globalInput: GlobalInput = {
      existingCashAmount: new Decimal(0),
      newCapitalAmount: new Decimal(0),
      requiredCashBuffer: new Decimal(0),
    };

    const result = rebalancer.calculateRebalance(assets, globalInput);
    const tradeA = result.trades.find((t) => t.ticker === "A");

    expect(tradeA?.shareChange).toBe(0);
  });

  test("TC-07: Minimum Capital Constraint (Expensive Asset)", () => {
    const assets: AssetInput[] = [
      {
        ticker: "A",
        price: new Decimal(100),
        currentShares: 0,
        targetAllocation: new Decimal(1),
      },
    ];
    const globalInput: GlobalInput = {
      existingCashAmount: new Decimal(50),
      newCapitalAmount: new Decimal(0),
      requiredCashBuffer: new Decimal(0),
    };

    const result = rebalancer.calculateRebalance(assets, globalInput);
    const tradeA = result.trades.find((t) => t.ticker === "A");

    expect(tradeA?.shareChange).toBe(0);
    expect(result.remainderCash.toNumber()).toBe(50);
  });
});
