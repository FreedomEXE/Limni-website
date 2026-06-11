# List all available TTS voices
Add-Type -AssemblyName System.Speech
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer

Write-Host "`nAvailable TTS Voices:" -ForegroundColor Cyan
Write-Host "=" * 60

$voices = $synthesizer.GetInstalledVoices()
foreach ($voice in $voices) {
    $info = $voice.VoiceInfo
    Write-Host "`nName: $($info.Name)" -ForegroundColor Yellow
    Write-Host "Gender: $($info.Gender)"
    Write-Host "Age: $($info.Age)"
    Write-Host "Culture: $($info.Culture.DisplayName)"
    Write-Host "Enabled: $($voice.Enabled)"
}

$synthesizer.Dispose()
