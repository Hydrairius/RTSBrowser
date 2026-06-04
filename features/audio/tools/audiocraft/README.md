# AudioCraft asset generator

Generate real SFX and music for the v0 manifest using [Meta AudioCraft](https://github.com/facebookresearch/audiocraft):

- **AudioGen** (`facebook/audiogen-medium`) — UI, build, deploy, stings
- **MusicGen** (`facebook/musicgen-small`) — menu + match loops

Prompts live in [`prompts.json`](prompts.json). Outputs overwrite files under `packages/client/public/audio/` per [`sfx-manifest.json`](../../data/sfx-manifest.json).

## Requirements

| Requirement | Notes |
|-------------|--------|
| Python 3.9+ | You have 3.9.13 ✓ |
| NVIDIA GPU | **16 GB VRAM** recommended for AudioGen medium; MusicGen small works on less |
| ffmpeg | Optional for some AudioCraft internals; `generate.py` writes WAV via torchaudio |
| Disk | ~5–8 GB for model weights (first run downloads from Hugging Face) |

CPU fallback exists (`--device cpu`) but is very slow.

## One-time setup (Windows)

From repo root:

```powershell
cd features/audio/tools/audiocraft
.\setup.ps1
```

This creates `.venv`, installs PyTorch (CUDA 12.1 wheels) and `audiocraft`.

## Generate clips

```powershell
cd features/audio/tools/audiocraft
.\.venv\Scripts\Activate.ps1

# List manifest + prompts
python generate.py --list

# Dry run (paths only)
python generate.py --id ui.click --dry-run

# One SFX (good first test — downloads AudioGen ~3 GB first time)
python generate.py --id ui.click

# All SFX only (faster batch before music)
python generate.py --id ui.click --id ui.open --id build.complete --id unit.deploy --id sting.victory --id sting.defeat

# Full manifest including music (~30–45 s tracks take several minutes each)
python generate.py --all
```

## Tweaking results

1. Edit the `prompt` or `duration` for a sound in `prompts.json`.
2. Re-run `python generate.py --id <sound-id>`.
3. Adjust manifest `volume` in `features/audio/data/sfx-manifest.json` if a clip is too loud/quiet.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `CUDA unavailable` | Update GPU drivers; or `--device cpu` |
| Out of memory | Close other GPU apps; generate one clip at a time; music uses `musicgen-small` already |
| `ffmpeg` not found | Optional — output uses torchaudio. Install ffmpeg if other AudioCraft tools fail |
| Hugging Face download fails | `huggingface-cli login` if rate-limited; check network |
| Clip sounds wrong | Refine prompt; shorten `duration` for SFX |

## License

AudioCraft and the pretrained weights have their own licenses (research/non-commercial constraints may apply). Review [AudioGen](https://huggingface.co/facebook/audiogen-medium) and [MusicGen](https://huggingface.co/facebook/musicgen-small) model cards before shipping commercially.
