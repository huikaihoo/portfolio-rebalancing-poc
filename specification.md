# 🎯 Portfolio Rebalancing Specification

## 1. Requirements Summary

The system must calculate the optimal integer number of shares to buy or sell for each asset to bring the portfolio allocation closest to a defined target percentage, accounting for existing cash, new capital injections, and a required cash reserve.

| Requirement ID | Description                 | Constraint                                                                                     |
| :------------- | :-------------------------- | :--------------------------------------------------------------------------------------------- |
| **R1**         | Achieve Target Allocation   | Minimize deviation from $T_i$ after rebalance.                                                 |
| **R2**         | Use Integer Shares          | All $\Delta S_i$ must be integers.                                                             |
| **R3**         | Capital Integration         | Account for existing cash ($C_{old}$), new cash ($C_{new}$), and sales proceeds.               |
| **R4**         | Cash Buffer Maintenance     | Final Remainder Cash ($C_{rem}$) **must be $\ge C_{req}$**.                                    |
| **R5**         | Cash Remainder Optimization | $C_{rem}$ must be minimized while satisfying $C_{rem} \ge C_{req}$ (i.e., maximize purchases). |

---

## 2. Input Parameters (Machine Readable)

These are the required inputs for the rebalancing function.

| Parameter Name         | Variable  | Type    | Description                                    | Constraint                        |
| :--------------------- | :-------- | :------ | :--------------------------------------------- | :-------------------------------- |
| `asset_price`          | $P_i$     | Float   | Current market price per share of asset $i$.   | $P_i > 0$                         |
| `current_shares`       | $S_i$     | Integer | Number of shares currently held of asset $i$.  | $S_i \ge 0$                       |
| `target_allocation`    | $T_i$     | Float   | Desired percentage allocation for asset $i$.   | $0 \le T_i \le 1$, $\sum T_i = 1$ |
| `existing_cash`        | $C_{old}$ | Float   | Cash currently held in the account.            | $C_{old} \ge 0$                   |
| `new_capital`          | $C_{new}$ | Float   | New cash to be injected into the portfolio.    | $C_{new} \ge 0$                   |
| `required_cash_buffer` | $C_{req}$ | Float   | Minimum cash buffer required for transactions. | $C_{req} \ge 0$                   |

---

## 3. Output Parameters (Machine Readable)

These are the required outputs of the rebalancing function.

| Parameter Name   | Variable     | Type    | Description                                  | Constraint                  |
| :--------------- | :----------- | :------ | :------------------------------------------- | :-------------------------- |
| `share_change`   | $\Delta S_i$ | Integer | Shares to buy (positive) or sell (negative). | $\Delta S_i \in \mathbb{Z}$ |
| `remainder_cash` | $C_{rem}$    | Float   | Cash left over after all transactions.       | $C_{rem} \ge C_{req}$ (R4)  |

---

## 4. Process Flow and Formula (High-Level)

The process involves five main steps:

1.  **Calculate Targets:** Determine the ideal target value for each asset based on the **Total Portfolio Value** (Assets + $C_{old}$ + $C_{new}$).
2.  **Calculate Ideal Change:** Determine the ideal, fractional change in shares ($\Delta S_{i}^{ideal}$) needed to reach targets.
3.  **Conservative Sales:** Determine shares to sell ($\Delta S_i^{sell}$) using a conservative `Ceiling` function to maximize cash generation.
4.  **Determine Purchase Budget:** Calculate the maximum allowable spend on purchases based on total liquid cash minus $C_{req}$.
5.  **Optimized Buys:** Determine the final shares to buy ($\Delta S_i^{buy}$) by either reducing or topping-up purchases to maximize spending while respecting the budget.

---

## 5. Detailed Process Logic

### Step 1 & 2: Calculate Ideal Change

1.  Current Asset Value: $V_{assets} = \sum (P_i \times S_i)$
2.  Total Portfolio Value: $V_{total} = V_{assets} + C_{old} + C_{new}$
3.  Target Value: $V_{target, i} = T_i \times V_{total}$
4.  Ideal Share Change: $$\Delta S_{i}^{ideal} = \frac{V_{target, i} - (P_i \times S_i)}{P_i}$$

### Step 3: Conservative Shares to Sell

1.  Identify assets where $\Delta S_{i}^{ideal} < 0$.
2.  Shares to Sell: $\Delta S_i^{sell} = \text{Ceiling}(|\Delta S_{i}^{ideal}|)$
3.  Cash from Sales: $C_{sales} = \sum (\Delta S_i^{sell} \times P_i)$

### Step 4: Determine Purchase Budget

