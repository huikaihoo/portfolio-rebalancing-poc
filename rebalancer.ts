import { Decimal } from "decimal.js";
import type {
  IPortfolioRebalancer,
  AssetInput,
  GlobalInput,
  RebalanceResult,
  TradeInstruction,
} from "./interface";

// Helper interface updated to include necessary fields for optimization
interface RebalanceIntermediate extends AssetInput {
  currentValue: Decimal;
  targetValue: Decimal;
  idealShareChange: Decimal;
  sharesToBuy: number;
  sharesToSell: number;
  // For optimization prioritization: how much the asset was rounded down
  fractionalPart: Decimal;
}

export class SimpleRebalancer implements IPortfolioRebalancer {
  public calculateRebalance(
    assets: AssetInput[],
    globalInput: GlobalInput
  ): RebalanceResult {
    // 1. Initial Calculations (Steps 1 & 2)
    const initialCalculations = this.getInitialCalculations(
      assets,
      globalInput
    );

    // 2. Step 3: Conservative Sales
    const totalSalesCash =
      this.calculateSalesAndInitialBuys(initialCalculations);

    // 3. Step 4: Determine Purchase Budget (C_liquid - C_req)
    // C_liquid = C_old + C_new + C_sales
    const totalLiquidCash = globalInput.existingCashAmount
      .plus(globalInput.newCapitalAmount)
      .plus(totalSalesCash);

    const maxPurchaseBudget = totalLiquidCash.minus(
      globalInput.requiredCashBuffer
    );

    // 4. Step 5: Optimized Buy/Sell Logic
    const { trades, finalPurchaseCost, remainderCash } =
      this.executeOptimizedTrades(
        initialCalculations,
        maxPurchaseBudget,
        totalLiquidCash
      );

    return {
      trades: trades,
      remainderCash: remainderCash,
    };
  }

  // --- PRIVATE HELPER METHODS ---

  private getInitialCalculations(
    assets: AssetInput[],
    globalInput: GlobalInput
  ): RebalanceIntermediate[] {
    let totalAssetValue = new Decimal(0);

    const intermediates: RebalanceIntermediate[] = assets.map((asset) => {
      const currentValue = asset.price.times(asset.currentShares);
      totalAssetValue = totalAssetValue.plus(currentValue);
      return {
        ...asset,
        currentValue,
        targetValue: new Decimal(0),
        idealShareChange: new Decimal(0),
        sharesToBuy: 0,
        sharesToSell: 0,
        fractionalPart: new Decimal(0),
      };
    });

    // V_total = V_assets + C_old + C_new
    const totalPortfolioValue = totalAssetValue
      .plus(globalInput.existingCashAmount)
      .plus(globalInput.newCapitalAmount);

    return intermediates.map((item) => {
      const targetValue = item.targetAllocation.times(totalPortfolioValue);
      const idealValueChange = targetValue.minus(item.currentValue);
      const idealShareChange = idealValueChange.dividedBy(item.price);

      // Fractional part for optimization priority
      const fractionalPart = idealShareChange.minus(idealShareChange.floor());

      return { ...item, targetValue, idealShareChange, fractionalPart };
    });
  }

  private calculateSalesAndInitialBuys(
    intermediates: RebalanceIntermediate[]
  ): Decimal {
    let salesCash = new Decimal(0);

    for (const item of intermediates) {
      if (item.idealShareChange.isNegative()) {
        const sharesToSell = Math.ceil(item.idealShareChange.abs().toNumber());
        item.sharesToSell = sharesToSell;
        salesCash = salesCash.plus(item.price.times(sharesToSell));
      } else {
        const sharesToBuy = Math.floor(item.idealShareChange.toNumber());
        item.sharesToBuy = sharesToBuy;
      }
    }
    return salesCash;
  }

