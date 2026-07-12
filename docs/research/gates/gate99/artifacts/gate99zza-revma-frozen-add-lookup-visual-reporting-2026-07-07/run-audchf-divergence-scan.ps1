$ErrorActionPreference = "Stop"

$artifact = Split-Path -Parent $MyInvocation.MyCommand.Path
$terminal = "C:\Users\User\AppData\Roaming\Five Percent Online MetaTrader 5 - alt\terminal64.exe"
$commonRoot = "C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\Common\Files"
$configDir = Join-Path $artifact "scan-configs"
New-Item -ItemType Directory -Force -Path $configDir | Out-Null

function Close-AltTerminals {
  Get-Process -Name terminal64 -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -like "*Five Percent Online MetaTrader 5 - alt*" } |
    ForEach-Object { $null = $_.CloseMainWindow() }
  Start-Sleep -Seconds 4
}

function Parse-ReceiptFields([string]$message) {
  $fields = @{}
  foreach ($part in ($message -split "\|")) {
    $idx = $part.IndexOf("=")
    if ($idx -gt 0) {
      $fields[$part.Substring(0, $idx)] = $part.Substring($idx + 1)
    }
  }
  return $fields
}

function Write-ScanConfig(
  [datetime]$from,
  [datetime]$to,
  [string]$tag,
  [string]$folderName,
  [string]$path
) {
  $report = "Gate99ZZA_AUDCHF_$tag"
  $fromText = $from.ToString("yyyy.MM.dd")
  $toText = $to.ToString("yyyy.MM.dd")
  $content = @"
; Gate 99ZZA one-pair Revma frozen-add divergence scan.
; Scope: AUDCHF.i only, no optimization, no performance claim.
[Tester]
Expert=Limni\LimniPortfolioEA.ex5
Symbol=AUDCHF.i
Period=M1
Optimization=0
Model=2
FromDate=$fromText
ToDate=$toText
ForwardMode=0
Deposit=10000
Currency=USD
ProfitInPips=0
Leverage=100
ExecutionMode=0
OptimizationCriterion=1
Visual=0
Report=$report
ReplaceReport=1
[TesterInputs]
ExecutionMode=2||0||0||3||N
EnableTrading=true||false||0||true||N
AllowLiveTrading=false||false||0||true||N
EnableOpenOrderRouting=true||false||0||true||N
EnableCloseExecution=false||false||0||true||N
EnableAccountCloseExecution=false||false||0||true||N
EnableStrategyEvaluation=true||false||0||true||N
RequireHedgingAccount=true||false||0||true||N
RequireAllSymbols=false||false||0||true||N
BrokerSymbolSuffix=.i
UseWeekBoundaryGuard=true||false||0||true||N
BrokerToEstOffsetHours=0.0||0.0||0.000000||0.000000||N
NewsGuardMode=0||0||0||2||N
NewsCalendarFile=LimniPortfolioEA\news_events.csv
NewsBlockBeforeMinutes=30||30||1||300||N
NewsBlockAfterMinutes=30||30||1||300||N
EnablePortfolioHarvestGovernor=false||false||0||true||N
HarvestInitialTargetMoney=0.0||0.0||0.000000||0.000000||N
HarvestTrailMoney=0.0||0.0||0.000000||0.000000||N
HarvestSoftLockOnBreach=true||false||0||true||N
HarvestGridWinddownOnBreach=true||false||0||true||N
HarvestArmEmergencyLiquidation=false||false||0||true||N
EnableCurrencyExposureGuard=false||false||0||true||N
MaxCurrencySignedLots=5.0||5.0||0.100000||50.000000||N
MaxCurrencyGrossLots=10.0||10.0||0.100000||100.000000||N
MaxSameDirectionGridsPerCurrency=4||4||1||20||N
MaxManagedPositions=200||200||1||500||N
MaxSingleOrderLots=1.0||1.0||0.010000||10.000000||N
MaxClosePositionsPerStep=10||10||1||100||N
NewsMinimumImpact=3||3||1||3||N
EnableRevmaSystem=true||false||0||true||N
RevmaUniverseMode=0||0||0||1||N
RevmaEnableContinuationSleeve=true||false||0||true||N
RevmaEnableReversionSleeve=true||false||0||true||N
RevmaQProfile=1||0||0||4||N
RevmaMaxM1Bars=50000||50000||1000||250000||N
RevmaFixedLots=0.01||0.01||0.010000||1.000000||N
RevmaGridSpacingQ=0.1||1.0||0.100000||5.000000||N
RevmaIntentExpiryMinutes=10||10||1||120||N
RevmaShowVisualDashboard=false||false||0||true||N
RevmaDashboardRefreshSeconds=1||1||0||60||N
EnableQStateTrendVariant=false||false||0||true||N
QStateFixedLots=0.01||0.01||0.010000||1.000000||N
QStateGridSpacingQ=1.0||1.0||0.100000||5.000000||N
QStateGridCap=50||50||1||500||N
QStateIntentExpiryMinutes=10||10||1||120||N
QStateReentryNextDayAfterHarvest=true||false||0||true||N
UseTimerWatchdog=false||false||0||true||N
ExportToCommonFiles=true||false||0||true||N
OutputFolder=$folderName
"@
  Set-Content -LiteralPath $path -Value $content -Encoding ASCII
}

