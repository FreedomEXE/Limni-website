# Test basic Windows TTS
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Speak("Hello Freedom, can you hear me now?")
