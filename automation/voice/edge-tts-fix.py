#!/usr/bin/env python3
"""
Edge TTS with SSL verification bypass
This modifies the edge_tts library at runtime to skip SSL verification
"""
import asyncio
import sys
import ssl

# Monkey patch SSL to disable verification BEFORE importing edge_tts
_old_create_default_context = ssl.create_default_context

def _create_unverified_context(*args, **kwargs):
    context = _old_create_default_context(*args, **kwargs)
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context

ssl.create_default_context = _create_unverified_context

# NOW import edge_tts
import edge_tts

async def main():
    if len(sys.argv) < 4:
        print("Usage: python edge-tts-fix.py <voice> <text> <output_file>")
        sys.exit(1)

    voice = sys.argv[1]
    text = sys.argv[2]
    output_file = sys.argv[3]

    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_file)
    print(f"Audio saved to {output_file}")

if __name__ == "__main__":
    asyncio.run(main())
