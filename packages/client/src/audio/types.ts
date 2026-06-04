export type AudioCategory = "sfx" | "music";

export interface SoundDef {
  src: string;
  category: AudioCategory;
  volume?: number;
  loop?: boolean;
  /** Random per-playback gain trim, e.g. 0.08 means +/-8%. */
  volumeVariance?: number;
  /** Random playback-rate trim, e.g. 0.06 means +/-6%. */
  rateVariance?: number;
  /** Minimum milliseconds between accepted playbacks for repeated one-shots. */
  cooldownMs?: number;
  /** Maximum simultaneously playing instances for this sound id. */
  maxInstances?: number;
}

export interface AudioManifest {
  schemaVersion: number;
  sounds: Record<string, SoundDef>;
}

export interface AudioSettings {
  master: number;
  sfx: number;
  music: number;
  muted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 0.85,
  sfx: 0.9,
  music: 0.7,
  muted: false,
};

export const AUDIO_SETTINGS_KEY = "rtsbrowser:audio-settings";
