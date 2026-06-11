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

try {
    # Generate speech with edge-tts (using SSL-bypass script)
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    python "$scriptDir/edge-tts-fix.py" $Voice $fullMessage $tempAudio 2>&1 | Out-Null

    if (Test-Path $tempAudio) {
        # Play audio (Windows Media Player)
        Add-Type -AssemblyName presentationCore
        $mediaPlayer = New-Object System.Windows.Media.MediaPlayer

        # Convert to absolute path for URI
        $absolutePath = (Resolve-Path $tempAudio).Path
        $mediaPlayer.Open([uri]$absolutePath)

        # MediaPlayer opens files asynchronously. Wait briefly so duration and
        # playback are ready before starting; otherwise short greetings can play
        # and the process may stop before the rest of the message is heard.
        for ($i = 0; $i -lt 30 -and -not $mediaPlayer.NaturalDuration.HasTimeSpan; $i++) {
            Start-Sleep -Milliseconds 100
        }

        $mediaPlayer.Play()

        if ($mediaPlayer.NaturalDuration.HasTimeSpan) {
            $actualSeconds = [Math]::Ceiling($mediaPlayer.NaturalDuration.TimeSpan.TotalSeconds)
        } else {
            # Conservative fallback for neural TTS pace when metadata is unavailable.
            $actualSeconds = [Math]::Ceiling($fullMessage.Length / 8)
        }

        # Add a larger buffer so async playback never gets cut off mid-message.
        $waitDuration = [Math]::Max(12, $actualSeconds + 10)
        Start-Sleep -Seconds $waitDuration

        $mediaPlayer.Stop()
        $mediaPlayer.Close()

        # Play system sound after speech
        [System.Media.SystemSounds]::Asterisk.Play()
    } else {
        Write-Host "[ERROR] Failed to generate speech" -ForegroundColor Red
        # Fallback to system beep
        [console]::beep(800, 300)
    }
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "[INFO] Make sure Python and edge-tts are installed. Run: .\scripts\setup-modern-voice.ps1" -ForegroundColor Yellow
    [console]::beep(800, 300)
} finally {
    # Cleanup
    if (Test-Path $tempAudio) {
        Start-Sleep -Milliseconds 500
        Remove-Item $tempAudio -ErrorAction SilentlyContinue
    }
}
