param(
    [string]$AudioPath = "",
    [string]$Text = "",
    [int]$FallbackSeconds = 20
)

function Invoke-SapiFallback {
    param([string]$FallbackText)

    if ([string]::IsNullOrWhiteSpace($FallbackText)) {
        return
    }

    try {
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $synth.Volume = 100
        $synth.Rate = 0
        $synth.Speak($FallbackText)
        $synth.Dispose()
    } catch {
        # Last-resort worker: keep failures non-fatal for the calling agent.
    }
}

try {
    if (-not [string]::IsNullOrWhiteSpace($AudioPath) -and (Test-Path -LiteralPath $AudioPath)) {
        try {
            Add-Type -AssemblyName PresentationCore
            $mediaPlayer = New-Object System.Windows.Media.MediaPlayer
            $absolutePath = (Resolve-Path -LiteralPath $AudioPath).Path
            $mediaPlayer.Open([Uri]::new($absolutePath))

            for ($i = 0; $i -lt 50 -and -not $mediaPlayer.NaturalDuration.HasTimeSpan; $i++) {
                Start-Sleep -Milliseconds 100
            }

            $mediaPlayer.Play()

            if ($mediaPlayer.NaturalDuration.HasTimeSpan) {
                $duration = $mediaPlayer.NaturalDuration.TimeSpan
                $deadline = (Get-Date).AddSeconds([Math]::Max(8, [Math]::Ceiling($duration.TotalSeconds) + 3))
                while ((Get-Date) -lt $deadline) {
                    Start-Sleep -Milliseconds 250
                    if ($mediaPlayer.Position -ge ($duration - [TimeSpan]::FromMilliseconds(150))) {
                        Start-Sleep -Milliseconds 750
                        break
                    }
                }
            } else {
                Start-Sleep -Seconds ([Math]::Max(8, $FallbackSeconds))
            }

            $mediaPlayer.Stop()
            $mediaPlayer.Close()
        } catch {
            Invoke-SapiFallback -FallbackText $Text
        }
    } else {
        Invoke-SapiFallback -FallbackText $Text
    }
} finally {
    if (-not [string]::IsNullOrWhiteSpace($AudioPath) -and (Test-Path -LiteralPath $AudioPath)) {
        Start-Sleep -Milliseconds 500
        Remove-Item -LiteralPath $AudioPath -ErrorAction SilentlyContinue
    }
}
