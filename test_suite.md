Here is the updated test suite strategy in Markdown format for your project documentation.

# 🧪 Portfolio Rebalance Test Suite Strategy

## 1. Required Test Case Types

To ensure the `SimpleRebalancer` satisfies all constraints of the specification, the following seven test scenarios are required:

| Case ID   | Type                           | Purpose                                                                                         | Requirement  |
| --------- | ------------------------------ | ----------------------------------------------------------------------------------------------- | ------------ |
| **TC-01** | **Ideal Integer Case**         | Verify core logic when prices and targets result in perfect whole numbers.                      | R1, R2       |
| **TC-02** | **Overspending (Reduction)**   | Verify C\_{req} is protected when initial math exceeds available cash.                          | R4           |
| **TC-03** | **Underspending (Top-up)**     | Verify leftover cash is used to buy extra shares for underweight assets.                        | R5           |
| **TC-04** | **Global Optimization (Swap)** | Verify the "Refinement Loop" swaps expensive shares for cheaper ones to minimize total % drift. | Optimization |
| **TC-05** | **Capital Integration**        | Verify C*{old}, C*{new}, and C*{sales} are aggregated correctly into C*{liquid}.                | R3           |
| **TC-06** | **Zero/Negative Change**       | Verify handling of already-balanced portfolios or assets requiring full liquidation.            | R1           |
| **TC-07** | **Liquidity Constraint**       | Verify behavior when an asset price exceeds the total available purchase budget.                | R4, R5       |

---

##2. Test Case Definitions & Expected Results

### TC-01: Ideal Whole-Number Case

- **Setup:** C*{old} = 0, C*{new} = \$100, C\_{req} = 0. Asset A Price = $10, Target = 100%.
- **Expected Result:** `BUY 10` shares of A. C\_{rem} = 0.
- **Verification:** Basic V\_{total} and target allocation pipeline.

### TC-02: Overspending (Reduction Logic)

- **Setup:** C*{liquid} = \$10, C*{req} = \$5. Asset A Price = $7, Target = 100%.
- **Logic Check:** `Floor(1.42)` buy is 1 share. Cost ($7) leaves only $3.
- **Expected Result:** `BUY 0` shares. C\_{rem} = \$10.
- **Verification:** The required cash buffer must never be breached.

### TC-03: Underspending (Top-up Logic)

- **Setup:** Budget = $100. Assets A & B = $30 each. Targets 50/50.
- **Logic Check:** Initial floor math buys 1 of each (Cost $60). Remainder $40 is enough for one more share.
- **Expected Result:** `BUY 2` of A, `BUY 1` of B (or vice versa).
- **Verification:** Maximizes capital utilization per R5.

### TC-04: Global Optimization (The Balanced Swap)

- **Setup:** Asset A ($9), B ($50), C ($18). Target 25/50/25. C*{old} $100, C*{new} $400, C\_{req} $50.
- **Logic Check:** Greedy math might result in `A:+42, C:+23`.
- **Expected Result:** `A:+44, B:-7, C:+22`.
- **Verification:** Refinement loop swaps 1 share of C for 2 shares of A to minimize total % drift from 1.24% to 1.11%.

### TC-05: Liquidity & Existing Cash Integration

- **Setup:** C*{old} = \$50, C*{new} = \$50, C\_{req} = 0. Asset A Price = $10, Target 100%.
- **Expected Result:** `BUY 10` shares.
- **Verification:** Proves that C\_{old} is treated as spendable capital.

### TC-06: Zero Change (Already Balanced)

- **Setup:** 10 shares of A @ $10. C*{old}/C*{new}/C\_{req} = 0. Target 100%.
- **Expected Result:** `shareChange: 0` for all assets.
- **Verification:** Prevents churn when targets are already met.

### TC-07: Minimum Capital (Expensive Asset)

- **Setup:** Total C\_{liquid} = \$50. Asset A Price = $100. Target 100%.
- **Expected Result:** `BUY 0` shares. C\_{rem} = \$50.
- **Verification:** Ensures no partial or illegal trades occur when the "entry price" is too high.
