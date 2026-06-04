import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_PHRASES = [
  "MIT License",
  "Permission is hereby granted, free of charge",
  "The above copyright notice and this permission notice shall be included",
  "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND",
];

function fail(message) {
  console.error(`validate-license: ${message}`);
  process.exit(1);
}

const licensePath = join(root, "LICENSE");
let licenseText;
try {
  licenseText = readFileSync(licensePath, "utf8");
} catch {
  fail("LICENSE file is missing at repo root.");
}

if (!licenseText.trim()) {
  fail("LICENSE file is empty.");
}

for (const phrase of REQUIRED_PHRASES) {
  if (!licenseText.includes(phrase)) {
    fail(`LICENSE is missing required MIT text: "${phrase}"`);
  }
}

const copyrightMatch = licenseText.match(/^Copyright \(c\) (\d{4}) .+$/m);
if (!copyrightMatch) {
  fail("LICENSE must include a copyright line: Copyright (c) YYYY <holder>");
}

const year = Number(copyrightMatch[1]);
const currentYear = new Date().getFullYear();
if (year < 2000 || year > currentYear) {
  fail(`LICENSE copyright year ${year} looks invalid (expected 2000–${currentYear}).`);
}

let packageJson;
try {
  packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
} catch {
  fail("Could not read package.json.");
}

if (packageJson.license !== "MIT") {
  fail(`package.json "license" must be "MIT" (found ${JSON.stringify(packageJson.license)}).`);
}

console.log("validate-license: MIT license OK");
