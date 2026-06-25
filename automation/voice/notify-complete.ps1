# Task Completion Notification with TTS
param(
    [string]$Message = "Task completed"
)

# Play system sound
[System.Media.SystemSounds]::Asterisk.Play()

# Text-to-speech
Add-Type -AssemblyName System.Speech
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer

# Try to select female British voice first, fall back to female US voice
$voices = $synthesizer.GetInstalledVoices() | Where-Object { $_.Enabled }
$britishFemale = $voices | Where-Object {
    $_.VoiceInfo.Culture.Name -like "en-GB" -and $_.VoiceInfo.Gender -eq "Female"
} | Select-Object -First 1

$usFemale = $voices | Where-Object {
    $_.VoiceInfo.Culture.Name -like "en-US" -and $_.VoiceInfo.Gender -eq "Female"
} | Select-Object -First 1

if ($britishFemale) {
    $synthesizer.SelectVoice($britishFemale.VoiceInfo.Name)
    Write-Host "[Voice] Using British female voice: $($britishFemale.VoiceInfo.Name)" -ForegroundColor Green
} elseif ($usFemale) {
    $synthesizer.SelectVoice($usFemale.VoiceInfo.Name)
    Write-Host "[Voice] Using US female voice: $($usFemale.VoiceInfo.Name) (Install British voice for accent)" -ForegroundColor Yellow
} else {
    $synthesizer.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female)
}

# Make voice more appealing: slightly slower, fuller volume
$synthesizer.Rate = -1      # -10 to 10 (negative = slower, more sultry)
$synthesizer.Volume = 100   # 0 to 100

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

# Speak the message
Write-Host "[Speaking] $fullMessage" -ForegroundColor Cyan
$synthesizer.Speak($fullMessage)

# Cleanup
$synthesizer.Dispose()
