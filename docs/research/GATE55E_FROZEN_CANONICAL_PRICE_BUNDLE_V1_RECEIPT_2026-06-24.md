# Gate 55E Frozen Canonical Price Bundle v1 Receipt

Date: 2026-06-24

## Verdict

Status: `PASS_CANONICAL_FX_M1_100_PERCENT`

Gate 55E locks the first institutional canonical FX M1 price bundle for Gate 55
research.

Frozen bundle label:

`gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`

This is a coverage-and-lineage bundle identity, not a full tick-by-tick price
value digest. The final receipt hash is used as the deterministic lock for this
gate, and the database identity counts are recorded below.

## Scope

Gate 55E repairs and proves the shared canonical price layer required before
Friday Strength selected-vs-fade testing can be treated as institutional
evidence.

This gate does not choose a Strength baseline, combine COT with Strength, add
regime filters, retest BPR/RRP, optimize execution, add risk overlays, or make
live/MT5 claims.

## Frozen Rule

For FX M1 institutional research:

1. `canonical_price_bars` is the shared source of price truth.
2. Local SQLite M1 is staging/import repair only.
3. The canonical FX trading week uses the New York 5pm FX session window.
4. A minute is tradable when at least one canonical OANDA FX pair has a real
   `provider_minute` row inside the approved session window.
5. Every one of the 28 FX pairs must have a canonical row for every active
   provider minute.
6. Real provider rows keep `quality_status=provider_minute`.
7. No-tick pair rows are explicit rows with
   `quality_status=derived_no_tick_forward_fill_v1`, OHLC equal to the prior
   same-symbol close, and no future-bar access.
8. A price-derived institutional result without this bundle id, or a later
   frozen successor id, is diagnostic-only.

## Final Audit

Final no-write full-bundle command:

```powershell
npx tsx app/scripts/verification/audit-gate55e-canonical-fx-m1-bundle.ts --from-week=2018-12-17T00:00:00.000Z --to-week=2026-06-08T00:00:00.000Z
```

Final receipt:

- JSON:
  `app/reports/data-verification/gate55/gate55e-canonical-fx-m1-bundle-20260624T232148Z.json`
- Markdown:
  `app/reports/data-verification/gate55/gate55e-canonical-fx-m1-bundle-20260624T232148Z.md`
- Coverage rule input hash:
  `B93264594586659F16BF7A35B12F09B95048EBBFB2449D78A5F2522FA1571B98`
- Final JSON SHA-256:
  `8E37E953D0748406EE04A0FFF64ACEA778B672ACCF681DEB4B9C7C0BCB0F128F`
- Final MD SHA-256:
  `D4E272BA9A76ED17CE0F56B2AD7982EE627F3A01AB2B5CEB0C4F0B6F28D2C7F3`

Final coverage:

| Metric | Value |
|---|---:|
| Weeks | 391 |
| FX symbols | 28 |
| Parent pair-weeks | 10,948 |
| Complete pair-weeks | 10,948 |
| Partial pair-weeks | 0 |
| Missing pair-weeks | 0 |
| Source-gap pair-weeks | 0 |
| Full weeks | 391 |
| Partial weeks | 0 |
| Source-gap weeks | 0 |
| Active pair-minute expected rows | 78,149,792 |
| Active pair-minute actual rows | 78,149,792 |
| Missing active pair-minute rows | 0 |
| Lowest coverage | 100.000000% |

## Database Identity

Final canonical envelope queried:

`2018-12-16T22:00:00.000Z <= bar_open_utc < 2026-06-12T21:00:00.000Z`

Final 28-FX-symbol row identity:

| Source provider | Quality status | Rows | Min bar | Max bar |
|---|---|---:|---|---|
| `oanda` | `provider_minute` | 76,377,414 | `2018-12-16T22:00:00.000Z` | `2026-06-12T20:59:00.000Z` |
| `oanda` | `derived_no_tick_forward_fill_v1` | 1,772,448 | `2018-12-16T22:01:00.000Z` | `2026-06-12T20:59:00.000Z` |

The audit denominator is active provider minutes inside canonical week windows.
The database envelope can include off-window rows; the pass/fail claim is the
final active-minute receipt above.

## Source Promotions

Provider rows were promoted from local OANDA SQLite staging into
`canonical_price_bars` where canonical Postgres was missing provider rows.

