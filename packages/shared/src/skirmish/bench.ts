import { createSkirmishBuildState } from "../structures/building.js";
import { unitDef } from "../units/defs.js";
import type { Unit } from "../units/types.js";
import { advanceSkirmishTick } from "./tick.js";

/** Synthetic load test for skirmish tick cost (node — run via npm run bench:skirmish). */
export function benchSkirmishTick(unitCount: number, ticks: number): {
  unitCount: number;
  ticks: number;
  totalMs: number;
  msPerTick: number;
} {
  let state = createSkirmishBuildState("triad", "block");
  const striker = unitDef("striker");
  const units: Unit[] = [];
  for (let i = 0; i < unitCount; i++) {
    const gx = 30 + (i % 20);
    const gy = 60 + Math.floor(i / 20);
    units.push({
      instanceId: `bench-u-${i}`,
      defId: "striker",
      ownerId: i % 2 === 0 ? "human" : "ai",
      x: gx * 48,
      y: gy * 48,
      hp: striker.maxHp,
      order: { type: "move", x: 100 * 48, y: 70 * 48 },
      attackCooldown: 0,
      meleeSwingTicks: 0,
    });
  }
  state = { ...state, units };

  const t0 = performance.now();
  for (let t = 0; t < ticks; t++) {
    state = advanceSkirmishTick(state);
  }
  const totalMs = performance.now() - t0;

  return {
    unitCount,
    ticks,
    totalMs,
    msPerTick: totalMs / ticks,
  };
}
