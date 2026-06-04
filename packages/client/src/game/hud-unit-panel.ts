import { isCombatUnit, isWorkerUnit, type UnitDefId } from "@rtsbrowser/shared";
import { factionById, type FactionId } from "../data/factions.js";
import { factionThemeClass } from "./faction-shapes.js";
import { UNIT_VISUAL } from "./unit-visuals.js";
import { button, el } from "../ui/dom.js";

export interface UnitPanelEntry {
  defId: UnitDefId;
  displayName: string;
  roleLabel: string;
  hp: number;
  maxHp: number;
  status: string;
  detail: string;
}

export interface UnitPanelSnapshot {
  count: number;
  factionId: FactionId;
  /** Live status line for the card header. */
  status: string;
  detail: string;
  totalHp: number;
  totalMaxHp: number;
  /** Primary unit when one selected; first unit when group. */
  primaryDefId: UnitDefId;
  primaryName: string;
  primaryRole: string;
  entries: readonly UnitPanelEntry[];
}

export interface HudUnitPanelHandle {
  update(snapshot: UnitPanelSnapshot | null): void;
}

export function mountHudUnitPanel(
  host: HTMLElement,
  options: { onStop: () => void },
): HudUnitPanelHandle {
  const root = el("div", "hud-unit-panel hidden");
  const portrait = el("div", "hud-unit-portrait");
  const portraitGlyph = el("div", "hud-unit-portrait-glyph");
  portrait.append(portraitGlyph);

  const body = el("div", "hud-unit-body");
  const titleRow = el("div", "hud-unit-title-row");
  const nameEl = el("span", "hud-unit-name", [""]);
  const roleEl = el("span", "hud-unit-role", [""]);
  titleRow.append(nameEl, roleEl);

  const hpTrack = el("div", "hud-unit-hp-track");
  const hpFill = el("div", "hud-unit-hp-fill");
  const hpText = el("span", "hud-unit-hp-text", [""]);
  hpTrack.append(hpFill);

  const statusEl = el("p", "hud-unit-status", [""]);
  const detailEl = el("p", "hud-unit-detail", [""]);

  const actions = el("div", "hud-unit-actions");
  const stopBtn = button("Stop", "hud-unit-action-btn hud-unit-action-stop");
  stopBtn.title = "Cancel current orders";
  stopBtn.onclick = () => options.onStop();

  body.append(titleRow, hpTrack, hpText, statusEl, detailEl);
  root.append(portrait, body, actions);
  host.append(root);

  function renderPortrait(defId: UnitDefId, factionId: FactionId): void {
    for (const c of ["faction-theme-triad", "faction-theme-loop", "faction-theme-block"]) {
      portraitGlyph.classList.remove(c);
    }
    portraitGlyph.classList.remove(
      "field-unit-glyph",
      "field-unit-glyph--striker",
      "field-unit-glyph--bolter",
      "field-unit-glyph--worker",
    );
    portraitGlyph.className = `hud-unit-portrait-glyph field-unit-glyph field-unit-glyph--${defId} ${factionThemeClass(factionId)}`;
    const { sizePx } = UNIT_VISUAL[defId];
    portraitGlyph.style.setProperty("--unit-size", `${Math.round(sizePx * 0.92)}px`);
    const core = portraitGlyph.querySelector(".field-unit-core");
    if (!core) {
      const inner = el("div", "field-unit-core");
      portraitGlyph.append(inner);
    }
  }

  function rebuildActions(snap: UnitPanelSnapshot): void {
    actions.replaceChildren(stopBtn);
    const hasWorker = snap.entries.some((e) => isWorkerUnit(e.defId));
    const hasCombat = snap.entries.some((e) => isCombatUnit(e.defId));

    if (hasCombat) {
      const attackHint = el("span", "hud-unit-action-hint", ["Right-click · attack"]);
      actions.append(attackHint);
    }
    if (hasWorker) {
      const gatherHint = el("span", "hud-unit-action-hint", ["Right-click generator · gather"]);
      actions.append(gatherHint);
    }
    const moveHint = el("span", "hud-unit-action-hint", ["Right-click map · move"]);
    actions.append(moveHint);
  }

  function groupTitle(snap: UnitPanelSnapshot): string {
    const counts = new Map<string, number>();
    for (const e of snap.entries) {
      counts.set(e.displayName, (counts.get(e.displayName) ?? 0) + 1);
    }
    const parts = [...counts.entries()].map(([name, n]) => (n > 1 ? `${n}× ${name}` : name));
    return parts.join(" · ");
  }

  return {
    update(snapshot: UnitPanelSnapshot | null) {
      if (!snapshot) {
        root.classList.add("hidden");
        return;
      }
      root.classList.remove("hidden");
      root.style.setProperty("--faction-color", factionById(snapshot.factionId).color);
      renderPortrait(snapshot.primaryDefId, snapshot.factionId);

      if (snapshot.count === 1) {
        nameEl.textContent = snapshot.primaryName;
        roleEl.textContent = snapshot.primaryRole;
      } else {
        nameEl.textContent = `${snapshot.count} units`;
        roleEl.textContent = groupTitle(snapshot);
      }

      const hpPct =
        snapshot.totalMaxHp > 0
          ? Math.max(0, Math.min(100, (snapshot.totalHp / snapshot.totalMaxHp) * 100))
          : 0;
      hpFill.style.width = `${hpPct}%`;
      hpText.textContent = `${Math.ceil(snapshot.totalHp)} / ${snapshot.totalMaxHp}`;
      hpFill.classList.toggle("hud-unit-hp-low", hpPct > 0 && hpPct < 35);
      hpFill.classList.toggle("hud-unit-hp-critical", hpPct > 0 && hpPct < 18);

      statusEl.textContent = snapshot.status;
      detailEl.textContent = snapshot.detail;
      detailEl.classList.toggle("hidden", !snapshot.detail);

      rebuildActions(snapshot);
    },
  };
}
