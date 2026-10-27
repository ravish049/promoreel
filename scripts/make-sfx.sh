#!/usr/bin/env bash
# The template's only sound effect, synthesised here (nothing downloaded): a soft, short tap → assets/sfx/tap.wav.
# The CLI copies it into each project's public/sfx/.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/sfx
# a 1.9 kHz tick plus a low thump, both decaying in ~40 ms
ffmpeg -y -loglevel error \
  -f lavfi -i "sine=frequency=1900:sample_rate=48000:duration=0.05" \
  -f lavfi -i "sine=frequency=180:sample_rate=48000:duration=0.06" \
  -filter_complex "[0]volume=0.35,afade=t=out:st=0.004:d=0.04:curve=exp[a];[1]volume=0.8,afade=t=out:st=0.0:d=0.05:curve=exp[b];[a][b]amix=inputs=2:normalize=0,afade=t=in:d=0.002,alimiter=limit=0.7" \
  -ac 1 assets/sfx/tap.wav
echo assets/sfx/tap.wav
