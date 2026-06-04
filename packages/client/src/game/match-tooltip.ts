import type { BuildSimState } from "@rtsbrowser/shared";
import { factionById } from "../data/factions.js";
import { el } from "../ui/dom.js";
import {
  structureTooltipContent,
  unitTooltipContent,
  type EntityTooltipContent,
} from "./entity-tooltip.js";

export interface MatchTooltipHandle {
  /** Re-read hovered entity from sim state (call each tick while visible). */
  refresh(): void;
  destroy(): void;
}

export function mountMatchTooltip(
  viewport: HTMLElement,
  options: {
    getState: () => BuildSimState;
  },
): MatchTooltipHandle {
  const tooltip = el("div", "entity-tooltip");
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  const titleEl = el("div", "entity-tooltip-title");
  const statusEl = el("div", "entity-tooltip-status");
  const detailEl = el("div", "entity-tooltip-detail");
  const hpEl = el("div", "entity-tooltip-hp");
  tooltip.append(titleEl, statusEl, detailEl, hpEl);
  viewport.append(tooltip);

  let hoveredEl: HTMLElement | null = null;
  let hoveredKind: "unit" | "structure" | null = null;
  let hoveredId: string | null = null;

  function applyContent(content: EntityTooltipContent): void {
    const faction = factionById(content.factionId);
    tooltip.style.setProperty("--tooltip-accent", faction.color);
    tooltip.dataset.friendly = content.friendly ? "true" : "false";
    tooltip.dataset.faction = content.factionId;
    titleEl.textContent = content.title;
    statusEl.textContent = content.status;
    detailEl.textContent = content.detail;
    detailEl.hidden = !content.detail;
    hpEl.textContent = content.hpLine;
    hpEl.hidden = !content.hpLine;
  }

  function positionTooltip(anchor: HTMLElement): void {
    const rect = anchor.getBoundingClientRect();
    const vp = viewport.getBoundingClientRect();
    const tipW = tooltip.offsetWidth;
    const tipH = tooltip.offsetHeight;
    const gap = 14;

    let left = rect.left + rect.width / 2 - tipW / 2;
    let top = rect.top - tipH - gap;

    if (top < vp.top + 8) {
      top = rect.bottom + gap;
    }
    left = Math.max(vp.left + 8, Math.min(left, vp.right - tipW - 8));
    top = Math.max(vp.top + 8, Math.min(top, vp.bottom - tipH - 8));

    tooltip.style.left = `${left - vp.left}px`;
    tooltip.style.top = `${top - vp.top}px`;
  }

  function refreshContent(): void {
    if (!hoveredEl || !hoveredKind || !hoveredId) return;

    const state = options.getState();
    if (hoveredKind === "unit") {
      const u = state.units.find((x) => x.instanceId === hoveredId && x.hp > 0);
      if (!u) {
        hide();
        return;
      }
      applyContent(unitTooltipContent(state, u));
    } else {
      const s = state.structures.find((x) => x.instanceId === hoveredId);
      if (!s || s.hp <= 0) {
        hide();
        return;
      }
      applyContent(structureTooltipContent(state, s));
    }
    positionTooltip(hoveredEl);
  }

  function showFor(el: HTMLElement, kind: "unit" | "structure", id: string): void {
    hoveredEl = el;
    hoveredKind = kind;
    hoveredId = id;
    el.classList.add("entity-hovered");
    tooltip.hidden = false;
    tooltip.classList.add("entity-tooltip-visible");
    refreshContent();
  }

  function hide(): void {
    hoveredEl?.classList.remove("entity-hovered");
    hoveredEl = null;
    hoveredKind = null;
    hoveredId = null;
    tooltip.hidden = true;
    tooltip.classList.remove("entity-tooltip-visible");
  }

  function resolveHover(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) return null;
    return target.closest(".field-unit, .field-structure") as HTMLElement | null;
  }

  function readHover(el: HTMLElement): { kind: "unit" | "structure"; id: string } | null {
    const unitId = el.dataset.unitId;
    if (unitId) return { kind: "unit", id: unitId };
    const structId = el.dataset.instanceId;
    if (structId) return { kind: "structure", id: structId };
    return null;
  }

  function onPointerMove(e: PointerEvent): void {
    const next = resolveHover(e.target);
    if (next === hoveredEl) {
      if (hoveredEl) positionTooltip(hoveredEl);
      return;
    }

    hide();
    if (!next) return;

    const meta = readHover(next);
    if (!meta) return;
    showFor(next, meta.kind, meta.id);
  }

  function onPointerLeave(e: PointerEvent): void {
    const related = e.relatedTarget;
    if (related instanceof Node && viewport.contains(related)) return;
    hide();
  }

  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerleave", onPointerLeave);

  return {
    refresh: refreshContent,
    destroy() {
      hide();
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerleave", onPointerLeave);
      tooltip.remove();
    },
  };
}
