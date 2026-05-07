#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { readVersion, findProtoPackages } from './version-utils.mjs';

const version = readVersion();
const packages = findProtoPackages();

let updated = 0;
for (const pkg of packages) {
  const currentVersion = pkg.manifest.version || '0.0.0';
  if (currentVersion.startsWith(version.minorPrefix)) continue;
  pkg.manifest.version = version.raw;
  writeFileSync(pkg.manifestPath, `${JSON.stringify(pkg.manifest, null, 2)}\n`);
  console.log(`stamped ${pkg.manifest.name}: ${currentVersion} -> ${version.raw}`);
  updated += 1;
}

const aligned = packages.length - updated;
console.log(
  `stamp-version: ${updated} updated, ${aligned} already on minor ${version.major}.${version.minor}`
);
