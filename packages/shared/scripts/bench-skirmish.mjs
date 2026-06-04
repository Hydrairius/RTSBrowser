import { benchSkirmishTick } from "../dist/skirmish/bench.js";

const cases = [
  { units: 10, ticks: 200 },
  { units: 40, ticks: 200 },
  { units: 80, ticks: 200 },
];

console.log("Skirmish tick benchmark (advanceSkirmishTick only)\n");
for (const { units, ticks } of cases) {
  const r = benchSkirmishTick(units, ticks);
  console.log(
    `${String(units).padStart(3)} units × ${ticks} ticks: ${r.totalMs.toFixed(1)}ms total, ${r.msPerTick.toFixed(2)}ms/tick`,
  );
}
