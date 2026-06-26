# Gate 55 Research Run Registry

The shared evaluator writes an append-only JSONL registry at:

```text
engine/reports/data-verification/gate55/registry/research-run-registry.jsonl
```

Each row records:

- `run_id`
- `gate_id`
- `hypothesis_id`
- `command`
- `git_commit`
- `input_manifest_hash`
- `price_bundle_id`
- `feature_bundle_id`
- `source_context_ids`
- `evaluator_version`
- `evaluators`
- `path_resolution`
- `config_hash`
- `output_result_hash`
- `receipt_hash`
- `status`
- `supersedes`
- `superseded_by`
- `rerun_reason`
- `equivalence_key_hash`
- artifact paths

Duplicate prevention key:

```text
input_manifest_hash
+ price_bundle_id
+ feature_bundle_id
+ source_context_ids
+ evaluator_version
+ evaluators
+ path_resolution
+ config_hash
```

If an equivalent non-blocked, non-superseded, non-archived run already exists,
the command prints the existing run, receipt, result, and equivalence key
instead of rerunning. A materially equivalent rerun must include
`--rerun-reason=<reason>`.
