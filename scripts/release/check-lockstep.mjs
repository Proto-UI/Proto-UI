#!/usr/bin/env node
import { readVersion, findProtoPackages } from './version-utils.mjs';

const version = readVersion();
const packages = findProtoPackages();

const violations = [];
for (const pkg of packages) {
  const v = pkg.manifest.version || '';
  if (!v.startsWith(version.minorPrefix)) {
    violations.push({ name: pkg.manifest.name, version: v });
  }
}

if (violations.length > 0) {
  console.error(
    `check-lockstep: ${violations.length} @proto.ui package(s) outside minor ${version.major}.${version.minor}:`
  );
  for (const violation of violations) {
    console.error(`  ${violation.name} @ ${violation.version || '<missing>'}`);
  }
  console.error(`expected MAJOR.MINOR prefix: ${version.minorPrefix}`);
  process.exit(1);
}

console.log(
  `check-lockstep: all ${packages.length} @proto.ui packages on minor ${version.major}.${version.minor} (patch differences allowed)`
);
