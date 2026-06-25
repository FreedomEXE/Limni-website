#!/usr/bin/env python3
"""
Edge TTS with SSL verification disabled (workaround for expired cert)
"""
import asyncio
import sys
import ssl
import edge_tts
import aiohttp

async def main():
    if len(sys.argv) < 4:
        print("Usage: python edge-tts-no-ssl.py <voice> <text> <output_file>")
        sys.exit(1)

    voice = sys.argv[1]
    text = sys.argv[2]
    output_file = sys.argv[3]

    # Create SSL context that doesn't verify certificates
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    # Create aiohttp connector with custom SSL context
    connector = aiohttp.TCPConnector(ssl=ssl_context)

    # Create aiohttp session with custom connector
    async with aiohttp.ClientSession(connector=connector) as session:
        # Monkey patch the edge_tts module to use our session
        communicate = edge_tts.Communicate(text, voice)

        # Override the session
        communicate._session = session

        # Save to file
        await communicate.save(output_file)

if __name__ == "__main__":
    asyncio.run(main())