| Window | Local rows | Inserted rows | Input hash |
|---|---:|---:|---|
| `2019-01-11T22:00Z -> 2019-02-01T22:00Z` | 589,177 | 436,847 | `B88CBFB1369E7F10C36F151EDC7874ACB409F1F6645F026B6CAE3A20CF4556A8` |
| `2019-02-01T22:00Z -> 2020-01-01T00:00Z` | 8,996,855 | 8,995,479 | `0836CB2CF725AA36F5AB0DAACDB210F14D50F329BE0D731712379E34753F54D3` |
| `2020-01-01T00:00Z -> 2021-01-01T00:00Z` | 10,145,417 | 10,145,417 | `632FD67F79CDBBE145636F3C703112F03BD75428BC1DFD201B1CDD9D370661FB` |
| `2021-01-01T00:00Z -> 2022-01-01T00:00Z` | 10,053,751 | 10,053,751 | `0C24B36F1ACC5C7FF8F3FDDBEFF9E42374739B9A35FACA6A8307F821ED0B268E` |
| `2022-01-01T00:00Z -> 2023-01-02T00:00Z` | 10,305,755 | 10,305,053 | `E63CA324E40E982FF07EE1F58C74B6B86665CC5A4194E570339AB5233796A666` |
| `2025-10-05T21:00Z -> 2025-12-26T22:00Z` | 2,353,899 | 2,353,899 | `4682E99630277FB535BFF7EDA68E0F49891433E1051437ADEE3CEDB3198AA159` |
| `2022-12-25T22:00Z -> 2023-01-02T22:00Z` | 189,647 | 0 | `B9AE6DC1591FB01747B12479710F661F824E47064DEEAF2DAE289B52D47EF91C` |
| `2023-12-24T22:00Z -> 2024-01-08T22:00Z` | 357,054 | 0 | `BE8A64D585E56D7C45A845D1FEDB38BF8E5CB6A84507D2A6345A9C142FC5407F` |

The final two source-promotion audits inserted `0` provider rows, proving the
remaining year-end gaps were no-tick gaps already present in local OANDA
staging, not unpromoted provider rows.

## No-Tick Repair Receipts

No-tick repairs are explicit canonical rows under
`derived_no_tick_forward_fill_v1`.

| Receipt | Status | Weeks | Before missing | After missing | Pair rows filled | Rows inserted | Blocked after |
|---|---|---:|---:|---:|---:|---:|---:|
| `20260624T212148Z` | PASS | 1 | 23 | 0 | 23 | 23 | 0 |
| `20260624T213648Z` | PASS | 3 | 15,287 | 0 | 84 | 15,287 | 0 |
| `20260624T224340Z` | BLOCKED | 391 | 1,723,755 | 8,386 | 10,331 | 1,715,369 | 8,386 |
| `20260624T225448Z` | PASS | 12 | 18,373 | 0 | 333 | 18,373 | 0 |
| `20260624T231027Z` | PASS | 1 | 4,869 | 0 | 27 | 4,869 | 0 |
| `20260624T231132Z` | PASS | 2 | 3,517 | 0 | 42 | 3,517 | 0 |
| `20260624T232148Z` | PASS | 391 | 0 | n/a | 0 | 0 | 0 |

Intermediate blocked receipts are retained because they prove the guard caught
unresolved source gaps before the final targeted repairs.

## Bad Fill Cleanup

An early full write-fill attempt began filling source-gap weeks before the guard
was tightened. That run was stopped. The invalid derived rows from
`2019-01-13T22:00Z` through `2019-01-25T22:00Z` were deleted:

`170,309` rows removed.

The valid `2019-01-07` no-tick repair rows were preserved.

## Guard Rule

The final no-tick guard allows repair only when:

- expected provider-active minutes are greater than zero
- the pair has real observed rows in the window
- pair coverage is at least `90%`
- the final active-session edge is within `60` minutes
- holiday/reopen lag is bounded within `360` minutes
- every fill uses prior same-symbol close only

This blocks whole-source-gap filling while allowing dense bars for high-coverage
quote-stale minutes during holiday reopen windows.

## Code Changes

- `app/src/lib/canonicalPriceWindows.ts`
  - FX weekly/daily windows now use New York 5pm session windows.
- `app/src/lib/canonicalHourlyBars.ts`
  - M1 completeness defaults to 100% for canonical coverage.
- `app/scripts/verification/promote-local-m1-to-canonical.ts`
  - Promotes local SQLite OANDA M1 staging rows into canonical Postgres.
- `app/scripts/verification/audit-gate55e-canonical-fx-m1-bundle.ts`
  - Audits and optionally fills canonical FX M1 bundle coverage.

## Verification

```text
npx tsc --noEmit --project app/tsconfig.json --pretty false
PASS

npx tsx app/scripts/verification/audit-gate55e-canonical-fx-m1-bundle.ts --from-week=2018-12-17T00:00:00.000Z --to-week=2026-06-08T00:00:00.000Z
PASS_CANONICAL_FX_M1_100_PERCENT
```

## Governance Statements

- No lookahead.
- No future bars used for no-tick repair.
- No outcome data used.
- No COT+Strength combination.
- No regime filters.
- No BPR/RRP, PPP/NEER/REER, execution optimization, risk overlay, MT5/live/bot,
  production, or final system selection.

## Gate 55 Status

Gate 55E is closed as a price-layer source-integrity pass.

Next allowed Gate 55 work:

1. Rebuild/regenerate Friday Strength source context from this canonical M1
   bundle.
2. Prove weekly `28/28` Strength decisions under the frozen source rule.
3. Then run selected-vs-fade Strength baselines under ADR Grid and simple weekly
   hold.
4. Only after that, decide whether Strength is selected, fade, rebuilt-alive, or
   parked.

Still not allowed:

- COT+Strength combination.
- Final combined Signal Model selection.
- Regime filters.
- Execution/risk/live work.