1.  Total Liquid Cash Available: $C_{liquid} = C_{old} + C_{new} + C_{sales}$
2.  Maximum Purchase Budget: $$C_{purchase, max} = C_{liquid} - C_{req}$$

### Step 5: Optimized Shares to Buy (Core Optimization)

1.  **Initial Conservative Buy:** Calculate initial shares using the `Floor` function:
    $$\Delta S_{i}^{initial} = \text{Floor}(\Delta S_{i}^{ideal}) \text{ (for all } \Delta S_{i}^{ideal} > 0)$$
2.  **Initial Cost:** $C_{initial} = \sum (\Delta S_{i}^{initial} \times P_i)$

3.  **Feasibility Check & Adjustment:**

    - **Case A: Overspending ($C_{initial} > C_{purchase, max}$):** The system must iteratively **reduce** the number of shares to buy until $C_{purchase} \le C_{purchase, max}$.
    - **Case B: Underspending ($C_{initial} \le C_{purchase, max}$):** The system must iteratively **top-up** purchases (add one share at a time) to utilize the remaining budget ($C_{buffer} = C_{purchase, max} - C_{initial}$). Prioritize assets based on the largest $\Delta S_{i}^{ideal}$ fractional part.

4.  **Final Buy Shares:** $\Delta S_i^{buy}$ results from the adjustment/top-up process.

### Step 6: Final Outputs

1.  Final Cost of Purchases: $C_{purchase} = \sum (\Delta S_i^{buy} \times P_i)$
2.  Final Remainder Cash: $C_{rem} = C_{liquid} - C_{purchase}$
3.  Final Share Change: $\Delta S_i = \Delta S_i^{buy} - \Delta S_i^{sell}$

---

## 6. Example

This example incorporates existing cash ($C_{old}$) and demonstrates the logic when the initial conservative purchase exceeds the budget.

#### Input

| Parameter     | Asset A | Asset B | Asset C | Portfolio    |
| :------------ | :------ | :------ | :------ | :----------- |
| $P_i$         | \$9.00  | \$50.00 | \$18.00 |              |
| $S_i$         | 100     | 60      | 50      |              |
| $T_i$         | 25%     | 50%     | 25%     |              |
| **$C_{old}$** |         |         |         | **\$100.00** |
| **$C_{new}$** |         |         |         | **\$400.00** |
| **$C_{req}$** |         |         |         | **\$50.00**  |

#### Intermediate Calculations

- **Total Assets ($V_{assets}$):** $(9 \times 100) + (50 \times 60) + (18 \times 50) = \$4800.00$.
- **Total Value ($V_{total}$):** $\$4800 + \$100 + \$400 = \$5300.00$.
- **Ideal Share Change:** $\Delta S_A^{ideal}=47.22$, $\Delta S_B^{ideal}=-7.00$, $\Delta S_C^{ideal}=23.61$.
- **Cash from Sales:** $7 \text{ shares (B)} \times \$50.00 = \$350.00$.
- **Total Liquid Cash ($C_{liquid}$):** $\$100 + \$400 + \$350 = \$850.00$.
- **Max Budget ($C_{purchase, max}$):** $\$850.00 - \$50.00 = **\$800.00**$.

#### Optimized Shares to Buy (Steps 5 & 6)

1.  **Initial Floor Buy:** $\Delta S_A^{initial}=47$, $\Delta S_C^{initial}=23$.
2.  **Initial Cost:** $(47 \times \$9.00) + (23 \times \$18.00) = \$423 + \$414 = **\$837.00**$.
3.  **Feasibility Check:** $C_{initial} (\$837.00) > C_{purchase, max} (\$800.00)$. Need to reduce spending by **\$37.00**.
4.  **Budget Reduction Logic (Case A):**
    - Reduce A by 4 shares ($4 \times \$9.00 = \$36.00$ reduction).
    - New Cost = \$801.00 (Still over by \$1).
    - Reduce A by 1 more share ($1 \times \$9.00 = \$9.00$ reduction).
    - Final $C\_{purchase} = \$837.00 - \$45.00 = **\$792.00**$.

#### Final Outputs

| Parameter    | Value       | Calculation / Constraint Check                            |
| :----------- | :---------- | :-------------------------------------------------------- |
| $\Delta S_A$ | **+42**     | $42 - 0$                                                  |
| $\Delta S_B$ | **-7**      | $0 - 7$                                                   |
| $\Delta S_C$ | **+23**     | $23 - 0$                                                  |
| $C_{rem}$    | **\$58.00** | $\$850 - \$792$. $C_{rem} \ge C_{req}$ (\$50.00) **Met**. |
