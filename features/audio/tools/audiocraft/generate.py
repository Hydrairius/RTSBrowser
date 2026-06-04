#!/usr/bin/env python3
"""Generate RTSBrowser manifest clips with Meta AudioCraft (AudioGen + MusicGen)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[3]
MANIFEST_PATH = REPO_ROOT / "features" / "audio" / "data" / "sfx-manifest.json"
PROMPTS_PATH = SCRIPT_DIR / "prompts.json"
PUBLIC_AUDIO = REPO_ROOT / "packages" / "client" / "public"


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def output_path(manifest_src: str) -> Path:
    return PUBLIC_AUDIO / manifest_src.lstrip("/")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--id", action="append", dest="ids", help="Manifest sound id (repeatable)")
    parser.add_argument("--all", action="store_true", help="Generate every manifest entry")
    parser.add_argument("--list", action="store_true", help="List configured sounds")
    parser.add_argument("--dry-run", action="store_true", help="Print targets without generating")
    parser.add_argument("--device", default="cuda", choices=["cuda", "cpu"])
    parser.add_argument("--audiogen-model", default="facebook/audiogen-medium")
    parser.add_argument("--musicgen-model", default="facebook/musicgen-small")
    args = parser.parse_args()

    manifest = load_json(MANIFEST_PATH)
    prompt_root = load_json(PROMPTS_PATH)
    prompts: dict[str, dict] = prompt_root["sounds"]

    if args.list:
        for sound_id, entry in manifest["sounds"].items():
            cfg = prompts.get(sound_id, {})
            engine = cfg.get("engine", "?")
            snippet = cfg.get("prompt", "(no prompt)")[:72]
            print(f"{sound_id:16} {engine:8} {snippet}")
        return 0

    target_ids = list(manifest["sounds"].keys()) if args.all else (args.ids or [])
    if not target_ids:
        parser.error("Pass --id <sound> and/or --all (or use --list)")

    missing = [sound_id for sound_id in target_ids if sound_id not in prompts]
    if missing:
        print(f"Missing prompts for: {', '.join(missing)}", file=sys.stderr)
        return 1

    if args.dry_run:
        for sound_id in target_ids:
            src = manifest["sounds"][sound_id]["src"]
            cfg = prompts[sound_id]
            print(
                f"[dry-run] {sound_id} ({cfg['engine']}, {cfg.get('duration', 2)}s)\n"
                f"          -> {output_path(src)}"
            )
        return 0

    import torch
    from audiocraft.models import AudioGen, MusicGen

    if args.device == "cuda" and not torch.cuda.is_available():
        print("CUDA unavailable. Re-run with --device cpu (very slow).", file=sys.stderr)
        return 1

    audiogen: AudioGen | None = None
    musicgen_cache: dict[str, MusicGen] = {}

    def get_audiogen() -> AudioGen:
        nonlocal audiogen
        if audiogen is None:
            print(f"Loading {args.audiogen_model} on {args.device}...")
            audiogen = AudioGen.get_pretrained(args.audiogen_model, device=args.device)
        return audiogen

    def get_musicgen(model_name: str) -> MusicGen:
        if model_name not in musicgen_cache:
            print(f"Loading {model_name} on {args.device}...")
            musicgen_cache[model_name] = MusicGen.get_pretrained(model_name, device=args.device)
        return musicgen_cache[model_name]

    for sound_id in target_ids:
        cfg = prompts[sound_id]
        dest = output_path(manifest["sounds"][sound_id]["src"])
        duration = float(cfg.get("duration", 2))
        prompt = cfg["prompt"]
        engine = cfg["engine"]

        print(f"\n=== {sound_id} ({engine}, {duration}s) ===")
        print(f"Prompt: {prompt}")
        print(f"Output: {dest}")

        if engine == "audiogen":
            model = get_audiogen()
            model.set_generation_params(duration=duration)
            wav = model.generate([prompt])
        elif engine == "musicgen":
            model_name = cfg.get("model", args.musicgen_model)
            model = get_musicgen(model_name)
            model.set_generation_params(duration=duration)
            wav = model.generate([prompt])
        else:
            print(f"Unknown engine: {engine}", file=sys.stderr)
            return 1

        clip = wav[0].cpu()
        dest.parent.mkdir(parents=True, exist_ok=True)
        save_wav(dest, clip, model.sample_rate)
        print(f"Saved {dest}")

    print("\nDone. Reload the game to hear new clips.")
    return 0


def save_wav(dest: Path, tensor, sample_rate: int) -> None:
    """Write WAV without requiring ffmpeg on PATH."""
    import torch
    import torchaudio

    audio = tensor.detach().cpu()
    if audio.dim() == 1:
        audio = audio.unsqueeze(0)
    torchaudio.save(str(dest), audio, sample_rate)


if __name__ == "__main__":
    raise SystemExit(main())
