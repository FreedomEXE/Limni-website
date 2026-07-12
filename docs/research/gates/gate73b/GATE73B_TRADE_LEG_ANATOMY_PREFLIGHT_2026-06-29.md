# Gate 73B Trade-Leg Anatomy and Runner-Preserving Exit Design Preflight

Generated: `2026-06-29T01:26:31.939Z`

## Verdict

`PASS_GATE73B_TRADE_LEG_COMPOSITION_PREFLIGHT__FINAL_COMPOSITION_VISIBLE_PATH_TIMING_GAP_BOUND`

## Scope

- Uses existing materialized warehouses only: Gate 57 pair-week outcomes, Gate 71B-M basket path warehouse, Gate 71B basket diagnostics, Gate 72 matrix rows, and Gate 73A path classes.
- Measures Candidate B final week x pair contribution composition for top winners and green-then-giveback weeks.
- Converts Gate 72 shortlist damage into final trade-leg composition clues.
- Does not score new exits, optimize thresholds, mutate Candidate B, open risk, or promote an exit.

## Key Finding

Top-20 winners average 21.4 positive trades and 0.537663 of week ADR from the top 5 final trade legs. Existing warehouses can support final-composition diagnostics, but not live trade-leg path timing; dynamic trade exits need a dedicated trade-leg path warehouse or must stay hypothesis-led and narrow.

## Top-Winner Decomposition

```json
{
  "top_weeks": 20,
  "average_positive_trades": 21.4,
  "average_top1_share_of_week_adr": 0.133582,
  "average_top3_share_of_week_adr": 0.350605,
  "average_top5_share_of_week_adr": 0.537663,
  "average_bottom5_trade_drag_adr": -8.085449
}
```

## Green-Giveback End-State

```json
{
  "green_then_giveback_weeks": 222,
  "source_counts": {
    "mixed_end_state": {
      "weeks": 163,
      "rate": 0.734234,
      "average_positive_trades_at_friday": 13.515337,
      "average_negative_trades_at_friday": 14.484663,
      "average_negative_trade_drag_adr": -14.857461
    },
    "broad_laggard_drag": {
      "weeks": 55,
      "rate": 0.247748,
      "average_positive_trades_at_friday": 8.472727,
      "average_negative_trades_at_friday": 19.527273,
      "average_negative_trade_drag_adr": -21.554975
    },
    "few_surviving_leaders": {
      "weeks": 4,
      "rate": 0.018018,
      "average_positive_trades_at_friday": 4.25,
      "average_negative_trades_at_friday": 23.75,
      "average_negative_trade_drag_adr": -18.840052
    }
  },
  "average_positive_trades_at_friday": 12.099099,
  "average_negative_trades_at_friday": 15.900901,
  "average_negative_trade_drag_adr": -16.588513
}
```

## Path Timing Gap

```json
{
  "verdict": "TRADE_LEG_PATH_TIMING_NOT_DURABLY_AVAILABLE_FROM_EXISTING_WAREHOUSE",
  "available_now": [
    "week x pair final weekly-hold ADR from pair-week path outcome warehouse",
    "basket-level MFE/MAE/timestamp anatomy from Gate 71B/Gate 73A",
    "Gate 72 shortlist weekly exit timestamps and final exit ADR"
  ],
  "not_available_without_new_materialization": [
    "trade-level MFE and MAE timestamps",
    "trade contribution at basket MFE",
    "live checkpoint runner identification by pair",
    "trade-level recovery after adverse threshold",
    "trade-level source split of green-then-giveback weeks"
  ],
  "governance_requirement_before_dynamic_trade_exit_matrix": "Create a versioned trade-leg path warehouse, or restrict Gate 73C to hypotheses answerable by current warehouses. Do not run repeated raw M1 scans for dynamic exit testing.",
  "raw_path_smoke": {
    "attempted_this_turn": true,
    "result": "A two-week direct SQL trade-leg path smoke timed out at the tool limit; this confirms the need for durable materialization before path-timing diagnostics."
  },
  "existing_pair_week_outcome_warehouse_id": "gate57a0b_pair_week_path_outcomes_47B8F40AFB3B",
  "existing_basket_path_warehouse_manifest_id": "gate71bm_basket_path_1A8231225169"
}
```

