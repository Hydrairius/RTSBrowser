import {
  HUMAN_PLAYER_ID,
  MAX_GENERATOR_WORKERS,
  structureDef,
  unitDef,
  workersAssignedToGenerator,
  workersAtStructure,
  workersOperatingGenerator,
  type BuildSimState,
  type PlacedStructure,
  type TargetKind,
  type Unit,
} from "@rtsbrowser/shared";
import {
  factionById,
  structureDisplayNameForFaction,
  type FactionId,
} from "../data/factions.js";

export interface EntityTooltipContent {
  title: string;
  status: string;
  detail: string;
  hpLine: string;
  factionId: FactionId;
  friendly: boolean;
}

function ownerFaction(state: BuildSimState, ownerId: string): FactionId {
  const p = state.players.get(ownerId);
  return (p?.factionId ?? "triad") as FactionId;
}

function resolveTargetLabel(
  state: BuildSimState,
  targetId: string,
  targetKind: TargetKind,
): string {
  if (targetKind === "unit") {
    const u = state.units.find((x) => x.instanceId === targetId && x.hp > 0);
    return u ? unitDef(u.defId).displayName : "enemy unit";
  }
  const s = state.structures.find((x) => x.instanceId === targetId);
  if (!s) return "structure";
  if (s.defId === "hq") return s.ownerId === HUMAN_PLAYER_ID ? "Your HQ" : "Enemy HQ";
  const factionId = ownerFaction(state, s.ownerId);
  return structureDisplayNameForFaction(s.defId, factionId);
}

function structureSiteLabel(state: BuildSimState, structureId: string): string {
  const s = state.structures.find((x) => x.instanceId === structureId);
  if (!s) return "build site";
  if (s.defId === "hq") return s.ownerId === HUMAN_PLAYER_ID ? "Your HQ" : "HQ";
  const factionId = ownerFaction(state, s.ownerId);
  return structureDisplayNameForFaction(s.defId, factionId);
}

function trainingStatus(s: PlacedStructure): { status: string; detail: string } | null {
  if (s.buildProgress < 1 || s.trainQueue.length === 0) return null;
  const head = s.trainQueue[0]!;
  const pct = Math.round(head.progress * 100);
  const udef = unitDef(head.unitDefId);
  const queued = s.trainQueue.length - 1;
  return {
    status: `Training ${udef.displayName} · ${pct}%`,
    detail: queued > 0 ? `+${queued} in queue` : "",
  };
}

export function structureTooltipContent(
  state: BuildSimState,
  s: PlacedStructure,
): EntityTooltipContent {
  const factionId = ownerFaction(state, s.ownerId);
  const shape = factionById(factionId).shapeSymbol;
  const def = structureDef(s.defId);
  const friendly = s.ownerId === HUMAN_PLAYER_ID;
  const pct = Math.round(s.buildProgress * 100);

  let title: string;
  if (s.defId === "hq") {
    title = friendly ? `${shape} Your HQ` : `${shape} Enemy HQ`;
  } else {
    title = `${shape} ${structureDisplayNameForFaction(s.defId, factionId)}`;
  }

  let status = "";
  let detail = "";

  if (s.buildProgress < 1) {
    const crew = workersAtStructure(state, s.instanceId);
    status =
      crew > 0
        ? `Constructing · ${pct}%`
        : `Constructing · ${pct}% · needs workers`;
    if (crew > 0) detail = `${crew} worker${crew === 1 ? "" : "s"} on site`;
  } else if (s.defId === "generator" && s.hp > 0) {
    const operating = workersOperatingGenerator(state, s.instanceId);
    const assigned = workersAssignedToGenerator(state, s.instanceId);
    const rate = def.incomePerTick ?? 0;
    if (operating > 0) {
      status = `Mining matter · ◆${operating * rate}/tick`;
      detail = `${operating}/${MAX_GENERATOR_WORKERS} workers active`;
    } else if (assigned > 0) {
      status = "Workers en route";
      detail = `${assigned} assigned · max ${MAX_GENERATOR_WORKERS}`;
    } else if (friendly) {
      status = "Idle generator";
      detail = "Right-click with workers to assign";
    } else {
      status = "Idle";
    }
  } else if (s.defId === "turret") {
    if (s.hp < s.maxHp) {
      status = "Damaged";
    } else {
      status = "Auto-defense · fires at intruders";
      detail = "8 cell range";
    }
  } else if (s.defId === "barracks" || s.defId === "hq") {
    const train = trainingStatus(s);
    if (train) {
      status = train.status;
      detail = train.detail;
    } else if (s.hp < s.maxHp) {
      status = "Damaged";
    } else {
      status = s.defId === "hq" ? "Command · trains workers" : "Ready · select to train troops";
    }
    if (s.rallyPoint && friendly) {
      detail = detail
        ? `${detail} · rally set`
        : "Rally point set · new units move there";
    }
  } else if (s.hp < s.maxHp) {
    status = "Damaged";
  } else {
    status = "Operational";
  }

  const hpLine =
    s.buildProgress >= 1 && s.hp > 0 && s.hp < s.maxHp
      ? `HP ${Math.ceil(s.hp)} / ${s.maxHp}`
      : "";

  return { title, status, detail, hpLine, factionId, friendly };
}

export function unitTooltipContent(state: BuildSimState, u: Unit): EntityTooltipContent {
  const factionId = ownerFaction(state, u.ownerId);
  const shape = factionById(factionId).shapeSymbol;
  const def = unitDef(u.defId);
  const friendly = u.ownerId === HUMAN_PLAYER_ID;

  const title = friendly
    ? `${shape} ${def.displayName}`
    : `${shape} Enemy ${def.displayName}`;

  let status = "";
  let detail = "";

  switch (u.order.type) {
    case "idle":
      if (u.defId === "worker") {
        status = "Idle";
        detail = "Auto-assigns to build or gather";
      } else {
        status = "Holding position";
      }
      break;
    case "move":
      status = "Moving";
      break;
    case "attack": {
      const target = resolveTargetLabel(state, u.order.targetId, u.order.targetKind);
      status = `Attacking ${target}`;
      if (u.meleeSwingTicks > 0) detail = "Striking";
      else if (u.attackCooldown > 0) detail = "Engaged";
      break;
    }
    case "gather": {
      const site = structureSiteLabel(state, u.order.structureId);
      status = `Gathering at ${site}`;
      detail = "Mining matter";
      break;
    }
    case "construct": {
      const { structureId } = u.order;
      const site = structureSiteLabel(state, structureId);
      const siteStruct = state.structures.find((x) => x.instanceId === structureId);
      const buildPct = siteStruct ? Math.round(siteStruct.buildProgress * 100) : null;
      status = `Building ${site}`;
      detail = buildPct !== null ? `${buildPct}% complete` : "";
      break;
    }
  }

  const hpLine = u.hp < def.maxHp ? `HP ${Math.ceil(u.hp)} / ${def.maxHp}` : "";

  return { title, status, detail, hpLine, factionId, friendly };
}