$starts = @()
$cursor = [datetime]"2025-01-01"
while ($cursor -le [datetime]"2026-06-01") {
  $starts += $cursor
  $cursor = $cursor.AddMonths(1)
}

$scanRows = @()
foreach ($start in $starts) {
  Close-AltTerminals

  $to = $start.AddDays(10)
  $tag = "scan_" + $start.ToString("yyyyMMdd")
  $folderName = "LimniPortfolioEA_Gate99ZZA_AUDCHF_$tag"
  $ini = Join-Path $configDir "$tag.ini"
  Write-ScanConfig -from $start -to $to -tag $tag -folderName $folderName -path $ini

  $process = Start-Process -FilePath $terminal -ArgumentList @("/config:$ini") -PassThru -WindowStyle Hidden
  $common = Join-Path $commonRoot $folderName
  $done = $false

  for ($i = 0; $i -lt 48; $i++) {
    $summary = Get-ChildItem -LiteralPath $common -Filter "*_summary.csv" -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if ($summary -and $summary.Length -gt 0) {
      $metrics = Import-Csv -LiteralPath $summary.FullName
      if ($metrics | Where-Object { $_.metric -eq "deinit_reason" }) {
        $done = $true
        break
      }
    }
    Start-Sleep -Seconds 5
  }

  $receipt = Get-ChildItem -LiteralPath $common -Filter "*_receipts.csv" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  $summaryFile = Get-ChildItem -LiteralPath $common -Filter "*_summary.csv" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  $birth = $null
  $adds = @()
  $divergentAdds = @()
  if ($receipt -and $receipt.Length -gt 0) {
    $rows = Import-Csv -LiteralPath $receipt.FullName
    $birth = $rows | Where-Object receipt_type -eq "revma_grid_birth" | Select-Object -First 1
    $adds = @($rows | Where-Object receipt_type -eq "revma_grid_add")
    $divergentAdds = @($adds | Where-Object {
      $fields = Parse-ReceiptFields $_.message
      $fields.ContainsKey("current_matches_birth_identity") -and $fields["current_matches_birth_identity"] -eq "false"
    })
  }

  $qProfile = ""
  $spacing = ""
  if ($summaryFile -and $summaryFile.Length -gt 0) {
    $metrics = Import-Csv -LiteralPath $summaryFile.FullName
    $qProfile = ($metrics | Where-Object metric -eq "revma_q_profile_id" | Select-Object -First 1).value
    $spacing = ($metrics | Where-Object metric -eq "revma_grid_spacing_q" | Select-Object -First 1).value
  }

  $birthFields = @{}
  if ($birth) {
    $birthFields = Parse-ReceiptFields $birth.message
  }
  $firstAddFields = @{}
  if ($adds.Count -gt 0) {
    $firstAddFields = Parse-ReceiptFields $adds[0].message
  }
  $firstDivergentAddFields = @{}
  if ($divergentAdds.Count -gt 0) {
    $firstDivergentAddFields = Parse-ReceiptFields $divergentAdds[0].message
  }

  $scanRows += [pscustomobject]@{
    tag = $tag
    from = $start.ToString("yyyy-MM-dd")
    to = $to.ToString("yyyy-MM-dd")
    done = $done
    birth_time = if ($birthFields.ContainsKey("source_m1_time")) { $birthFields["source_m1_time"] } else { "" }
    direction = if ($birthFields.ContainsKey("direction")) { $birthFields["direction"] } else { "" }
    anchor_location = if ($birthFields.ContainsKey("anchor_location")) { $birthFields["anchor_location"] } else { "" }
    sleeve = if ($birthFields.ContainsKey("sleeve")) { $birthFields["sleeve"] } else { "" }
    add_policy = if ($birthFields.ContainsKey("add_policy")) { $birthFields["add_policy"] } else { "" }
    q_profile_id = $qProfile
    spacing_q = $spacing
    add_count = $adds.Count
    divergent_add_count = $divergentAdds.Count
    first_add_time = if ($firstAddFields.ContainsKey("current_source_m1_time")) { $firstAddFields["current_source_m1_time"] } else { "" }
    first_add_policy = if ($firstAddFields.ContainsKey("add_policy")) { $firstAddFields["add_policy"] } else { "" }
    first_add_birth_snapshot = if ($firstAddFields.ContainsKey("birth_snapshot")) { $firstAddFields["birth_snapshot"] } else { "" }
    first_divergent_add_time = if ($firstDivergentAddFields.ContainsKey("current_source_m1_time")) { $firstDivergentAddFields["current_source_m1_time"] } else { "" }
    first_divergent_current_direction = if ($firstDivergentAddFields.ContainsKey("current_direction")) { $firstDivergentAddFields["current_direction"] } else { "" }
    first_divergent_current_sleeve = if ($firstDivergentAddFields.ContainsKey("current_sleeve")) { $firstDivergentAddFields["current_sleeve"] } else { "" }
    first_divergent_current_variant_id = if ($firstDivergentAddFields.ContainsKey("current_variant_id")) { $firstDivergentAddFields["current_variant_id"] } else { "" }
    first_divergent_frozen_direction = if ($firstDivergentAddFields.ContainsKey("frozen_direction")) { $firstDivergentAddFields["frozen_direction"] } else { "" }
    first_divergent_frozen_sleeve = if ($firstDivergentAddFields.ContainsKey("frozen_sleeve")) { $firstDivergentAddFields["frozen_sleeve"] } else { "" }
    first_divergent_frozen_variant_id = if ($firstDivergentAddFields.ContainsKey("frozen_variant_id")) { $firstDivergentAddFields["frozen_variant_id"] } else { "" }
    first_divergent_add_policy = if ($firstDivergentAddFields.ContainsKey("add_policy")) { $firstDivergentAddFields["add_policy"] } else { "" }
    receipt = if ($receipt) { $receipt.FullName } else { "" }
    summary = if ($summaryFile) { $summaryFile.FullName } else { "" }
  }

  Write-Host ("completed {0} done={1} birth={2}/{3}/{4} adds={5} divergent_adds={6}" -f $tag, $done, $scanRows[-1].direction, $scanRows[-1].anchor_location, $scanRows[-1].sleeve, $adds.Count, $divergentAdds.Count)
}

Close-AltTerminals
$out = Join-Path $artifact "audchf-one-pair-scan-summary.csv"
$scanRows | Export-Csv -LiteralPath $out -NoTypeInformation -Encoding ASCII
$scanRows | Format-Table tag,from,to,direction,anchor_location,sleeve,add_policy,add_count,divergent_add_count,first_divergent_add_time -AutoSize | Out-String -Width 260
Write-Host "summary=$out"
