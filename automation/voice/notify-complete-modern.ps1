# Task Completion Notification with Modern Neural TTS (edge-tts)
param(
    [string]$Message = "Task completed",
    [string]$Voice = "en-GB-RyanNeural",  # Codex default. Options: RyanNeural, LibbyNeural, MaisieNeural, SoniaNeural
    [ValidateSet("Codex", "Freedom", "System")]
    [string]$Speaker = "Codex",
    [switch]$NoGreeting
)

if ($NoGreeting) {
    $fullMessage = "$Speaker summary. $Message"
} else {
    # Random greeting selection
    $greetings = @(
        "Hello Freedom",
        "Hey Freedom",
        "Hi Freedom",
        "Greetings Freedom",
        "What's up Freedom"
    )
    $greeting = $greetings | Get-Random
    $fullMessage = "$greeting. $Message"
}

Write-Host "[Voice] Using modern neural voice: $Voice" -ForegroundColor Cyan
Write-Host "[Speaking] $fullMessage" -ForegroundColor Green

# Generate temp audio file
$tempAudio = [System.IO.Path]::GetTempFileName() -replace '\.tmp$', '.mp3'
$playbackStarted = $false

function Start-DetachedVoiceWorker {
    param(
        [string]$AudioPath = "",
        [string]$Text = "",
        [int]$FallbackSeconds = 20
    )

    $worker = Join-Path $scriptDir "voice-playback-worker.ps1"
    $escapedWorker = $worker.Replace("'", "''")
    $escapedAudio = $AudioPath.Replace("'", "''")
    $escapedText = $Text.Replace("'", "''")
    $command = "& '$escapedWorker' -AudioPath '$escapedAudio' -Text '$escapedText' -FallbackSeconds $FallbackSeconds"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
    Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-STA", "-EncodedCommand", $encoded) -WindowStyle Hidden | Out-Null
}

function Invoke-EdgeTts {
    param(
        [string]$ScriptPath,
        [string]$VoiceName,
        [string]$Text,
        [string]$OutputPath,
        [int]$TimeoutSeconds = 8
    )

    $job = Start-Job -ScriptBlock {
        param($PythonScript, $VoiceName, $Text, $OutputPath)
        $output = & python $PythonScript $VoiceName $Text $OutputPath 2>&1
        [pscustomobject]@{
            ExitCode = $LASTEXITCODE
            Output = (($output | Out-String).Trim())
        }
    } -ArgumentList $ScriptPath, $VoiceName, $Text, $OutputPath

    try {
        if (-not (Wait-Job -Job $job -Timeout $TimeoutSeconds)) {
            Stop-Job -Job $job -ErrorAction SilentlyContinue
            throw "edge-tts timed out after $TimeoutSeconds seconds."
        }

        return Receive-Job -Job $job
    } finally {
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    }
}

try {
    # Generate speech with edge-tts (using SSL-bypass script)
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $ttsResult = Invoke-EdgeTts -ScriptPath (Join-Path $scriptDir "edge-tts-fix.py") -VoiceName $Voice -Text $fullMessage -OutputPath $tempAudio
    $ttsOutput = $ttsResult.Output
    $ttsExitCode = [int]$ttsResult.ExitCode

    if ($ttsExitCode -ne 0 -or -not (Test-Path $tempAudio) -or (Get-Item $tempAudio).Length -le 0) {
        $errorText = "$ttsOutput".Trim()
        if ([string]::IsNullOrWhiteSpace($errorText)) {
            $errorText = "edge-tts exited with code $ttsExitCode and did not produce audio."
        }
        throw $errorText
    }

    if (Test-Path $tempAudio) {
        $fallbackSeconds = [Math]::Max(12, [Math]::Ceiling($fullMessage.Length / 8) + 6)
        Start-DetachedVoiceWorker -AudioPath $tempAudio -Text $fullMessage -FallbackSeconds $fallbackSeconds
        $playbackStarted = $true
    }
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "[INFO] Starting local Windows speech fallback." -ForegroundColor Yellow
    if (-not $scriptDir) {
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    }
    Start-DetachedVoiceWorker -Text $fullMessage -FallbackSeconds ([Math]::Max(12, [Math]::Ceiling($fullMessage.Length / 8) + 6))
    $playbackStarted = $true
} finally {
    # The detached worker owns cleanup after playback starts. Parent cleanup is
    # only for generation failures before a worker is launched.
    if (-not $playbackStarted -and (Test-Path $tempAudio)) {
        Start-Sleep -Milliseconds 500
        Remove-Item $tempAudio -ErrorAction SilentlyContinue
    }
}
