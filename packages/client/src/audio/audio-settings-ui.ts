import { audio } from "./audio-service.js";
import { el } from "../ui/dom.js";

export interface AudioSettingsUiOptions {
  showTitle?: boolean;
  showValues?: boolean;
}

export function mountAudioSettings(
  host: HTMLElement,
  options: AudioSettingsUiOptions = {},
): void {
  const { showTitle = true, showValues = false } = options;
  const settings = audio.getSettings();
  const section = el("div", "audio-settings");

  if (showTitle) {
    section.append(el("h4", "audio-settings-title", ["Audio"]));
  }

  const master = createSlider("Master", settings.master, showValues, (v) => {
    audio.setSettings({ master: v });
  });
  const effects = createSlider("Effects", settings.sfx, showValues, (v) => {
    audio.setSettings({ sfx: v });
  });
  const music = createSlider("Music", settings.music, showValues, (v) => {
    audio.setSettings({ music: v });
  });

  section.append(master.row, effects.row, music.row);
  host.append(section);
}

function createSlider(
  label: string,
  initial: number,
  showValue: boolean,
  onChange: (value: number) => void,
): { row: HTMLElement } {
  const row = el("label", "audio-settings-row");
  const name = el("span", "audio-settings-label", [label]);
  const input = el("input", "audio-settings-slider") as HTMLInputElement;
  input.type = "range";
  input.min = "0";
  input.max = "100";
  input.value = String(Math.round(initial * 100));
  input.setAttribute("aria-valuenow", input.value);
  input.setAttribute("aria-valuemin", "0");
  input.setAttribute("aria-valuemax", "100");

  const value = el("span", "audio-settings-value", [`${input.value}%`]);
  if (!showValue) value.hidden = true;

  const sync = () => {
    const pct = Number(input.value);
    input.setAttribute("aria-valuenow", String(pct));
    if (showValue) value.textContent = `${pct}%`;
    onChange(pct / 100);
  };

  input.oninput = sync;
  row.append(name, input);
  if (showValue) row.append(value);
  return { row };
}