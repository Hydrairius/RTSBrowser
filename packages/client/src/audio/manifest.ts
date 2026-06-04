import manifestJson from "../../../../features/audio/data/sfx-manifest.json";
import type { AudioManifest, SoundDef } from "./types.js";

export const AUDIO_MANIFEST = manifestJson as AudioManifest;

export function soundDef(id: string): SoundDef | undefined {
  return AUDIO_MANIFEST.sounds[id];
}

export function allSoundIds(): string[] {
  return Object.keys(AUDIO_MANIFEST.sounds);
}