## Validation

```json
{
  "candidate_b_forced28_preserved": true,
  "candidate_b_ledger_hash_matches_gate71bm": true,
  "gate71bm_passed": true,
  "basket_path_warehouse_manifest_id": "gate71bm_basket_path_1A8231225169",
  "basket_path_warehouse_hash": "CD8A18C163A7B19515F8EFB948481535704704D75C3C70F620B76DA6384EB8F0",
  "pair_week_outcome_warehouse_id": "gate57a0b_pair_week_path_outcomes_47B8F40AFB3B",
  "pair_week_final_composition_used": true,
  "raw_m1_source_rebuild_performed": false,
  "direct_trade_leg_path_timing_materialized": false,
  "new_exit_rules_scored": false,
  "exit_promotion_performed": false,
  "risk_layer_started": false,
  "brain_truth_mutated": false,
  "weeks_reviewed": 373,
  "expected_weeks": 373,
  "trade_leg_rows": 10444,
  "expected_trade_leg_rows": 10444,
  "candidate_b_rows_total": 10444,
  "expected_candidate_b_rows_total": 10444,
  "missing_price_trade_rows": 0,
  "default_adr_trade_rows": 270,
  "reconstruction_tolerance_adr": 0.3,
  "max_weekly_reconstruction_abs_delta_adr": 0.266927,
  "average_weekly_reconstruction_abs_delta_adr": 0.001564,
  "largest_weekly_reconstruction_deltas": [
    {
      "week_open_utc": "2023-12-25T00:00:00.000Z",
      "reconstructed_pair_week_final_adr": 15.297178,
      "basket_path_friday_close_adr": 15.030251,
      "abs_delta_adr": 0.266927
    },
    {
      "week_open_utc": "2022-12-26T00:00:00.000Z",
      "reconstructed_pair_week_final_adr": -0.300216,
      "basket_path_friday_close_adr": -0.487803,
      "abs_delta_adr": 0.187587
    },
    {
      "week_open_utc": "2023-01-02T00:00:00.000Z",
      "reconstructed_pair_week_final_adr": -5.534753,
      "basket_path_friday_close_adr": -5.566183,
      "abs_delta_adr": 0.03143
    },
    {
      "week_open_utc": "2024-01-01T00:00:00.000Z",
      "reconstructed_pair_week_final_adr": -18.945346,
      "basket_path_friday_close_adr": -18.960749,
      "abs_delta_adr": 0.015403
    },
    {
      "week_open_utc": "2019-10-27T23:00:00.000Z",
      "reconstructed_pair_week_final_adr": 26.497876,
      "basket_path_friday_close_adr": 26.509054,
      "abs_delta_adr": 0.011178
    },
    {
      "week_open_utc": "2019-12-02T00:00:00.000Z",
      "reconstructed_pair_week_final_adr": 13.007793,
      "basket_path_friday_close_adr": 12.998863,
      "abs_delta_adr": 0.00893
    },
    {
      "week_open_utc": "2019-04-28T23:00:00.000Z",
      "reconstructed_pair_week_final_adr": 11.136555,
      "basket_path_friday_close_adr": 11.145352,
      "abs_delta_adr": 0.008797
    },
    {
      "week_open_utc": "2022-01-03T00:00:00.000Z",
      "reconstructed_pair_week_final_adr": 15.646941,
      "basket_path_friday_close_adr": 15.654735,
      "abs_delta_adr": 0.007794
    },
    {
      "week_open_utc": "2019-09-22T23:00:00.000Z",
      "reconstructed_pair_week_final_adr": -12.408114,
      "basket_path_friday_close_adr": -12.401464,
      "abs_delta_adr": 0.00665
    },
    {
      "week_open_utc": "2020-11-30T00:00:00.000Z",
      "reconstructed_pair_week_final_adr": -1.320113,
      "basket_path_friday_close_adr": -1.313664,
      "abs_delta_adr": 0.006449
    }
  ],
  "shortlist_rule_count": 4,
  "runtime_seconds": 16.084
}
```

