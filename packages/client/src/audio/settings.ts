import {
  AUDIO_SETTINGS_KEY,
  DEFAULT_AUDIO_SETTINGS,
  type AudioSettings,
} from "./types.js";

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      master: clamp01(parsed.master ?? DEFAULT_AUDIO_SETTINGS.master),
      sfx: clamp01(parsed.sfx ?? DEFAULT_AUDIO_SETTINGS.sfx),
      music: clamp01(parsed.music ?? DEFAULT_AUDIO_SETTINGS.music),
      muted: parsed.muted ?? DEFAULT_AUDIO_SETTINGS.muted,
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(settings: AudioSettings): void {
  localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
