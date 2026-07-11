param(
    [string]$ProofPath = "",
    [string]$SourceManifestPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..\..")).Path
$sourceBundleTool = Join-Path $PSScriptRoot "Test-Gate108SourceBundle.ps1"
$configPath = Join-Path $repoRoot "automation\mt5\Experts\Include\Core\Config.mqh"
$buildInfoPath = Join-Path $repoRoot "automation\mt5\Experts\Include\Core\BuildInfo.mqh"
$coreTypesPath = Join-Path $repoRoot "automation\mt5\Experts\Include\Core\Types.mqh"
$typesPath = Join-Path $repoRoot "automation\mt5\Experts\Include\Strategies\Revma\RevmaDiscoveryTypes.mqh"
$revmaTypesPath = Join-Path $repoRoot "automation\mt5\Experts\Include\Strategies\RevmaTypes.mqh"
$pairDirectionPath = Join-Path $repoRoot "automation\mt5\Indicators\Include\LimniPairDirectionCore.mqh"
$presetPath = Join-Path $repoRoot "automation\mt5\tester-presets\limni-portfolio-revma-gate108a-controlled.set"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

if ($SourceManifestPath -eq "") {
    $SourceManifestPath = Join-Path ([System.IO.Path]::GetTempPath()) (
        "gate108-source-closure-" + [guid]::NewGuid().ToString("N") + ".csv")
    $deleteManifest = $true
} else {
    if (![System.IO.Path]::IsPathRooted($SourceManifestPath)) {
        $SourceManifestPath = Join-Path $repoRoot $SourceManifestPath
    }
    $deleteManifest = $false
}

function Assert-RegexCount {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$Pattern,
        [Parameter(Mandatory = $true)][int]$Expected,
        [Parameter(Mandatory = $true)][string]$Label
    )
    $count = [regex]::Matches($Text, $Pattern).Count
    if ($count -ne $Expected) {
        throw "$Label count mismatch: expected=$Expected actual=$count"
    }
}

function Get-StringDefine([string]$Text, [string]$Name) {
    $match = [regex]::Match($Text, '(?m)^\s*#define\s+' + [regex]::Escape($Name) + '\s+"([^"]+)"\s*$')
    if (!$match.Success) { throw "Missing string define: $Name" }
    return $match.Groups[1].Value
}

function Get-ConstString([string]$Text, [string]$Name) {
    $match = [regex]::Match($Text, '(?m)^\s*const\s+string\s+' + [regex]::Escape($Name) + '\s*=\s*"([^"]+)"\s*;')
    if (!$match.Success) { throw "Missing string constant: $Name" }
    return $match.Groups[1].Value
}

