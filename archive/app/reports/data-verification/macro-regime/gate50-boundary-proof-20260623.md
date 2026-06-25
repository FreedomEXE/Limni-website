# Gate 50 Combined Boundary Proof Receipt

Generated: 2026-06-23T02:59:14.021Z

## Result

- Status: FAIL_BOUNDARY_PROOF
- Assertions: 16
- Passed: 14
- Failed: 2
- Diagnostic only: true
- Promotion eligible: false
- Expected content join-map hash: 12f3bb76d9fb2862b4072f2def7498fe413f3cc4c036f89fc7956996c806546e

## Blockers

| Blocker | Count |
|---|---:|
| rate_date_only_vintage_same_freeze_eligible | 1 |
| aud_monthly_transition_not_materialized | 1 |

## Assertions

| Status | Assertion | Category | Polarity | Actual | Blocker |
|---|---|---|---|---|---|
| PASS | exact_timestamp_immediately_before_freeze_is_eligible | freeze_timestamp | positive | target=2022-07-31T22:59:59.999Z selected=2022-07-31T23:00:00.000Z freeze=2022-07-31T23:00:00.000Z | - |
| PASS | exact_timestamp_equal_freeze_follows_inclusive_equality_rule | freeze_timestamp | positive | target=2022-07-31T23:00:00.000Z selected=2022-07-31T23:00:00.000Z freeze=2022-07-31T23:00:00.000Z | - |
| PASS | exact_timestamp_after_freeze_rolls_to_next_week | freeze_timestamp | negative | target=2022-07-31T23:00:00.001Z selected=2022-08-07T23:00:00.000Z next=2022-08-07T23:00:00.000Z | - |
| FAIL | date_only_alfred_vintage_rolls_to_first_strictly_later_freeze | rate_vintage_boundary | negative | datePrecisionRows=2976 sameDaySelected=31 sameDayEligible=31 | rate_date_only_vintage_same_freeze_eligible |
| PASS | rate_latest_vintage_never_uses_future_vintage_after_freeze_date | rate_revision_boundary | positive | futureVintageRows=0 | - |
| PASS | rate_revision_switches_are_retained_as_distinct_vintages | rate_revision_boundary | positive | revisedObservationKeys=30 latestVintageSwitches=31 | - |
| PASS | cpi_revision_rebasing_version_bound_to_weekly_rows | cpi_revision_rebasing | positive | rows=2976 missingRevisionRebasingVersion=0 activeRows=0 | - |
| PASS | quarterly_cpi_expected_carry_is_valid_and_not_stale | cpi_release_aware_carry | positive | quarterlyCarryRows=744 nzdQuarterlyCarryRows=372 quarterlyStaleRows=0 | - |
| PASS | aud_no_retrospective_monthly_before_transition | aud_cpi_transition | negative | preTransitionMonthlyRows=0 | - |
| FAIL | aud_monthly_source_used_after_transition | aud_cpi_transition | positive | postTransitionRows=23 monthly=0 quarterly=23 | aud_monthly_transition_not_materialized |
| PASS | eur_ea20_to_ea21_composition_transition | eur_cpi_transition | positive | pre2026ObsEa21Rows=0 post2026Rows=16 post2026Ea21Rows=16 missingDecisionRows=0 | - |
| PASS | rrp_derived_eligibility_equals_latest_parent_eligibility | rrp_parent_boundary | positive | rows=2976 missingParentSnapshots=0 derivedEligibilityMismatches=0 | - |
| PASS | rrp_sealed_diagnostic_join_remains_complete | rrp_join_boundary | positive | rrpRows=2976 joinablePairWeeks=10416 staleRows=0 missingRows=0 | - |
| PASS | new_york_dst_release_time_conversion | timezone_boundary | positive | winter=2025-01-03T20:30:00.000Z summer=2025-07-04T19:30:00.000Z | - |
| PASS | sydney_dst_release_time_conversion | timezone_boundary | positive | sydney=2025-11-26T00:30:00.000Z | - |
| PASS | delayed_release_exception_overrides_normal_schedule | exception_release_boundary | negative | normalRelease=2019-01-06T23:59:59.999Z normalEligibleWeek=2019-01-07T00:00:00.000Z actualRelease=2019-01-07T00:00:00.001Z actualEligibleWeek=2019-01-14T00:00:00.000Z nextInventoryWeek=2019-01-14T00:00:00.000Z | - |

This is a source-only boundary proof. It does not activate snapshots, compute P&L, or make strategy decisions.
