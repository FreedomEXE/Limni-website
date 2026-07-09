# Gate 106A - Candidate B Stress Overlay

Generated: `2026-07-09T03:19:26.786Z`

## Verdict

`PASS_GATE106A_CANDIDATE_B_STRESS_OVERLAY_EXPORT_REVIEW_ONLY_NO_EA_CHANGE`

## Scope

- Review/export only.
- Locked Gate 69 Candidate B weekly forced-28 direction rows only.
- No EA code changes, no Revma formula changes, no Candidate B tuning, no optimization.
- Revma HTML report used only for MT5 period and source identity.

## Source Identity

```json
{
  "revma_report": "C:/Users/User/Desktop/LIMNI/Baktests/Revma/0.01 tp. no sl. all 28 pairs. 0.1 grid spacing..html",
  "revma_report_sha256": "60005CCA025B77B68B4093507A1656B712F4D2D06200CF1C126B06C79F3B0378",
  "revma_period": {
    "start": "2020-01-01",
    "end": "2026-07-08"
  },
  "locked_candidate_b": {
    "formula_id": "candidate_b_macro_anchor_with_cot_warning",
    "formula_hash": "8C873CCCF9FA3D3A578EAC7160C8526EC25A0BEA528FE3C0A5304BE9413E6F01",
    "config_hash": "5158742FE3E74221D1F2577A38F3169C6AF9B1FA7BC593B90C901A4F0E562390",
    "frozen_reference_capsule_sha256": "C8DC7E99DE640C2DEA0817C0F48F604575D4FB5CCBC9A9C787261FB4E63073A3",
    "gate68_decision_ledger_hash": "C33A7B81DC8FDD3D1048F1AF7EB2F7A8350B189506E4215E12EF78B705403D9A",
    "gate68_outcome_scoring_hash": "38961DF0C194E9765619F3753F7975795838A9182DE37632403332BD02A4C0D2",
    "source_manifest_hash": "7F79958D98422E14283202BD6396799D99C8820BB077DE7E98B2C5617BA1FF08",
    "point_in_time_ok": true,
    "ledger_min_week_open_utc": "2019-04-14T23:00:00.000Z",
    "ledger_max_week_open_utc": "2026-05-31T23:00:00.000Z"
  },
  "coverage": {
    "requested_start": "2020-01-01",
    "requested_end": "2026-07-08",
    "exported_direction_rows": 9380,
    "stress_window_start": "2024-07-15",
    "stress_window_end": "2024-09-30",
    "stress_rows": 308,
    "source_gap_after_locked_ledger": true,
    "source_gap_note": "Locked Gate 69B ledger ends at 2026-05-31T23:00:00.000Z; no Candidate B rows exported after that date."
  }
}
```

## Stress Metrics

```json
{
  "candidate_b_correct_this_week": "169/308",
  "candidate_b_correct_next_week": "168/308",
  "jpy_pair_rows": 77,
  "jpy_strength_direction_rows": 45,
  "jpy_strength_share": 0.584416,
  "jpy_correct_this_week": "46/77",
  "jpy_correct_next_week": "45/77",
  "warning_or_fallback_rows": 64,
  "warning_or_fallback_share": 0.207792
}
```

## Answers

1. During the 2024 Aug/Sep stress, Candidate B was mixed-positive, not dominant: `169/308` correct this-week and `168/308` correct next-week across stress pair-weeks.
2. Candidate B was only partly on the JPY carry-unwind side: `45/77` JPY-pair rows pointed to JPY strength, with JPY correctness `46/77` this-week and `45/77` next-week.
3. Candidate B would have warned or fallen back on `64` stress rows, but Gate 106A cannot prove no-new-risk usefulness without a machine-readable Revma inventory/load join. The right future test is opposed-inventory-at-deposit-load-spike, not raw direction alone.
4. Candidate B did fail or lag on a substantial minority/near-half of rows. Rows with `candidate_b_correct_next_week=false` or `candidate_b_correct_this_week=false` are the fail/late candidates to inspect before any overlay design.
5. Candidate B remains promising as a future regime-overlay/no-new-risk diagnostic, especially as a stress warning layer, but this evidence is not strong enough to promote it as a live Revma filter or to change Revma.

## Fail-Closed Notes

- Locked Candidate B source ends at `2026-05-31T23:00:00.000Z`; the Revma report period ends at `2026-07-08`. Rows after the locked ledger end are not invented.
- Revma stress fields are blank because: Desktop MT5 HTML report exposes period and deal rows, but not machine-readable weekly deposit-load/equity-dd/open-grid inventory. Gate 106A leaves Revma stress fields blank instead of inferring them from chart pixels.
- Candidate B score and currency contribution fields are blank because the locked Gate 69B ledger preserves direction and hashes, not numeric contribution scores.

## Artifacts

- Candidate B weekly directions: `docs/research/gates/gate106a/artifacts/candidate-b-stress-overlay-2026-07-09/candidate_b_weekly_directions.csv`
- Stress alignment CSV: `docs/research/gates/gate106a/artifacts/candidate-b-stress-overlay-2026-07-09/candidate_b_stress_alignment.csv`
- Summary JSON: `docs/research/gates/gate106a/artifacts/candidate-b-stress-overlay-2026-07-09/gate106a-summary.json`
- SHA identity: `docs/research/gates/gate106a/artifacts/candidate-b-stress-overlay-2026-07-09/gate106a-sha256.txt`
