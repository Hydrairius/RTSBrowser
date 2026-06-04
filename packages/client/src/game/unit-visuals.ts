import type { UnitDefId } from "@rtsbrowser/shared";

/**
 * DOM footprint per unit — keep offsets in sync with match-present.
 * Roles differ by shape (solid / ring / pentagon), not by tiny hit boxes.
 */
export const UNIT_VISUAL: Record<
  UnitDefId,
  { sizePx: number; offsetPx: number; roleLabel: string }
> = {
  striker: { sizePx: 40, offsetPx: 20, roleLabel: "Melee" },
  bolter: { sizePx: 38, offsetPx: 19, roleLabel: "Ranged" },
  worker: { sizePx: 36, offsetPx: 18, roleLabel: "Builder" },
};

export function unitDisplayOffset(defId: UnitDefId): number {
  return UNIT_VISUAL[defId].offsetPx;
}

export function applyUnitVisualClasses(el: HTMLElement, defId: UnitDefId): void {
  el.classList.remove("unit-striker", "unit-bolter", "unit-worker");
  el.classList.add(`unit-${defId}`);
  const { sizePx } = UNIT_VISUAL[defId];
  el.style.setProperty("--unit-size", `${sizePx}px`);
}