## Recommendation

```json
{
  "next_gate_recommendation": "Gate 73C: choose between trade-leg path warehouse materialization or small warehouse-answerable lifecycle matrix",
  "preferred_next_step": "Build a durable trade-leg path warehouse if Freedom wants checkpoint/timing diagnostics; otherwise keep Gate 73C limited to final-composition-informed, basket-aware hypotheses.",
  "supported_exit_design_shape": [
    "basket-aware trade-level lifecycle",
    "common rules across all pairs",
    "profit-armed before dead-leg removal",
    "runner preservation as hard metric",
    "close-all only as broad deterioration response"
  ],
  "metrics_required_for_any_future_exit_candidate": [
    "top-20 winner retention ratio",
    "total ADR retention",
    "profit factor",
    "worst-week and worst-5-week tail risk",
    "year stability",
    "no pair-specific or regime-specific parameters"
  ],
  "caveats": [
    "Top winners have average top-5 share 0.537663; this supports runner preservation but does not prove live runner identifiability.",
    "Green-giveback end-state source counts are {\"mixed_end_state\":{\"weeks\":163,\"rate\":0.734234,\"average_positive_trades_at_friday\":13.515337,\"average_negative_trades_at_friday\":14.484663,\"average_negative_trade_drag_adr\":-14.857461},\"broad_laggard_drag\":{\"weeks\":55,\"rate\":0.247748,\"average_positive_trades_at_friday\":8.472727,\"average_negative_trades_at_friday\":19.527273,\"average_negative_trade_drag_adr\":-21.554975},\"few_surviving_leaders\":{\"weeks\":4,\"rate\":0.018018,\"average_positive_trades_at_friday\":4.25,\"average_negative_trades_at_friday\":23.75,\"average_negative_trade_drag_adr\":-18.840052}}; path-timing materialization is needed before dead-leg or leader-trail rules are trusted."
  ],
  "forbidden_next_steps": [
    "no broad dynamic-exit optimization",
    "no pair-specific tuning",
    "no Candidate B mutation",
    "no risk layer",
    "no fair-value pruning",
    "no promotion",
    "no MT5/live/runtime work"
  ]
}
```

## Artifacts

- Trade-leg final composition ledger: `docs/research/gates/gate73b/artifacts/gate73b-trade-leg-anatomy-preflight/trade-leg-final-composition.rows.jsonl`
- Top-winner decomposition: `docs/research/gates/gate73b/artifacts/gate73b-trade-leg-anatomy-preflight/top-winner-decomposition.json`
- Green-giveback end-state composition: `docs/research/gates/gate73b/artifacts/gate73b-trade-leg-anatomy-preflight/green-giveback-endstate-composition.json`
- Gate 72 final-composition forensics: `docs/research/gates/gate73b/artifacts/gate73b-trade-leg-anatomy-preflight/gate72-shortlist-final-composition-forensics.json`
- Trade-leg path timing gap: `docs/research/gates/gate73b/artifacts/gate73b-trade-leg-anatomy-preflight/trade-leg-path-timing-gap.json`
- Summary: `docs/research/gates/gate73b/artifacts/gate73b-trade-leg-anatomy-preflight/gate73b-summary.json`
- SHA identity: `docs/research/gates/gate73b/artifacts/gate73b-trade-leg-anatomy-preflight/gate73b-sha256.txt`

## Stop Line

Gate 73B is diagnostic/design preflight only. Gate 73C is not opened by this receipt.
