export type AudioCategory = "sfx" | "music";

export interface SoundDef {
  src: string;
  category: AudioCategory;
  volume?: number;
  loop?: boolean;
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
