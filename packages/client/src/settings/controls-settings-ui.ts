import controlsCatalog from "../../../../features/ui-hud/data/controls-v0.json";
import { el } from "../ui/dom.js";

interface ControlBinding {
  action: string;
  keys: string[];
  detail?: string;
}

interface ControlGroup {
  id: string;
  label: string;
  bindings: ControlBinding[];
}

export function mountControlsSettings(host: HTMLElement): void {
  const catalog = controlsCatalog as {
    readOnly?: boolean;
    groups: ControlGroup[];
  };

  const section = el("div", "controls-settings");

  if (catalog.readOnly) {
    section.append(
      el("p", "controls-settings-note", [
        "Default bindings for v0. Custom keybinds will arrive in a later update.",
      ]),
    );
  }

  for (const group of catalog.groups) {
    const block = el("section", "controls-settings-group");
    block.append(el("h4", "controls-settings-group-title", [group.label]));

    const list = el("ul", "controls-settings-list");
    for (const binding of group.bindings) {
      const row = el("li", "controls-settings-row");
      row.append(el("span", "controls-settings-action", [binding.action]));

      const keysWrap = el("span", "controls-settings-keys");
      for (const key of binding.keys) {
        keysWrap.append(el("kbd", "controls-settings-kbd", [key]));
      }
      row.append(keysWrap);

      if (binding.detail) {
        row.append(el("span", "controls-settings-detail", [binding.detail]));
      }

      list.append(row);
    }

    block.append(list);
    section.append(block);
  }

  host.append(section);
}
