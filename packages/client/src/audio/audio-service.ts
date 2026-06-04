import { Howl, Howler } from "howler";
import { allSoundIds, soundDef } from "./manifest.js";
import { resolvePublicUrl } from "./public-url.js";
import { loadAudioSettings, saveAudioSettings } from "./settings.js";
import type { AudioSettings, SoundDef } from "./types.js";

const MUSIC_FADE_MS = 600;
const MUSIC_IDS = new Set(["music.landing", "music.menu", "music.match"]);

class AudioService {
  private howls = new Map<string, Howl>();
  private musicHowl: Howl | null = null;
  private musicId: string | null = null;
  private unlocked = false;
  private settings: AudioSettings = loadAudioSettings();
  private preloadPromise: Promise<void> | null = null;

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  setSettings(partial: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...partial };
    saveAudioSettings(this.settings);
    Howler.mute(this.settings.muted);
    this.applyMusicVolume();
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    if (Howler.ctx && Howler.ctx.state === "suspended") {
      await Howler.ctx.resume();
    }
    this.unlocked = true;
    Howler.mute(this.settings.muted);
  }

  preload(onProgress?: (pct: number) => void): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise;

    const ids = allSoundIds();
    if (ids.length === 0) {
      onProgress?.(100);
      return Promise.resolve();
    }

    let loaded = 0;
    const report = () => {
      loaded += 1;
      onProgress?.(Math.round((loaded / ids.length) * 100));
    };

    this.preloadPromise = new Promise((resolve) => {
      let settled = 0;

      const finishOne = () => {
        settled += 1;
        if (settled >= ids.length) resolve();
      };

      for (const id of ids) {
        const def = soundDef(id);
        if (!def) {
          report();
          finishOne();
          continue;
        }

        if (this.howls.has(id)) {
          report();
          finishOne();
          continue;
        }

        const howl = this.createHowl(id, def, () => {
          report();
          finishOne();
        });
        this.howls.set(id, howl);
      }
    });

    return this.preloadPromise;
  }

  play(id: string, opts?: { volume?: number }): void {
    if (!this.unlocked || this.settings.muted) return;
    const howl = this.howls.get(id) ?? this.lazyHowl(id);
    if (!howl) return;

    const vol = this.effectiveVolume(id, opts?.volume);
    howl.volume(vol);
    howl.play();
  }

  playMusic(id: string): void {
    if (!MUSIC_IDS.has(id)) return;
    if (!this.unlocked || this.settings.muted) return;
    if (this.musicId === id && this.musicHowl?.playing()) return;

    const howl = this.howls.get(id) ?? this.lazyHowl(id);
    if (!howl) return;

    const previous = this.musicHowl;
    this.musicHowl = howl;
    this.musicId = id;

    howl.loop(true);
    const target = this.effectiveVolume(id);
    if (!howl.playing()) {
      howl.volume(0);
      howl.play();
    }
    howl.fade(howl.volume(), target, MUSIC_FADE_MS);

    if (previous && previous !== howl) {
      const from = previous.volume();
      previous.fade(from, 0, MUSIC_FADE_MS);
      window.setTimeout(() => {
        if (this.musicHowl !== previous) {
          previous.stop();
        }
      }, MUSIC_FADE_MS + 50);
    }
  }

  stopMusic(): void {
    const current = this.musicHowl;
    if (!current) return;

    this.musicHowl = null;
    this.musicId = null;

    const from = current.volume();
    current.fade(from, 0, MUSIC_FADE_MS);
    window.setTimeout(() => current.stop(), MUSIC_FADE_MS + 50);
  }

  private lazyHowl(id: string): Howl | null {
    const def = soundDef(id);
    if (!def) return null;
    const howl = this.createHowl(id, def);
    this.howls.set(id, howl);
    return howl;
  }

  private createHowl(id: string, def: SoundDef, onReady?: () => void): Howl {
    return new Howl({
      src: [resolvePublicUrl(def.src)],
      preload: true,
      loop: def.loop ?? false,
      volume: this.effectiveVolume(id, def.volume),
      onload: onReady,
      onloaderror: (_id, err) => {
        console.warn(`[audio] failed to load ${id}:`, err);
        onReady?.();
      },
    });
  }

  private applyMusicVolume(): void {
    if (!this.musicHowl || !this.musicId) return;
    this.musicHowl.volume(this.effectiveVolume(this.musicId));
  }

  private effectiveVolume(id: string, clipVolume = 1): number {
    const def = soundDef(id);
    const category = def?.category ?? "sfx";
    const bus = category === "music" ? this.settings.music : this.settings.sfx;
    const base = (def?.volume ?? 1) * clipVolume;
    return this.settings.master * bus * base;
  }
}

export const audio = new AudioService();

/** Unlock audio (if needed) and play the standard UI click. */
export function playUiClick(): void {
  void audio.unlock();
  audio.play("ui.click");
}

/** Wrap a handler so the first interaction unlocks audio and plays a click. */
export function withUiClick(handler: () => void): () => void {
  return () => {
    playUiClick();
    handler();
  };
}
