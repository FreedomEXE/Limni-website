# Response Notification with Modern Neural TTS (edge-tts)
param(
    [string]$Message = "Response ready",
    [string]$Voice = "en-GB-RyanNeural",
    [ValidateSet("Codex", "Freedom", "System")]
    [string]$Speaker = "Codex",
    [switch]$NoGreeting
)

if ($NoGreeting) {
    $fullMessage = "$Speaker summary. $Message"
} else {
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

Write-Host "[Voice] Queuing neural voice: $Voice" -ForegroundColor Cyan
Write-Host "[Speaking] $fullMessage" -ForegroundColor Green

$scriptDir = (Resolve-Path -LiteralPath (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path
$worker = (Resolve-Path -LiteralPath (Join-Path $scriptDir "voice-playback-worker.ps1")).Path

$escapedWorker = $worker.Replace("'", "''")
$escapedVoice = $Voice.Replace("'", "''")
$escapedText = $fullMessage.Replace("'", "''")
$command = "& '$escapedWorker' -Voice '$escapedVoice' -Text '$escapedText'"
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))

Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-STA", "-EncodedCommand", $encoded) `
    -WorkingDirectory $scriptDir `
    -WindowStyle Hidden | Out-Null
