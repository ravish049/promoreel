"""Chatterbox TTS (Resemble AI, MIT) for promoreel's voice step: renders lines given as JSON on stdin, one WAV each.

    tools/chatterbox-venv/bin/python cli/voice/tts_chatterbox.py < jobs.json

jobs.json: {"exaggeration": 0.5, "cfg_weight": 0.5, "jobs": [{"id": "hook", "text": "...", "out": "/abs/hook.wav", "seed": 7}]}
Each WAV is 24 kHz mono 16-bit, its silence trimmed (keeping a short tail) and peak-normalised to -1 dBFS, like Kokoro's.
Prints one JSON line per finished line ({"done": id, "ms": n}) and, last, {"result": {id: ms, ...}}.
Chatterbox embeds Resemble's imperceptible PerTh watermark in its audio.
Set up once: bash scripts/install-chatterbox.sh
"""
import json
import sys
import warnings

warnings.filterwarnings("ignore")

import torch  # noqa: E402
import torchaudio as ta  # noqa: E402
from chatterbox.tts import ChatterboxTTS  # noqa: E402

SR_OUT = 24000


def trim(w, sr, threshold=0.004, pad_ms=40):
    a = w.abs()
    idx = (a > threshold).nonzero()
    if len(idx) == 0:
        return w
    pad = int(sr * pad_ms / 1000)
    s = max(0, int(idx[0]) - pad)
    e = min(len(w), int(idx[-1]) + pad * 2)
    return w[s:e]


def device():
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def main():
    req = json.load(sys.stdin)
    model = ChatterboxTTS.from_pretrained(device=device())
    out = {}
    for job in req["jobs"]:
        torch.manual_seed(int(job.get("seed", 7)))
        wav = model.generate(job["text"], exaggeration=float(req.get("exaggeration", 0.5)), cfg_weight=float(req.get("cfg_weight", 0.5)))
        w = wav.squeeze(0).float().cpu()
        if model.sr != SR_OUT:
            w = ta.functional.resample(w, model.sr, SR_OUT)
        w = trim(w, SR_OUT)
        peak = float(w.abs().max()) or 1.0
        w = w * (0.89 / peak)
        ta.save(job["out"], w.unsqueeze(0), SR_OUT, encoding="PCM_S", bits_per_sample=16)
        out[job["id"]] = round(len(w) / SR_OUT * 1000)
        print(json.dumps({"done": job["id"], "ms": out[job["id"]]}), flush=True)
    print(json.dumps({"result": out}), flush=True)


if __name__ == "__main__":
    main()
