import { Decimal } from "decimal.js";
import type {
  IPortfolioReporter,
  AssetInput,
  TradeInstruction,
  PortfolioStatus,
} from "./interface";

export class ConsolePortfolioReporter implements IPortfolioReporter {
  private readonly WIDTHS = {
    TICKER: 8,
    SHARES: 7,
    PRICE: 10,
    VALUE: 11,
    PERCENT: 11,
    TARGET: 11,
    CHANGE: 12,
  };

  public calculateStatus(
    assets: AssetInput[],
    trades: TradeInstruction[] = []
  ): { status: PortfolioStatus[]; totalAssetValue: Decimal } {
    const shareChangesMap = new Map(
      trades.map((t) => [t.ticker, t.shareChange])
    );
    let totalAssetValue = new Decimal(0);

    const assetStatus: PortfolioStatus[] = assets.map((asset) => {
      const change = shareChangesMap.get(asset.ticker) || 0;
      const finalShares = asset.currentShares + change;
      const value = asset.price.times(finalShares);
      totalAssetValue = totalAssetValue.plus(value);
      return {
        ticker: asset.ticker,
        shares: finalShares,
        price: asset.price,
        value,
        percent: new Decimal(0),
        target: asset.targetAllocation,
      };
    });

    const status = assetStatus.map((s) => ({
      ...s,
      percent: totalAssetValue.isZero()
        ? new Decimal(0)
        : s.value.dividedBy(totalAssetValue),
    }));

    return { status, totalAssetValue };
  }

  public printStatus(
    title: string,
    status: PortfolioStatus[],
    totalAssetValue: Decimal,
    remainderCash?: Decimal
  ): void {
    console.log(`\n--- ${title} ---`);
    console.log(`Total Asset Value: $${totalAssetValue.toFixed(2)}`);
    if (remainderCash) {
      console.log(
        `Total Portfolio Value (Assets + Cash): $${totalAssetValue
          .plus(remainderCash)
          .toFixed(2)}`
      );
    }

    this.printSeparator();
    console.log(
      `| ${this.pad("Ticker", this.WIDTHS.TICKER, "left")} | ${this.pad(
        "Shares",
        this.WIDTHS.SHARES
      )} | ${this.pad("Unit Price", this.WIDTHS.PRICE)} | ${this.pad(
        "Value ($)",
        this.WIDTHS.VALUE
      )} | ${this.pad("Actual %", this.WIDTHS.PERCENT)} | ${this.pad(
        "Target %",
        this.WIDTHS.TARGET
      )} | ${this.pad("Diff (%)", this.WIDTHS.CHANGE)} |`
    );
    this.printSeparator();

    status.forEach((s) => {
      const diff = s.percent.minus(s.target).times(100);
      console.log(
        `| ${this.pad(s.ticker, this.WIDTHS.TICKER, "left")} | ` +
          `${this.pad(s.shares.toString(), this.WIDTHS.SHARES)} | ` +
          `${this.formatCurrency(s.price, this.WIDTHS.PRICE)} | ` +
          `${this.formatCurrency(s.value, this.WIDTHS.VALUE)} | ` +
          `${this.formatPercent(s.percent, this.WIDTHS.PERCENT)} | ` +
          `${this.formatPercent(s.target, this.WIDTHS.TARGET)} | ` +
          `${this.pad(diff, this.WIDTHS.CHANGE)} |`
      );
    });

    if (remainderCash) {
      console.log(
        `| ${this.pad("CASH", this.WIDTHS.TICKER, "left")} | ${this.pad(
          "N/A",
          this.WIDTHS.SHARES
        )} | ${this.pad("N/A", this.WIDTHS.PRICE)} | ${this.formatCurrency(
          remainderCash,
          this.WIDTHS.VALUE
        )} | ${this.pad("N/A", this.WIDTHS.PERCENT)} | ${this.pad(
          "N/A",
          this.WIDTHS.TARGET
        )} | ${this.pad("N/A", this.WIDTHS.CHANGE)} |`
      );
    }
    this.printSeparator();
  }

  private pad(
    str: string | Decimal,
    width: number,
    align: "left" | "right" = "right"
  ): string {
    let s = typeof str === "string" ? str : str.toFixed(2);
    return align === "right" ? s.padStart(width) : s.padEnd(width);
  }

  private formatCurrency(val: Decimal, width: number): string {
    return "$" + this.pad(val, width - 1);
  }

  private formatPercent(val: Decimal, width: number): string {
    return this.pad(val.times(100), width - 1) + "%";
  }

  private printSeparator(): void {
    const values = Object.values(this.WIDTHS);
    let totalWidth = 0;

    for (const w of values) {
      totalWidth += w;
    }

    // Logic: Total width of columns + (3 spaces/pipes per column boundary) + 1
    // For 6 columns, there are 7 dividers '| ' or ' |' or '|'.
    // We use (totalWidth + (3 * values.length) + 1) to match the table borders.
    const separatorLength = totalWidth + 3 * values.length + 1;
    console.log("-".repeat(separatorLength));
  }
}
