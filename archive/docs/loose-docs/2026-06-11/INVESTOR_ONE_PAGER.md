# Limni Universal Strategy
## Investor Risk Profile (One-Page Brief)

### Summary
Limni runs a single core engine ("Universal") with configurable risk tiers.

- Internal benchmark mode: `God Mode` (high-risk reference only)
- Investor capital mode: scaled-risk deployment of the same engine
- Goal: preserve edge while materially reducing drawdown

This document is for discussion and due diligence support. All performance figures below are illustrative model translations, not guarantees.

---

### How Risk Is Managed
We do not run separate "investor" and "internal" systems. We run one baseline engine and scale exposure down by policy.

- `Scale factor S` = risk reduced by `S` vs internal benchmark
- Example: `S=50` means investor exposure is approximately `1/50` of benchmark mode

First-order model:
- Weekly return scales approximately with size
- Drawdown scales approximately with size

Realized outcomes can differ due to execution, slippage, spread widening, gaps, and path effects.

---

### Risk Tiers (Illustrative)
Assuming internal benchmark reference of `100% weekly return` and `20% max drawdown`:

| Tier | Scale vs Benchmark | Expected Weekly Return | Expected Max Drawdown | Annual Return (Simple) |
|---|---:|---:|---:|---:|
| Investor Growth | 50x lower (`0.02x`) | ~2.0% | ~0.4% | ~104% |
| Investor Defensive | 100x lower (`0.01x`) | ~1.0% | ~0.2% | ~52% |

Important:
- These are modeled scaling examples only.
- They are presented to show risk architecture, not to promise fixed outcomes.

---

### Capital and Lot-Size Constraint
Risk cannot be reduced indefinitely on small accounts because some instruments have minimum lot sizes (example: XAUUSD `0.01` lot).

Implication:
- At small account sizes, the system may hit a risk floor.
- Further risk reduction then requires larger capital.

Illustrative capital mapping:
- Around `$100,000` may be near floor for some low-risk configurations.
- Around `$500,000` supports additional risk compression.
- Around `$1,000,000` supports the lowest practical risk tier in current design assumptions.

---

### Hard Risk Controls
Portfolio-level controls are enforced regardless of signal quality:

1. Trailing drawdown > `8%`: reduce risk tier
2. Trailing drawdown > `12%`: defensive mode
3. Trailing drawdown > `15%`: kill switch and review

Additional controls:
- Symbol-level sizing checks
- Minimum-lot feasibility checks
- Mode restrictions when target risk cannot be achieved precisely

---

### Governance and Reporting
For investor reporting, we standardize around:

- Weekly return
- Monthly return
- Max drawdown
- Return/drawdown ratio
- Win rate and dispersion
- Exposure and concentration metrics

We report both:
- Simple annualized view
- Compounded annualized view

---

### Why This Framework
- Keeps one proven baseline engine
- Makes risk explicit and auditable
- Scales investor safety with capital growth
- Separates internal high-risk benchmarking from investor deployment

---

### Disclosure
This material is informational and for discussion purposes only. It is not an offer to sell or a solicitation of an offer to invest. All projected or modeled figures are hypothetical and subject to market, liquidity, and execution risk.

