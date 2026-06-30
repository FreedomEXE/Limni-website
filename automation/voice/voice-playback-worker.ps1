param(
    [string]$AudioPath = "",
    [string]$Text = "",
    [string]$Voice = "en-GB-RyanNeural",
    [string]$TtsScript = "",
    [int]$TtsTimeoutSeconds = 90,
    [int]$Retries = 2
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$voiceDir = Join-Path $env:TEMP "limni-voice"
$logPath = Join-Path $voiceDir "voice-worker.log"

New-Item -ItemType Directory -Force -Path $voiceDir | Out-Null

function Write-VoiceLog {
    param([string]$Line)

    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logPath -Value "[$stamp] $Line" -Encoding UTF8
}

function New-NeuralAudio {
    param(
        [string]$VoiceName,
        [string]$MessageText
    )

    if (-not [string]::IsNullOrWhiteSpace($AudioPath) -and (Test-Path -LiteralPath $AudioPath)) {
        return (Resolve-Path -LiteralPath $AudioPath).Path
    }

    if ([string]::IsNullOrWhiteSpace($MessageText)) {
        throw "No voice text was supplied."
    }

    $scriptPath = $TtsScript
    if ([string]::IsNullOrWhiteSpace($scriptPath)) {
        $scriptPath = Join-Path $scriptDir "edge-tts-fix.py"
    }
    if (-not (Test-Path -LiteralPath $scriptPath)) {
        throw "Edge TTS script not found: $scriptPath"
    }

    $outputPath = Join-Path $voiceDir ("voice-" + [guid]::NewGuid().ToString() + ".mp3")
    $maxAttempts = [Math]::Max(1, $Retries + 1)

    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        $job = Start-Job -ScriptBlock {
            param($PythonScript, $VoiceName, $MessageText, $OutputPath)
            $output = & python $PythonScript $VoiceName $MessageText $OutputPath 2>&1
            [pscustomobject]@{
                ExitCode = $LASTEXITCODE
                Output = (($output | Out-String).Trim())
            }
        } -ArgumentList $scriptPath, $VoiceName, $MessageText, $outputPath

        try {
            if (-not (Wait-Job -Job $job -Timeout $TtsTimeoutSeconds)) {
                Stop-Job -Job $job -ErrorAction SilentlyContinue
                Write-VoiceLog "edge-tts attempt $attempt timed out after $TtsTimeoutSeconds seconds."
                continue
            }

            $result = Receive-Job -Job $job
            if ($result.ExitCode -eq 0 -and (Test-Path -LiteralPath $outputPath) -and (Get-Item -LiteralPath $outputPath).Length -gt 0) {
                Write-VoiceLog "edge-tts generated Ryan audio on attempt ${attempt}: $outputPath"
                return $outputPath
            }

            Write-VoiceLog "edge-tts attempt $attempt failed with exit $($result.ExitCode): $($result.Output)"
        } finally {
            Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
        }
    }

    throw "Edge TTS failed after $maxAttempts attempt(s). See $logPath."
}

function Play-AudioFile {
    param([string]$Path)

    Add-Type -AssemblyName PresentationCore
    $mediaPlayer = New-Object System.Windows.Media.MediaPlayer
    $absolutePath = (Resolve-Path -LiteralPath $Path).Path
    $mediaPlayer.Open([Uri]::new($absolutePath))

    for ($i = 0; $i -lt 100 -and -not $mediaPlayer.NaturalDuration.HasTimeSpan; $i++) {
        Start-Sleep -Milliseconds 100
    }

    $mediaPlayer.Play()

    if ($mediaPlayer.NaturalDuration.HasTimeSpan) {
        $duration = $mediaPlayer.NaturalDuration.TimeSpan
        $deadline = (Get-Date).AddSeconds([Math]::Max(12, [Math]::Ceiling($duration.TotalSeconds) + 4))
        while ((Get-Date) -lt $deadline) {
            Start-Sleep -Milliseconds 250
            if ($mediaPlayer.Position -ge ($duration - [TimeSpan]::FromMilliseconds(150))) {
                Start-Sleep -Milliseconds 750
                break
            }
        }
    } else {
        $waitSeconds = [Math]::Max(12, [Math]::Ceiling($Text.Length / 8) + 8)
        Start-Sleep -Seconds $waitSeconds
    }

    $mediaPlayer.Stop()
    $mediaPlayer.Close()
}

$mutex = New-Object System.Threading.Mutex($false, "LimniRyanNeuralVoiceQueue")
$hasLock = $false
$generatedAudio = $null

try {
    $hasLock = $mutex.WaitOne([TimeSpan]::FromMinutes(5))
    if (-not $hasLock) {
        throw "Timed out waiting for the Limni voice queue."
    }

    $generatedAudio = New-NeuralAudio -VoiceName $Voice -MessageText $Text
    Play-AudioFile -Path $generatedAudio
} catch {
    Write-VoiceLog "voice worker error: $($_.Exception.Message)"
} finally {
    if ($hasLock) {
        $mutex.ReleaseMutex()
    }
    $mutex.Dispose()

    if (-not [string]::IsNullOrWhiteSpace($generatedAudio) -and (Test-Path -LiteralPath $generatedAudio)) {
        Start-Sleep -Milliseconds 500
        Remove-Item -LiteralPath $generatedAudio -ErrorAction SilentlyContinue
    }
}
