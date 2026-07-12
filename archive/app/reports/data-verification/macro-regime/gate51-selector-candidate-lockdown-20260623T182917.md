# Gate 51C Selector Candidate Lockdown

Generated: 2026-06-23T18:29:17.253Z

## Result

- Status: PASS_SELECTOR_CANDIDATE_LOCKDOWN_DIAGNOSTIC
- Gate: Gate 51C: selector-candidate-lockdown
- Locked COT research candidate: cot_lifecycle_polarity_v0_noncomm_primary
- Locked Strength research candidate: strength_friday_snapshot_open_canonical_fade_agree
- Retained simple Strength anchor: strength_friday_snapshot_selected
- ADR-normalized reporting: true
- Production claim: false

## COT Candidate Comparison

| Candidate | Rows | ADR | DD | R/DD | Sharpe | PF | Win | Worst year |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree | 2277 | 263.6648 | -292.6540 | 0.9009 | 0.3800 | 1.1829 | 0.7430 | 2024 -125.0722 |
| cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree | 2408 | 392.4486 | -272.7130 | 1.4391 | 0.4245 | 1.2634 | 0.7465 | 2024 -212.8934 |
| cot_faces_v1_commercial_delta_contrarian_selected | 10332 | 1174.8748 | -645.8961 | 1.8190 | 0.5274 | 1.2463 | 0.6938 | 2024 -332.0527 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_agree | 5220 | 566.9998 | -482.7642 | 1.1745 | 0.4079 | 1.1992 | 0.7019 | 2024 -337.9656 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | 4735 | 630.2297 | -394.2778 | 1.5984 | 0.4036 | 1.2406 | 0.7198 | 2024 -209.0927 |
| cot_faces_v1_forced_selected | 10332 | 1068.8796 | -592.2998 | 1.8046 | 0.4888 | 1.2230 | 0.6667 | 2024 -329.4919 |
| dealer_commercial_agreement_selected | 4079 | 603.1412 | -473.1265 | 1.2748 | 0.5499 | 1.2766 | 0.7453 | 2024 -367.9326 |

## COT Lifecycle Evidence

| Candidate | Rows | ADR | DD | R/DD | Sharpe | PF | Win | Worst year |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| cot_faces_v1_commercial_delta_contrarian_selected (fade_lean / all) | 682 | 326.8793 | -82.3226 | 3.9707 | 1.1870 | 2.1125 | 0.8325 | - - |
| cot_faces_v1_commercial_delta_contrarian_selected (with_extreme / all) | 352 | -215.4062 | -316.9006 | -0.6797 | -0.3322 | 0.5579 | 0.7941 | - - |
| cot_faces_v1_commercial_delta_contrarian_selected (with_extreme / confirm) | 120 | -154.8269 | -173.7753 | -0.8910 | -0.3920 | 0.3849 | 0.7692 | - - |
| cot_faces_v1_commercial_delta_contrarian_selected (with_lean / confirm) | 436 | -134.1911 | -264.0466 | -0.5082 | -0.3884 | 0.7133 | 0.7763 | - - |
| cot_faces_v1_commercial_delta_contrarian_selected (with_lean / weak) | 760 | 416.6092 | -54.3895 | 7.6597 | 1.6165 | 2.5497 | 0.8155 | - - |
| cot_faces_v1_commercial_delta_contrarian_selected (fade_lean / confirm) | 258 | 182.8593 | -20.5761 | 8.8870 | 1.5541 | 2.7843 | 0.8611 | - - |
| cot_faces_v1_commercial_delta_contrarian_selected (with_extreme / confirm) | 78 | -95.7247 | -109.2559 | -0.8762 | -0.4447 | 0.3479 | 0.7895 | - - |
| cot_faces_v1_commercial_delta_contrarian_selected (with_lean / confirm) | 521 | -220.4725 | -347.5237 | -0.6344 | -0.4352 | 0.6627 | 0.7563 | - - |

## Strength Candidate Comparison

| Candidate | Rows | ADR | DD | R/DD | Sharpe | PF | Win | Worst year |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| strength_friday_snapshot_open_canonical_fade_agree | 4618 | 698.4142 | -208.9842 | 3.3419 | 0.6699 | 1.2978 | 0.7096 | 2020 -20.5112 |
| strength_friday_snapshot_selected | 10292 | 1223.2938 | -519.9618 | 2.3527 | 0.6097 | 1.2683 | 0.6739 | 2024 -211.6726 |
| strength_open_canonical_fade | 9261 | 1005.1828 | -481.9050 | 2.0859 | 0.5668 | 1.2339 | 0.6712 | 2023 -188.7122 |
| strength_friday_snapshot_open_canonical_fade_friday_remainder | 5674 | 524.8796 | -409.0012 | 1.2833 | 0.3504 | 1.1673 | 0.6981 | 2024 -202.3019 |
| strength_friday_snapshot_open_canonical_same_direction_agree_derived (Derived only from cached Gate 44 Friday/open selected pair decisions; no ADR execution rerun.) | 4602 | 439.3536 | -377.9074 | 1.1626 | 0.3382 | 1.1658 | 0.6932 | 2024 -202.3021 |
| strength_open_canonical_selected | 9261 | 765.2320 | -815.2067 | 0.9387 | 0.3346 | 1.1626 | 0.6739 | 2020 -326.1242 |
| strength_friday_snapshot_fade | 10292 | 605.8641 | -662.1854 | 0.9149 | 0.2666 | 1.1193 | 0.6739 | 2020 -292.3030 |
| strength_friday_snapshot_open_canonical_fade_open_fade_remainder | 4643 | 306.7686 | -469.3320 | 0.6536 | 0.2375 | 1.1085 | 0.7104 | 2023 -281.7388 |

## Decision

- COT: Use COT lifecycle polarity as the single COT research candidate for continued RRP pairing. Use cot_faces_v1_commercial_delta_contrarian_selected only as the frozen Gate 44 directional harness until a pure lifecycle runner is built.
- Strength: Use Friday frozen strength plus open canonical strength fade-agreement as the single Strength research candidate because it has the best full-window R/DD and lowest drawdown among tested/derived Strength candidates. Keep Friday snapshot selected as the broad benchmark; reject open selected for now.
- Simple Strength anchor: Retain Friday frozen strength selected as the simple Strength anchor and broad benchmark because its logic is easier to defend than Sunday/Monday open-fade behavior, even though SFA has better risk quality in Gate 51C.
- Frozen exclusions: Do not expand COT Faces, Dealer+Commercial, Strength open-only, or new Strength composites during Gate 51 unless this selector-lockdown gate is explicitly reopened. Friday-only may remain a benchmark/simple anchor, not a second optimization branch.

No live, ACTIVE, production-ready, portfolio-ready, source-promotion, or Gate 52 claim is made by this receipt.
