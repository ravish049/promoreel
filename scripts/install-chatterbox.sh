#!/usr/bin/env bash
# Installs Chatterbox (Resemble AI, MIT), promoreel's optional "more natural" voice, into tools/chatterbox-venv.
# Needs Python 3.11 (uv fetches one if missing). About 2 GB with PyTorch and the model weights, which download from
# Hugging Face on the first `promoreel voice`. Runs on the Apple GPU (MPS), an NVIDIA GPU (CUDA), or the CPU (slow).
#
# Its audio carries Resemble's imperceptible PerTh watermark, which marks it as AI-generated. That is by design and
# fine for a promo; say so if a platform asks whether a video uses AI voice.
set -euo pipefail
cd "$(dirname "$0")/.."
VENV=tools/chatterbox-venv
if command -v uv >/dev/null 2>&1; then
  uv venv -p 3.11 "$VENV"
  # setuptools<81: Chatterbox's watermarker still imports pkg_resources
  VIRTUAL_ENV="$VENV" uv pip install chatterbox-tts "setuptools<81"
else
  PY=$(command -v python3.11 || true)
  if [ -z "$PY" ]; then
    echo "Need Python 3.11 or uv (https://docs.astral.sh/uv/). macOS: brew install uv" >&2
    exit 1
  fi
  "$PY" -m venv "$VENV"
  "$VENV/bin/pip" install --upgrade pip
  "$VENV/bin/pip" install chatterbox-tts "setuptools<81"
fi
"$VENV/bin/python" -c "import chatterbox, torch; print('chatterbox ok · torch', torch.__version__, '· mps' if torch.backends.mps.is_available() else '· cuda' if torch.cuda.is_available() else '· cpu')"
echo "Done. Use it with \"voice\": { \"use\": \"chatterbox\" } in a reel spec."
