import { Decimal } from "decimal.js";

/**
 * @interface AssetInput
 * Defines the initial state and target for a single stock/ETF.
 * All financial values (Price, Target) use Decimal for precision.
 */
export interface AssetInput {
  /** The unique identifier for the asset (e.g., 'AAPL', 'VTI'). */
  ticker: string;

  /** Current market price per share (Pi). Must use Decimal. */
  price: Decimal;

  /** Current shares held (Si). Must be an integer (0 or positive). */
  currentShares: number;

  /** Target allocation percentage (Ti). Must use Decimal (e.g., 0.25 for 25%). */
  targetAllocation: Decimal;
}

/**
 * @interface GlobalInput
 * Defines the global cash parameters and budget constraints for the rebalance operation.
 */
export interface GlobalInput {
  /** Cash already sitting in the account before rebalance (C_old). Must use Decimal. */
  existingCashAmount: Decimal;

  /** New financial amount to be injected (C_new). Must use Decimal. */
  newCapitalAmount: Decimal;

  /** Minimum financial buffer required (C_req) for assumed transaction costs. Must use Decimal. */
  requiredCashBuffer: Decimal;
}

/**
 * @interface TradeInstruction
 * Defines the required action for a specific asset.
 */
export interface TradeInstruction {
  /** The unique identifier for the asset. */
  ticker: string;

  /** Shares to buy (positive) or sell (negative) (Delta S_i).
   * Must be an integer.
   */
  shareChange: number;
}

/**
 * @interface RebalanceResult
 * Defines the final output, including trade instructions and remainder cash.
 */
export interface RebalanceResult {
  /** Array of trade instructions for each asset. */
  trades: TradeInstruction[];

  /** Remainder financial amount (C_rem) after all transactions. Must use Decimal. */
  remainderCash: Decimal;
}

/**
 * @interface IPortfolioRebalancer
 * Defines the contract for any class responsible for calculating portfolio rebalance trades.
 */
export interface IPortfolioRebalancer {
  /**
   * Calculates the optimized, integer-share portfolio rebalancing trades.
   * * @param assets An array of AssetInput objects.
   * @param globalInput Global cash and budget constraints.
   * @returns A RebalanceResult object containing trades and remainder cash.
   */
  calculateRebalance(
    assets: AssetInput[],
    globalInput: GlobalInput
  ): RebalanceResult;
}

export interface PortfolioStatus {
  ticker: string;
  shares: number;
  price: Decimal;
  value: Decimal;
  percent: Decimal;
  target: Decimal;
}

/**
 * @interface IPortfolioReporter
 * Contract for analyzing and printing the state of the portfolio.
 */
export interface IPortfolioReporter {
  /** Calculates the current status based on a set of assets and optional trade changes. */
  calculateStatus(
    assets: AssetInput[],
    trades?: TradeInstruction[]
  ): { status: PortfolioStatus[]; totalAssetValue: Decimal };

  /** Prints the portfolio status to the console in an aligned table. */
  printStatus(
    title: string,
    status: PortfolioStatus[],
    totalAssetValue: Decimal,
    remainderCash?: Decimal
  ): void;
}