function Get-MqlFunctionBody([string]$Text, [string]$Name) {
    $match = [regex]::Match($Text, '(?m)^(?:string|ulong)\s+' + [regex]::Escape($Name) + '\s*\([^)]*\)\s*\{')
    if (!$match.Success) { throw "Missing MQL function: $Name" }
    $open = $Text.IndexOf('{', $match.Index)
    $depth = 0
    $quoted = $false
    for ($i = $open; $i -lt $Text.Length; $i++) {
        $ch = $Text[$i]
        if ($ch -eq '"' -and ($i -eq 0 -or $Text[$i - 1] -ne '\')) {
            $quoted = !$quoted
            continue
        }
        if ($quoted) { continue }
        if ($ch -eq '{') { $depth++ }
        elseif ($ch -eq '}') {
            $depth--
            if ($depth -eq 0) {
                return $Text.Substring($open + 1, $i - $open - 1)
            }
        }
    }
    throw "Unbalanced MQL function body: $Name"
}

function Split-MqlConcat([string]$Expression) {
    $parts = [System.Collections.Generic.List[string]]::new()
    $start = 0
    $depth = 0
    $quoted = $false
    for ($i = 0; $i -lt $Expression.Length; $i++) {
        $ch = $Expression[$i]
        if ($ch -eq '"' -and ($i -eq 0 -or $Expression[$i - 1] -ne '\')) {
            $quoted = !$quoted
            continue
        }
        if ($quoted) { continue }
        if ($ch -eq '(') { $depth++ }
        elseif ($ch -eq ')') { $depth-- }
        elseif ($ch -eq '+' -and $depth -eq 0) {
            $parts.Add($Expression.Substring($start, $i - $start))
            $start = $i + 1
        }
    }
    $parts.Add($Expression.Substring($start))
    return [string[]]$parts
}

function Resolve-MqlPayloadAtom([string]$Atom, $Values) {
    $trimmed = $Atom.Trim()
    if ($trimmed.StartsWith('"') -and $trimmed.EndsWith('"')) {
        return $trimmed.Substring(1, $trimmed.Length - 2).Replace('\"', '"').Replace('\\', '\')
    }
    $normalized = ([regex]::Replace($trimmed, '\s+', '') -replace '^\(string\)', '')
    if (!$Values.ContainsKey($normalized)) {
        throw "Unsupported MQL payload atom: '$trimmed'"
    }
    return $Values[$normalized]
}

function Resolve-MqlPayloadExpression([string]$Expression, $Values) {
    $builder = [System.Text.StringBuilder]::new()
    foreach ($atom in (Split-MqlConcat $Expression)) {
        [void]$builder.Append((Resolve-MqlPayloadAtom $atom $Values))
    }
    return $builder.ToString()
}

function Evaluate-MqlPayload([string]$Text, [string]$FunctionName, $Values) {
    $body = Get-MqlFunctionBody $Text $FunctionName
    $initial = [regex]::Match($body, '(?s)string\s+payload\s*=\s*(.*?);')
    if (!$initial.Success) { throw "Missing payload initializer: $FunctionName" }
    $tail = $body.Substring($initial.Index)
    if ([regex]::IsMatch($tail, '\b(?:if|for|while|switch)\s*\(') -or
        [regex]::IsMatch($tail, 'payload\s*(?:-=|\*=|/=|\+\+|--)')) {
        throw "Unsupported conditional or non-append payload mutation: $FunctionName"
    }
    $appendMatches = [regex]::Matches($body, '(?s)payload\s*\+=\s*(.*?);')
    $mutationCount = [regex]::Matches($body, 'payload\s*(?:=|\+=)').Count
    if ($mutationCount -ne 1 + $appendMatches.Count) {
        throw "Unsupported payload mutation form: $FunctionName"
    }
    $builder = [System.Text.StringBuilder]::new()
    [void]$builder.Append((Resolve-MqlPayloadExpression $initial.Groups[1].Value $Values))
    foreach ($match in $appendMatches) {
        [void]$builder.Append((Resolve-MqlPayloadExpression $match.Groups[1].Value $Values))
    }
    return $builder.ToString()
}

function Assert-FnvHashBody([string]$Text, [string]$FunctionName, [string]$CharacterFunction) {
    $body = Get-MqlFunctionBody $Text $FunctionName
    $normalized = [regex]::Replace($body, '\s+', '')
    $expected = 'ulonghash=1469598103934665603;intlen=StringLen(value);for(inti=0;i<len;i++){hash^=(ulong)' +
        $CharacterFunction + '(value,i);hash*=1099511628211;}returnhash;'
    if ($normalized -cne $expected) {
        throw "Runtime FNV-1a implementation drift: $FunctionName"
    }
}

if (-not ('Gate108Hash' -as [type])) {
    Add-Type -TypeDefinition @'
public static class Gate108Hash
{
    public static ulong Fnv1a64(string value)
    {
        unchecked
        {
            ulong hash = 1469598103934665603UL;
            foreach (char c in value)
            {
                hash ^= c;
                hash *= 1099511628211UL;
            }
            return hash;
        }
    }
}
'@
}

try {
    $bundleOutput = @(& $sourceBundleTool -ManifestPath $SourceManifestPath)
    if (@($bundleOutput | Select-String '^status=MATCH$').Count -ne 1) {
        throw "Gate108 source bundle is not sealed and matched."
    }
    $bundleMap = @{}
    foreach ($line in $bundleOutput) {
        if ($line -match '^([^=]+)=(.*)$') { $bundleMap[$matches[1]] = $matches[2] }
    }
    if ($bundleMap['source_count'] -ne '57' -or
        $bundleMap['external_include_count'] -ne '1' -or
        $bundleMap['external_includes'] -cne 'Trade/Trade.mqh') {
        throw "Gate108 canonical source closure shape mismatch."
    }

    $manifestRows = @(Import-Csv -LiteralPath $SourceManifestPath)
    if ($manifestRows.Count -ne 57) { throw "Gate108 manifest row count mismatch." }
    $inputLines = [System.Collections.Generic.List[string]]::new()
    foreach ($row in $manifestRows) {
        $path = Join-Path $repoRoot ($row.repo_relative_path -replace '/', '\')
        $text = [System.IO.File]::ReadAllText($path)
        foreach ($match in [regex]::Matches($text, '(?m)^\s*(?:sinput|input)\b[^\r\n]*')) {
            $inputLines.Add($match.Value.Trim())
        }
    }
    $expectedInputs = @(
        'input group "Gate 108 Broker Compatibility"',
        'input string BrokerSymbolSuffix = ".i";'
    )
    if ($inputLines.Count -ne 2 -or
        $inputLines[0] -cne $expectedInputs[0] -or
        $inputLines[1] -cne $expectedInputs[1] -or
        @($inputLines | Where-Object { $_ -match '^sinput\b' }).Count -ne 0) {
        throw "Gate108 operator input surface is not exact."
    }

    $presetBytes = [System.IO.File]::ReadAllBytes($presetPath)
    $presetHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $presetPath).Hash
    $expectedPreset = [System.Text.Encoding]::ASCII.GetBytes("BrokerSymbolSuffix=.i`n")
    $presetBytesMatch = ($presetBytes.Length -eq $expectedPreset.Length -and
        @((Compare-Object -ReferenceObject $presetBytes -DifferenceObject $expectedPreset -SyncWindow 0)).Count -eq 0)
    if ($presetBytes.Length -ne 22 -or $presetHash -cne '57A2AECDE64179F4363E66EC85242A31BADC5AB9EACD7A862CB65AF53F454F1C' -or
        -not $presetBytesMatch) {
        throw "Gate108 controlled tester preset mismatch."
    }

    $configText = [System.IO.File]::ReadAllText($configPath)
    $requiredConfigPatterns = @(
        'config\.execution_mode\s*=\s*LP_EXECUTION_TESTER_ONLY\s*;',
        'config\.allow_live_trading\s*=\s*false\s*;',
        'config\.enable_qstate_trend_variant\s*=\s*false\s*;',
        'config\.enable_revma_system\s*=\s*true\s*;',
        'config\.revma_universe_mode\s*=\s*LP_UNIVERSE_FX28\s*;',
        'config\.revma_fixed_lots\s*=\s*0\.01\s*;',
        'config\.revma_grid_spacing_q\s*=\s*0\.10\s*;',
        'config\.stop_take_profit_mode\s*=\s*LP_SLTP_DISABLED\s*;',
        'config\.broker_grid_tp_sync_mode\s*=\s*LP_BROKER_GRID_TP_SYNC_OFF\s*;',
        'config\.persist_revma_lifecycle_state\s*=\s*false\s*;'
    )
    foreach ($pattern in $requiredConfigPatterns) {
        Assert-RegexCount $configText $pattern 1 "controlled config pattern $pattern"
    }

    $buildInfoText = [System.IO.File]::ReadAllText($buildInfoPath)
    $coreTypesText = [System.IO.File]::ReadAllText($coreTypesPath)
    $typesText = [System.IO.File]::ReadAllText($typesPath)
    $revmaTypesText = [System.IO.File]::ReadAllText($revmaTypesPath)
    $pairText = [System.IO.File]::ReadAllText($pairDirectionPath)
    Assert-RegexCount $typesText '(?m)^#define\s+LP_REVMA_DISCOVERY_CAPITAL_BUDGET_FRACTION\s+0\.10\s*$' 1 'capital budget fraction'
    Assert-RegexCount $typesText '(?m)^#define\s+LP_REVMA_REAL_MAX_ATOMS_PER_GRID\s+2\s*$' 1 'real atom maximum'
    Assert-RegexCount $typesText '(?m)^#define\s+LP_REVMA_DISCOVERY_FILLING_POLICY_ID\s+"BROKER_FOK_EXACT_ATOM_V1"\s*$' 1 'filling policy'
    Assert-RegexCount $typesText '(?m)^#define\s+LP_REVMA_DISCOVERY_MAX_SLIPPAGE_POINTS\s+10\s*$' 1 'slippage points'
    $constantAssertions = @(
        @($pairText, '(?m)^#define\s+LIMNI_PAIR_DIRECTION_CONFIRM_EVENTS\s+5\s*$', 'pair confirm events'),
        @($pairText, '(?m)^#define\s+LIMNI_PAIR_DIRECTION_MIN_FLIP_SCORE\s+0\.25\s*$', 'pair minimum flip score'),
        @($typesText, '(?m)^#define\s+LP_REVMA_DISCOVERY_CAPITAL_BUDGET_NUMERATOR\s+1\s*$', 'budget numerator'),
        @($typesText, '(?m)^#define\s+LP_REVMA_DISCOVERY_CAPITAL_BUDGET_DENOMINATOR\s+10\s*$', 'budget denominator'),
        @($typesText, '(?m)^#define\s+LP_REVMA_DISCOVERY_ATOM_LOTS\s+0\.01\s*$', 'atom lots'),
        @($typesText, '(?m)^#define\s+LP_REVMA_DISCOVERY_CELL_Q_FRACTION\s+0\.10\s*$', 'mesh q fraction'),
        @($typesText, '(?m)^#define\s+LP_REVMA_DISCOVERY_MAX_ADMISSIONS_PER_M1\s+1\s*$', 'M1 admission cap'),
        @($typesText, '(?m)^#define\s+LP_REVMA_DISCOVERY_Q_PROFILE\s+LP_REVMA_Q_PROFILE_MEDIUM\s*$', 'q profile'),
        @($typesText, '(?m)^#define\s+LP_REVMA_DISCOVERY_MAX_M1_BARS\s+50000\s*$', 'q max M1 bars'),
        @($typesText, '(?m)^#define\s+LP_REVMA_DISCOVERY_TRANSITION_BUFFER_ROWS\s+256\s*$', 'transition buffer'),
        @($typesText, '(?m)^#define\s+LP_REVMA_DISCOVERY_TRANSITION_FLUSH_ROWS\s+64\s*$', 'transition flush'),
        @($typesText, '(?m)^#define\s+LP_REVMA_DISCOVERY_SUMMARY_BUFFER_ROWS\s+64\s*$', 'summary buffer'),
        @($typesText, '(?m)^#define\s+LP_REVMA_DISCOVERY_SUMMARY_FLUSH_ROWS\s+16\s*$', 'summary flush'),
        @($typesText, '(?m)^#define\s+LP_REVMA_DISCOVERY_MAX_LINE_BYTES\s+8192\s*$', 'line guard'),
        @($typesText, '(?m)^#define\s+LP_REVMA_DISCOVERY_ARTIFACT_BYTE_GUARD\s+4294967296\s*$', 'artifact guard'),
        @($typesText, '(?m)^#define\s+LP_REVMA_DISCOVERY_COHORT_WAIT_SECONDS\s+900\s*$', 'cohort wait'),
        @($revmaTypesText, '(?s)if\(profile\s*==\s*LP_REVMA_Q_PROFILE_MEDIUM\)\s*return\s*"MEDIUM"\s*;', 'medium q profile name')
    )
    foreach ($assertion in $constantAssertions) {
        Assert-RegexCount $assertion[0] $assertion[1] 1 $assertion[2]
    }
    Assert-FnvHashBody $coreTypesText 'LP_HashString' 'StringGetCharacter'
    Assert-FnvHashBody $pairText 'LimniPairDirectionHashString' 'StringGetCharacter'

    $values = [System.Collections.Generic.Dictionary[string,string]]::new([System.StringComparer]::Ordinal)
    $values['LIMNI_PAIR_DIRECTION_V001_FORMULA_ID'] = Get-StringDefine $pairText 'LIMNI_PAIR_DIRECTION_V001_FORMULA_ID'
    $values['IntegerToString(LIMNI_PAIR_DIRECTION_CONFIRM_EVENTS)'] = '5'
    $values['DoubleToString(LIMNI_PAIR_DIRECTION_MIN_FLIP_SCORE,2)'] = '0.25'
    $pairPayload = Evaluate-MqlPayload $pairText 'LimniPairDirectionFormulaHash' $values
    $pairHash = [Gate108Hash]::Fnv1a64($pairPayload)

    $values['LP_REVMA_FORMULA_ID'] = Get-StringDefine $revmaTypesText 'LP_REVMA_FORMULA_ID'
    $values['LP_REVMA_SYSTEM_ID'] = Get-StringDefine $revmaTypesText 'LP_REVMA_SYSTEM_ID'
    $values['LimniPairDirectionFormulaId()'] = $values['LIMNI_PAIR_DIRECTION_V001_FORMULA_ID']
    $values['LimniPairDirectionFormulaHash()'] = $pairHash.ToString()
    $revmaPayload = Evaluate-MqlPayload $revmaTypesText 'LP_RevmaFormulaHash' $values
    $revmaHash = [Gate108Hash]::Fnv1a64($revmaPayload)

    $stringDefines = @(
        'LP_REVMA_DISCOVERY_FORMULA_ID','LP_REVMA_DISCOVERY_PROFILE_ID',
        'LP_REVMA_DISCOVERY_PROFILE_CONTRACT_ID','LP_REVMA_DISCOVERY_MESH_ID',
        'LP_REVMA_DISCOVERY_VALUATION_ID','LP_REVMA_DISCOVERY_FILLING_POLICY_ID',
        'LP_REVMA_DISCOVERY_TELEMETRY_SCHEMA_ID','LP_REVMA_REAL_BRANCH_ID',
        'LP_REVMA_SHADOW_U_BRANCH_ID','LP_REVMA_SHADOW_C_BRANCH_ID'
    )
    foreach ($name in $stringDefines) { $values[$name] = Get-StringDefine $typesText $name }
    $values['LP_EA_SOURCE_BUNDLE_ALGORITHM'] = Get-ConstString $buildInfoText 'LP_EA_SOURCE_BUNDLE_ALGORITHM'
    $values['LP_EA_SOURCE_BUNDLE_ID'] = Get-ConstString $buildInfoText 'LP_EA_SOURCE_BUNDLE_ID'
    $values['LP_RevmaQProfileName(LP_REVMA_DISCOVERY_Q_PROFILE)'] = 'MEDIUM'
    $values['IntegerToString(LP_REVMA_DISCOVERY_MAX_M1_BARS)'] = '50000'
    $values['IntegerToString(LP_REVMA_DISCOVERY_MAX_SLIPPAGE_POINTS)'] = '10'
    $values['IntegerToString(LP_REVMA_DISCOVERY_CAPITAL_BUDGET_NUMERATOR)'] = '1'
    $values['IntegerToString(LP_REVMA_DISCOVERY_CAPITAL_BUDGET_DENOMINATOR)'] = '10'
    $values['IntegerToString(LP_REVMA_REAL_MAX_ATOMS_PER_GRID)'] = '2'
    $values['IntegerToString(LP_REVMA_DISCOVERY_MAX_ADMISSIONS_PER_M1)'] = '1'
    $values['IntegerToString(LP_REVMA_DISCOVERY_TRANSITION_BUFFER_ROWS)'] = '256'
    $values['IntegerToString(LP_REVMA_DISCOVERY_TRANSITION_FLUSH_ROWS)'] = '64'
    $values['IntegerToString(LP_REVMA_DISCOVERY_SUMMARY_BUFFER_ROWS)'] = '64'
    $values['IntegerToString(LP_REVMA_DISCOVERY_SUMMARY_FLUSH_ROWS)'] = '16'
    $values['IntegerToString(LP_REVMA_DISCOVERY_MAX_LINE_BYTES)'] = '8192'
    $values['IntegerToString(LP_REVMA_DISCOVERY_COHORT_WAIT_SECONDS)'] = '900'
    $values['LP_REVMA_DISCOVERY_ARTIFACT_BYTE_GUARD'] = '4294967296'
    $values['DoubleToString(LP_REVMA_DISCOVERY_ATOM_LOTS,2)'] = '0.01'
    $values['DoubleToString(LP_REVMA_DISCOVERY_CELL_Q_FRACTION,2)'] = '0.10'
    $values['DoubleToString(LP_REVMA_DISCOVERY_CAPITAL_BUDGET_FRACTION,2)'] = '0.10'

    $controlledPayload = Evaluate-MqlPayload $typesText 'LP_RevmaDiscoveryControlledProfilePayload' $values
    $values['LP_RevmaDiscoveryControlledProfilePayload()'] = $controlledPayload
    $profilePayload = Evaluate-MqlPayload $typesText 'LP_RevmaDiscoveryProfileHash' $values
    $profileHash = [Gate108Hash]::Fnv1a64($profilePayload)
    $values['LP_RevmaDiscoveryProfileHash()'] = $profileHash.ToString()
    $values['LP_RevmaFormulaHash()'] = $revmaHash.ToString()
    $formulaPayload = Evaluate-MqlPayload $typesText 'LP_RevmaDiscoveryFormulaHash' $values
    $formulaHash = [Gate108Hash]::Fnv1a64($formulaPayload)

    $proof = [System.Collections.Generic.List[string]]::new()
    $proof.Add('gate=Gate108A')
    $proof.Add('status=PASS')
    $proof.Add('source_bundle_id=' + $bundleMap['bundle_id'])
    $proof.Add('source_count=57')
    $proof.Add('external_include=Trade/Trade.mqh')
    $proof.Add('input_group_metadata_count=1')
    $proof.Add('broker_compatibility_inputs=1')
    $proof.Add('strategy_inputs=0')
    $proof.Add('lifecycle_inputs=0')
    $proof.Add('capital_inputs=0')
    $proof.Add('account_size_authority=tester_account_contract')
    $proof.Add('preset_bytes=22')
    $proof.Add('preset_sha256=' + $presetHash)
    $proof.Add('profile_id=' + $values['LP_REVMA_DISCOVERY_PROFILE_ID'])
    $proof.Add('profile_hash_expected_fnv1a64=' + $profileHash)
    $proof.Add('formula_id=' + $values['LP_REVMA_DISCOVERY_FORMULA_ID'])
    $proof.Add('formula_hash_expected_fnv1a64=' + $formulaHash)
    $proof.Add('underlying_revma_formula_hash_expected_fnv1a64=' + $revmaHash)
    $proof.Add('pair_direction_formula_hash_expected_fnv1a64=' + $pairHash)
    $proof.Add('runtime_hash_parity_status=PENDING_FREEDOM_RUNTIME_EVIDENCE')

    foreach ($line in $proof) { Write-Output $line }
    if ($ProofPath -ne '') {
        if (![System.IO.Path]::IsPathRooted($ProofPath)) { $ProofPath = Join-Path $repoRoot $ProofPath }
        $ProofPath = [System.IO.Path]::GetFullPath($ProofPath)
        $protectedRoot = [System.IO.Path]::GetFullPath(
            (Join-Path $repoRoot 'automation\mt5')).TrimEnd('\', '/') +
            [System.IO.Path]::DirectorySeparatorChar
        if ($ProofPath.StartsWith($protectedRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
            $ProofPath -ieq [System.IO.Path]::GetFullPath($SourceManifestPath)) {
            throw "Proof output may not overlap active MT5 files or the source manifest: $ProofPath"
        }
        $parent = Split-Path -Parent $ProofPath
        if (!(Test-Path -LiteralPath $parent -PathType Container)) { throw "Proof parent does not exist: $parent" }
        [System.IO.File]::WriteAllLines($ProofPath, [string[]]$proof, $utf8NoBom)
    }
} finally {
    if ($deleteManifest -and (Test-Path -LiteralPath $SourceManifestPath)) {
        Remove-Item -LiteralPath $SourceManifestPath -Force
    }
}
