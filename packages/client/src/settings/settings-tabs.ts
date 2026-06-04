import { el } from "../ui/dom.js";

export type SettingsTabId = "audio" | "controls";

export interface SettingsTabDef {
  id: SettingsTabId;
  label: string;
}

export interface SettingsTabsHandle {
  /** Root nav + panel container (settings-panel). */
  root: HTMLElement;
  getPanel(id: SettingsTabId): HTMLElement;
  select(id: SettingsTabId): void;
}

export function createSettingsTabs(tabs: SettingsTabDef[]): SettingsTabsHandle {
  const nav = el("div", "settings-tabs");
  nav.setAttribute("role", "tablist");
  const panels = new Map<SettingsTabId, HTMLElement>();
  const tabButtons = new Map<SettingsTabId, HTMLButtonElement>();

  const select = (id: SettingsTabId) => {
    for (const [tabId, btn] of tabButtons) {
      const active = tabId === id;
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.tabIndex = active ? 0 : -1;
      panels.get(tabId)!.hidden = !active;
    }
  };

  for (const tab of tabs) {
    const btn = el("button", "settings-tab", [tab.label]) as HTMLButtonElement;
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.id = `settings-tab-${tab.id}`;
    btn.setAttribute("aria-controls", `settings-panel-${tab.id}`);
    btn.setAttribute("aria-selected", "false");
    btn.onclick = () => select(tab.id);
    tabButtons.set(tab.id, btn);
    nav.append(btn);

    const panel = el("div", "settings-tab-panel");
    panel.setAttribute("role", "tabpanel");
    panel.id = `settings-panel-${tab.id}`;
    panel.setAttribute("aria-labelledby", `settings-tab-${tab.id}`);
    panel.hidden = true;
    panels.set(tab.id, panel);
  }

  const root = el("div", "settings-panel");
  root.append(nav);
  for (const tab of tabs) {
    root.append(panels.get(tab.id)!);
  }

  select(tabs[0]!.id);

  return {
    root,
    getPanel: (id) => panels.get(id)!,
    select,
  };
}
