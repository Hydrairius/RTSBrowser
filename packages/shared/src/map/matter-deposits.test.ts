import assert from "node:assert/strict";
import {
  availableMatterDeposits,
  matterDepositsForSide,
  SKIRMISH_MATTER_DEPOSITS,
} from "./matter-deposits.js";
import {
  canPlaceStructure,
  createSkirmishBuildState,
  placeStructure,
} from "../structures/building.js";
import { HUMAN_PLAYER_ID } from "../structures/defs.js";
import { footprintOverlapsBarrier } from "./barriers.js";
import { HUMAN_HQ_BOWL, AI_HQ_BOWL } from "./layout.js";

function testDepositsNotOnBarriers(): void {
  for (const d of SKIRMISH_MATTER_DEPOSITS) {
    assert.ok(
      !footprintOverlapsBarrier(d.gx, d.gy, { w: 1, h: 1 }),
      `deposit ${d.id} must not overlap barriers`,
    );
  }
}

function testDepositsInHqBowls(): void {
  for (const d of SKIRMISH_MATTER_DEPOSITS) {
    const bowl = d.side === "human" ? HUMAN_HQ_BOWL : AI_HQ_BOWL;
    assert.ok(
      d.gx >= bowl.minGx &&
        d.gx < bowl.maxGx &&
        d.gy >= bowl.minGy &&
        d.gy < bowl.maxGy,
      `deposit ${d.id} must sit in ${d.side} HQ bowl`,
    );
  }
}

function testGeneratorRequiresDeposit(): void {
  const state = createSkirmishBuildState("triad", "loop");
  const offNode = canPlaceStructure(state, HUMAN_PLAYER_ID, "generator", 20, 70);
  assert.equal(offNode.ok, false);
  assert.equal(offNode.reason, "no_matter_deposit");

  const onNode = canPlaceStructure(state, HUMAN_PLAYER_ID, "generator", 30, 72);
  assert.equal(onNode.ok, true);
}

function testDepositConsumedAfterPlace(): void {
  let state = createSkirmishBuildState("triad", "loop");
  assert.equal(availableMatterDeposits(state, HUMAN_PLAYER_ID).length, 5);

  const placed = placeStructure(state, HUMAN_PLAYER_ID, "generator", 30, 72);
  assert.ok(placed);
  state = placed!;
  assert.equal(availableMatterDeposits(state, HUMAN_PLAYER_ID).length, 4);
  assert.ok(state.consumedMatterDepositIds.includes("human-m3"));

  const again = canPlaceStructure(state, HUMAN_PLAYER_ID, "generator", 30, 72);
  assert.equal(again.ok, false);
  assert.equal(again.reason, "matter_deposit_claimed");
}

function testBarracksIgnoresDeposits(): void {
  const state = createSkirmishBuildState("triad", "loop");
  const result = canPlaceStructure(state, HUMAN_PLAYER_ID, "barracks", 20, 70);
  assert.notEqual(result.reason, "no_matter_deposit");
}

function testFiveDepositsPerSide(): void {
  assert.equal(matterDepositsForSide("human").length, 5);
  assert.equal(matterDepositsForSide("ai").length, 5);
}

testDepositsNotOnBarriers();
testDepositsInHqBowls();
testGeneratorRequiresDeposit();
testDepositConsumedAfterPlace();
testBarracksIgnoresDeposits();
testFiveDepositsPerSide();
console.log("matter-deposits.test.js: ok");
