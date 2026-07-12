# Gate 109 FX28 Bounded Diagnostics — 2026-07-12

## Status

Implemented and compile-verified. Freedom-owned FX28 runtime diagnosis remains
pending. This gate does not claim that the formulaic Revma implementation is
better than the older FX28 system, and it does not repair FX28.

## Scope

The `1.037` pass adds only observational diagnostics:

- the run manifest now labels the loaded runtime config hash as
  `loaded_runtime_input_hash` and records explicit `fx28_active` state;
- the R portfolio records aggregate run totals and the first example for the
  fixed rejection categories: invalid Revma classification, session
  ineligible, news ineligible, re-entry blocked, already exposed/capacity
  blocked, and other invariant failure;
- diagnostics are emitted in the final Revma summary only. There is no
  per-symbol or per-bar diagnostic stream.

The existing `BuildCandidate()` predicates, evaluation order, return values,
allocation rules, atom size, two-atom envelope, and route/execution paths remain
unchanged apart from recording the observed boundary before the existing return.

## Version and source identity

```text
ea_version=1.037
build_gate=Gate109Fx28Diagnostics
build_scope=phase-fx28-bounded-diagnostics-v1
source_bundle=sha256:03ba4004c81f85198eac178685fac236833d440fdaa2423f0876052fac66852e
source_count=54
base_commit=b1edc2e0
```

## Static and canonical compile proof

Artifact: [phase-fx28-diagnostics-canonical-compile-20260712](artifacts/phase-fx28-diagnostics-canonical-compile-20260712/)

```text
terminal=94497
compile=0 errors, 0 warnings
repo_ex5_sha256=A6FB684363B34A7C2EABA25467DF3FB5E5D4155C2C84E76C401C982C90CD7ECE
terminal_ex5_sha256=A6FB684363B34A7C2EABA25467DF3FB5E5D4155C2C84E76C401C982C90CD7ECE
repo_terminal_ex5_byte_identical=true
strategy_tester_run=false
optimization_run=false
benchmark_run=false
backtest_run=false
```

The protected generic and execution contracts were not modified. Current
SHA256 values for the protected files are recorded here for review:

```text
automation/mt5/Experts/Include/Core/Config.mqh       3CB54B312D39088C2CAC9CDDD5EEEAA29C573BD5FE37364A15998FA3A70866F6
automation/mt5/Experts/Include/Core/Types.mqh        5869B9689693A052D05BB1D3B75B045421CCFF58833068EC3BDA288621FCB94D
automation/mt5/Experts/Include/Core/Engine.mqh      26A1C14E9B54C758B0EA729FC7DE911BDBA27606C057037A8533EE35F1822852
automation/mt5/Experts/Include/Portfolio/RiskArbiter.mqh 7A569CC838B24ED19738CB9F9F69E30F393BE8BD9E5EE1A7EEF888F2A0FB8E61
automation/mt5/Experts/Include/Execution/TradeRouter.mqh A112F977F4E8859FF77F6BA333CF4CF271B9052D8AA7595272CCBFAAF612029F
automation/mt5/Experts/Include/Execution/MagicCodec.mqh 238016B6FD582C488A01D5129479550E2E4802460BD256595052E50BF3E4736F
automation/mt5/Experts/Include/Strategies/Revma/RevmaTypes.mqh 94BF18DDB26BA78D7E3A9A720958617B2F2B0F533001872CAE0A869B0A71E2F7
automation/mt5/Experts/Include/Strategies/Revma/RevmaDiscoveryTypes.mqh B79FE9E6353D04C5C3BE1AB5DA8FF59F4D5B392E062A03279DE2D03F9F13082C
```

## Next decision

Freedom should run the bounded FX28 smoke and review the runtime manifest and
summary. The result should identify whether the stop is before cohort
formation, signal construction, R birth eligibility, candidate admission,
routing, or fills. No architecture separation, formula change, or economic
repair is authorized by this gate.
