param(
    [string]$ReportPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..\..")).Path
$enginePath = Join-Path $repoRoot "automation\mt5\Experts\Include\Core\Engine.mqh"
$routerPath = Join-Path $repoRoot "automation\mt5\Experts\Include\Execution\TradeRouter.mqh"
$sleevePath = Join-Path $repoRoot "automation\mt5\Experts\Include\Strategies\RevmaGridSleeve.mqh"
$diagPath = Join-Path $repoRoot "automation\mt5\Experts\Include\Receipts\MandatoryDiagnostics.mqh"
$canonicalCompile = Join-Path $repoRoot "automation\mt5\tools\Compile-Sync-LimniPortfolioEA-Canonical.ps1"
$engine = Get-Content -Raw -LiteralPath $enginePath
$router = Get-Content -Raw -LiteralPath $routerPath
$sleeve = Get-Content -Raw -LiteralPath $sleevePath
$diag = Get-Content -Raw -LiteralPath $diagPath
$results = [System.Collections.Generic.List[string]]::new()

function Assert-Recovery([string]$Name, [bool]$Condition, [string]$Detail) {
    $status = if ($Condition) { "PASS" } else { "FAIL" }
    $script:results.Add("$status|$Name|$Detail")
    if (!$Condition) { throw "Emergency recovery assertion failed: $Name - $Detail" }
}

Assert-Recovery "mandatory_writer_independent_of_receipt_mode" `
    ($diag -match 'FILE_COMMON' -and $engine -match 'm_mandatory\.Open\(' -and
     $engine -match 'm_receipts\.Open\(') `
    "mandatory files are opened separately before optional receipt handling"
Assert-Recovery "mandatory_file_contract" `
    ($diag -match 'run_manifest\.csv' -and $diag -match 'events\.csv' -and
     $diag -match 'first_blocker\.txt' -and $diag -match 'completion\.csv') `
    "all four non-optional files are created"
Assert-Recovery "first_blocker_flush_before_quarantine_close" `
    ($engine -match '(?s)m_mandatory\.FirstBlocker\("fatal_invariant".*?RunGate108ExecutionQuarantineStep') `
    "fatal path writes the immutable blocker before the close step"
Assert-Recovery "non_gate108_route_set_capture_is_noop" `
    ($engine -match '(?s)RememberGate108RoutedDealSet\(.*?if\(!plan\.gate108\)\s*return true;') `
    "single-pair routes do not enter FX28 deal-set capture"
Assert-Recovery "gate108_paths_are_mode_guarded" `
    ($engine -match 'm_gate108_research_active &&\s*trans\.type == TRADE_TRANSACTION_DEAL_DELETE' -and
     $engine -match 'm_gate108_research_active &&\s*!m_strategy_registry\.AuthorizeRevmaDiscovery') `
    "transaction mutation and pre-route R authority are FX28-only"
 $updateBranch = [regex]::Match($engine,
    '(?s)if\(m_gate108_research_active\s*&&\s*trans\.type == TRADE_TRANSACTION_DEAL_UPDATE\).*?\n\s*}\s*\n\s*if\(m_gate108_research_active\s*&&\s*trans\.type == TRADE_TRANSACTION_DEAL_ADD').Value
Assert-Recovery "deal_update_not_automatic_quarantine" `
    ($updateBranch -match 'deal_history_update' -and
     $updateBranch -notmatch 'EnterGate108ExecutionQuarantine') `
    "DEAL_UPDATE is recorded as history refresh, not directly treated as tampering"
Assert-Recovery "close_owner_is_never_blank" `
    ($engine -match 'unspecified_close_owner' -and
     $engine -match 'plan\.close_reason == ""') `
    "all routed close plans receive an explicit owner/reason"
Assert-Recovery "persistence_disabled_birth_is_nonfatal" `
    ($sleeve -match '(?s)if\(!m_state_persistence_enabled\)\s*return true;') `
    "disabled persistence cannot reject a successful birth"
Assert-Recovery "one_pending_record_consumed_per_birth" `
    ($sleeve -match '(?s)bool RecordExecutionOutcome\(.*?TakePendingLifecycle\(plan\.intent_id.*?RememberBirth\(') `
    "birth commit consumes one lifecycle record before snapshot commit"
Assert-Recovery "exact_atom_proof_uses_step_units" `
    ($engine -match 'long VolumeStepUnits' -and
     $engine -notmatch 'NormalizeDouble\(volume,\s*2\)') `
    "deal atom identity uses broker volume-step integer units"
Assert-Recovery "fx28_missing_history_waits" `
    ($engine -match 'WAITING_FOR_FX28_HISTORY' -and
     $engine -match 'gate108_m1_history_wait_timeout') `
    "initial FX28 history waits before bounded timeout failure"
Assert-Recovery "calendar_gate_present_in_legacy_revma" `
    ($engine -match 'LP_EvaluateCalendar\(' -and $engine -match 'calendar\.news_blocked') `
    "single-pair signal path consumes session/news eligibility"
Assert-Recovery "canonical_compile_tool_has_one_compile_invocation" `
    ((Test-Path -LiteralPath $canonicalCompile) -and
     ((Get-Content -Raw -LiteralPath $canonicalCompile) -split '/compile:').Count -eq 2) `
    "canonical tool contains exactly one MetaEditor compile invocation"

$results | ForEach-Object { Write-Output $_ }
if ($ReportPath -ne "") {
    if (![System.IO.Path]::IsPathRooted($ReportPath)) { $ReportPath = Join-Path $repoRoot $ReportPath }
    $parent = Split-Path -Parent $ReportPath
    if (!(Test-Path -LiteralPath $parent -PathType Container)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    [System.IO.File]::WriteAllLines($ReportPath, [string[]]$results, [System.Text.UTF8Encoding]::new($false))
    Write-Output "report=$([System.IO.Path]::GetFullPath($ReportPath))"
}
Write-Output "status=PASS"
