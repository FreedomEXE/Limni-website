# Response Notification with Modern Neural TTS (edge-tts)
param(
    [string]$Message = "Response ready",
    [string]$Voice = "en-GB-LibbyNeural"  # Options: LibbyNeural, MaisieNeural, SoniaNeural
)

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
        $mediaPlayer.Play()

        # Get actual MP3 duration using Shell COM object (no dependencies)
        $shell = New-Object -ComObject Shell.Application
        $folder = $shell.Namespace((Split-Path $absolutePath))
        $file = $folder.ParseName((Split-Path $absolutePath -Leaf))
        $durationStr = $folder.GetDetailsOf($file, 27)  # Property 27 = Duration

        if ($durationStr -match '(\d+):(\d+):(\d+)') {
            $actualSeconds = [int]$Matches[1] * 3600 + [int]$Matches[2] * 60 + [int]$Matches[3]
        } elseif ($durationStr -match '(\d+):(\d+)') {
            $actualSeconds = [int]$Matches[1] * 60 + [int]$Matches[2]
        } else {
            # Fallback: conservative estimate at ~10 chars/sec with 50% buffer
            $actualSeconds = [Math]::Ceiling(($fullMessage.Length / 10) * 1.5)
        }

        # Add generous buffer (3 seconds) to ensure full playback
        $waitDuration = [Math]::Max(5, $actualSeconds + 3)
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
