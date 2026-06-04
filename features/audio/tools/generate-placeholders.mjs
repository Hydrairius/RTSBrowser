#!/usr/bin/env node
/**
 * Writes minimal silent WAV placeholders for dev until real assets land.
 * Run from repo root: node features/audio/tools/generate-placeholders.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(__dirname, "../../../packages/client/public/audio");

const files = [
  "sfx/ui/click.wav",
  "sfx/ui/open.wav",
  "sfx/purchase/worker.wav",
  "sfx/purchase/unit.wav",
  "sfx/purchase/structure.wav",
  "sfx/select/unit.wav",
  "sfx/select/structure.wav",
  "sfx/command/move.wav",
  "sfx/command/rally.wav",
  "sfx/build/complete.wav",
  "sfx/unit/deploy.wav",
  "sfx/combat/attack-ranged.wav",
  "sfx/combat/attack-melee.wav",
  "sfx/combat/hit.wav",
  "sfx/unit/destroyed.wav",
  "sfx/sting/victory.wav",
  "sfx/sting/defeat.wav",
  "music/landing.wav",
  "music/menu.wav",
  "music/match.wav",
];

function writeSilentWav(filePath, durationSec = 0.08) {
  const sampleRate = 8000;
  const numSamples = Math.max(1, Math.floor(sampleRate * durationSec));
  const dataSize = numSamples;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate, 28);
  buffer.writeUInt16LE(1, 32);
  buffer.writeUInt16LE(8, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  buffer.fill(128, 44);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

for (const rel of files) {
  const out = path.join(publicRoot, rel);
  const duration = rel.startsWith("music/") ? 2 : 0.08;
  writeSilentWav(out, duration);
  console.log(`wrote ${rel}`);
}
