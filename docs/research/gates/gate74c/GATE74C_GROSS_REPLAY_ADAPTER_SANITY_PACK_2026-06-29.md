# Gate 74C Gross Replay Adapter Sanity Pack

Generated: `2026-06-29T07:18:40.394Z`

## Verdict

`PASS_GATE74C_GROSS_REPLAY_ADAPTER_SANITY_PACK__PAIR_GRID_LIFECYCLE_VISIBLE_NO_PROMOTION`

## Scope

- Replays a small gross-only adapter pack from the frozen Gate 74B trade-leg path warehouse.
- Tests independent pair net-grid cycle exits first; account-level equity exits are not active policy in this gate.
- Keeps grid spacing fixed at `0.2 ADR`; only net cycle target varies from `0.2` to `1.0 ADR`.
- Applies no spread, slippage, swap, commission, risk sizing, pair pruning, or promotion logic.

## Warehouse

```json
{
  "manifest_id": "gate74b_trade_leg_path_ECDE7C4A6553",
  "warehouse_hash": "36290BFDD28B47AFF31CA798C75ED1E7736A4778EBAA3E5FFAB64ECA07C462CC",
  "contract_id": "gate74_trade_leg_path_base_primitives_v1",
  "path_payload_codec": "gzip+json+columnar_trade_leg_path_points_v1",
  "week_count": 373,
  "pair_count": 28,
  "pair_week_rows_replayed": 10444,
  "source_path_point_count": 67650431,
  "gate74b_summary_hash_matched": true
}
```

## Adapter Results

| rule_id | closed | equity | eq_pf | eq_dd | win_rate | max_fills | max_open_loss | flip_loss | top20_ret |
|---|---|---|---|---|---|---|---|---|---|
| WEEKLY_FORCED_CLOSE | 638.115405 | 638.115405 | 1.414187 | -116.795157 | 0.520107 | 0 | 0 | 0 | 1 |
| CARRY_UNTIL_FLIP | 694.688146 | 597.519846 | 1.349786 | -167.030217 | 0.509383 | 1 | -39.622982 | -963.436728 | 0.988383 |
| PAIR_NET_GRID_CYCLE_TARGET_020_SPACING_020_RESTART_UNTIL_FLIP | 13159.101265 | 7511.883076 | 1.182561 | -7596.585157 | 0.541555 | 200 | -3832.160026 | -12392.423636 | 16.501015 |
| PAIR_NET_GRID_CYCLE_TARGET_030_SPACING_020_RESTART_UNTIL_FLIP | 13622.890685 | 7974.138824 | 1.195168 | -7552.154231 | 0.541555 | 200 | -3849.124023 | -11929.553743 | 15.707474 |
| PAIR_NET_GRID_CYCLE_TARGET_050_SPACING_020_RESTART_UNTIL_FLIP | 13469.050444 | 7874.678505 | 1.1971 | -7844.230957 | 0.517426 | 200 | -3849.124023 | -11948.955932 | 15.387409 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | 14381.312614 | 9901.156008 | 1.254319 | -5462.545131 | 0.533512 | 200 | -3830.275559 | -10815.950986 | 16.1365 |
| PAIR_NET_GRID_CYCLE_TARGET_100_SPACING_020_RESTART_UNTIL_FLIP | 13434.211888 | 9129.702498 | 1.25162 | -6166.809948 | 0.52815 | 196 | -3705.429455 | -11547.619185 | 14.757924 |

## Validation

```json
{
  "gate74a_passed": true,
  "gate74b_passed": true,
  "gate74b_manifest_complete": true,
  "warehouse_hash_matches_gate74b_summary": true,
  "adapter_count": 7,
  "expected_adapter_count": 7,
  "selected_weeks": 373,
  "selected_pairs": 28,
  "weekly_rows": 2611,
  "pair_summary_rows": 196,
  "annual_rows": 56,
  "gross_only": true,
  "costs_applied": false,
  "raw_m1_rebuild_performed": false,
  "fixed_adr_spacing_matrix_started": false,
  "account_equity_exit_policy_started": false,
  "pair_pruning_started": false,
  "risk_layer_started": false,
  "exit_promotion_started": false,
  "mt5_live_runtime_started": false,
  "brain_truth_mutated": false,
  "source_mutation_started": false,
  "runtime_seconds": 929.101
}
```

## Artifacts

- Adapter summary rows: `docs/research/gates/gate74c/artifacts/gate74c-gross-replay-adapter-sanity-pack/gross-replay-adapter-summary.rows.json`
- Weekly equity rows: `docs/research/gates/gate74c/artifacts/gate74c-gross-replay-adapter-sanity-pack/gross-replay-weekly-equity.rows.json`
- Pair summary rows: `docs/research/gates/gate74c/artifacts/gate74c-gross-replay-adapter-sanity-pack/gross-replay-pair-summary.rows.json`
- Annual rows: `docs/research/gates/gate74c/artifacts/gate74c-gross-replay-adapter-sanity-pack/gross-replay-annual.rows.json`
- Top-week retention: `docs/research/gates/gate74c/artifacts/gate74c-gross-replay-adapter-sanity-pack/top-week-retention.json`
- Summary: `docs/research/gates/gate74c/artifacts/gate74c-gross-replay-adapter-sanity-pack/gate74c-summary.json`
- SHA identity: `docs/research/gates/gate74c/artifacts/gate74c-gross-replay-adapter-sanity-pack/gate74c-sha256.txt`

## Stop Line

Gate 74C is gross replay discovery only. Costs, account-level equity exits, risk/correlation pruning, pair selection, promotion, MT5/live/runtime, source mutation, Brain mutation, and optimized spacing matrices remain closed unless explicitly opened.