  private executeOptimizedTrades(
    intermediates: RebalanceIntermediate[],
    maxPurchaseBudget: Decimal,
    totalLiquidCash: Decimal
  ): {
    trades: TradeInstruction[];
    finalPurchaseCost: Decimal;
    remainderCash: Decimal;
  } {
    let initialBuyCost = new Decimal(0);
    for (const item of intermediates) {
      if (item.sharesToBuy > 0) {
        initialBuyCost = initialBuyCost.plus(
          item.price.times(item.sharesToBuy)
        );
      }
    }

    const buys = intermediates.filter((i) => i.sharesToBuy > 0);

    if (initialBuyCost.greaterThan(maxPurchaseBudget)) {
      // Case A: Overspending -> Reduce
      let amountToReduce = initialBuyCost.minus(maxPurchaseBudget);
      console.warn(
        `[Optimization] Overspending detected: Need to reduce purchases by $${amountToReduce.toFixed(
          2
        )}.`
      );

      const reductionCandidates = buys.sort((a, b) =>
        a.fractionalPart.comparedTo(b.fractionalPart)
      );

      for (const asset of reductionCandidates) {
        // While we still owe money to the buffer
        while (
          amountToReduce.greaterThan(new Decimal(0)) &&
          asset.sharesToBuy > 0
        ) {
          asset.sharesToBuy -= 1;
          amountToReduce = amountToReduce.minus(asset.price);

          // If amountToReduce is now 0 or negative, we have successfully
          // protected the required cash buffer.
          if (amountToReduce.lessThanOrEqualTo(0)) break;
        }
        if (amountToReduce.lessThanOrEqualTo(0)) break;
      }
    } else if (initialBuyCost.lessThan(maxPurchaseBudget)) {
      // Case B: Underspending -> Top-up
      let bufferToSpend = maxPurchaseBudget.minus(initialBuyCost);
      let topUpCandidates = buys.sort((a, b) =>
        b.fractionalPart.comparedTo(a.fractionalPart)
      );

      let madePurchase = true;
      while (madePurchase) {
        madePurchase = false;
        for (const asset of topUpCandidates) {
          const idealCeiling = Math.ceil(asset.idealShareChange.toNumber());
          if (
            asset.sharesToBuy < idealCeiling &&
            bufferToSpend.greaterThanOrEqualTo(asset.price)
          ) {
            asset.sharesToBuy += 1;
            bufferToSpend = bufferToSpend.minus(asset.price);
            madePurchase = true;
            break;
          }
        }
      }
    }

    // --- REFINEMENT LOOP: Global Optimization to Minimize Drift ---
    // This step performs "swaps" (e.g., selling 1 share of C to buy 2 shares of A)
    // to improve target allocation without violating the cash buffer.
    let currentTotalCost = intermediates.reduce(
      (acc, item) => acc.plus(item.price.times(item.sharesToBuy)),
      new Decimal(0)
    );

    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < intermediates.length; i++) {
        for (let j = 0; j < intermediates.length; j++) {
          if (i === j) continue;
          const assetOut = intermediates[i];
          const assetIn = intermediates[j];

          // Guard against undefined array access (TypeScript strict checks)
          if (!assetOut || !assetIn) continue;

          if (assetOut.sharesToBuy > 0) {
            const currentDrift = this.calculatePercentDrift(intermediates);
            const oldSharesOut = assetOut.sharesToBuy;
            const oldSharesIn = assetIn.sharesToBuy;

            // Try swapping: Reduce assetOut, increase assetIn
            assetOut.sharesToBuy--;
            const costAfterRemoval = currentTotalCost.minus(assetOut.price);
            const canAffordIn = Math.floor(
              maxPurchaseBudget
                .minus(costAfterRemoval)
                .dividedBy(assetIn.price)
                .toNumber()
            );

            if (canAffordIn > 0) {
              console.warn(
                `[Optimization] Attempting swap: buy ${canAffordIn} shares of ${assetIn.ticker} after selling 1 share of ${assetOut.ticker}.`
              );
              assetIn.sharesToBuy += canAffordIn;
              const newDrift = this.calculatePercentDrift(intermediates);
              console.warn(
                `[Optimization] New drift after swap: ${newDrift.toFixed(
                  4
                )}, Previous drift: ${currentDrift.toFixed(4)}`
              );

              // If the new drift is significantly lower, keep the change
              if (newDrift.lt(currentDrift.minus(0.0001))) {
                currentTotalCost = costAfterRemoval.plus(
                  assetIn.price.times(canAffordIn)
                );
                improved = true;
              } else {
                // Revert
                assetOut.sharesToBuy = oldSharesOut;
                assetIn.sharesToBuy = oldSharesIn;
              }
            } else {
              // Revert removal if we can't even buy 1 of the other asset
              assetOut.sharesToBuy = oldSharesOut;
            }
          }
        }
      }
    }

    let finalPurchaseCost = new Decimal(0);
    for (const item of intermediates) {
      if (item.sharesToBuy > 0) {
        finalPurchaseCost = finalPurchaseCost.plus(
          item.price.times(item.sharesToBuy)
        );
      }
    }

    const finalTrades: TradeInstruction[] = intermediates.map((item) => ({
      ticker: item.ticker,
      shareChange: item.sharesToBuy - item.sharesToSell,
    }));

    // C_rem = C_liquid - C_purchase
    const remainderCash = totalLiquidCash.minus(finalPurchaseCost);

    return { trades: finalTrades, finalPurchaseCost, remainderCash };
  }

  /**
   * Calculates the total absolute dollar drift from target values.
   * Total Drift = Sum(|CurrentValue_i - TargetValue_i|)
   */
  private calculateTotalDrift(items: RebalanceIntermediate[]): Decimal {
    let totalDrift = new Decimal(0);
    for (const item of items) {
      const currentHoldings =
        item.currentShares + item.sharesToBuy - item.sharesToSell;
      const currentValue = item.price.times(currentHoldings);
      totalDrift = totalDrift.plus(currentValue.minus(item.targetValue).abs());
    }
    return totalDrift;
  }

  /**
   * Calculates the total absolute % drift across all assets (Ignoring Cash).
   * Total % Drift = Sum(|(AssetValue_i / TotalAssetValue) - TargetAllocation_i|)
   */
  private calculatePercentDrift(items: RebalanceIntermediate[]): Decimal {
    let totalAssetValue = new Decimal(0);
    const holdings = items.map((item) => {
      const shares = item.currentShares + item.sharesToBuy - item.sharesToSell;
      const value = item.price.times(shares);
      totalAssetValue = totalAssetValue.plus(value);
      return { value, target: item.targetAllocation };
    });

    if (totalAssetValue.isZero()) return new Decimal(0);

    let totalPercentDrift = new Decimal(0);
    for (const h of holdings) {
      const actualPercent = h.value.dividedBy(totalAssetValue);
      totalPercentDrift = totalPercentDrift.plus(
        actualPercent.minus(h.target).abs()
      );
    }

    return totalPercentDrift;
  }
}
