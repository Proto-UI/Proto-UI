import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getPublicPackages } from '../../../../../scripts/build/public-packages.mjs';
import {
  createPublishManifest,
  writeSupportingFiles,
} from '../../../../../scripts/release/lib.mjs';

const root = process.argv[2];
if (!root) throw new Error('A disposable source consumer directory is required.');
for (const name of [
  '@proto.ui/hooks',
  '@proto.ui/prototypes-base',
  '@proto.ui/prototypes-shadcn',
]) {
  const pkg = getPublicPackages().find((candidate) => candidate.name === name);
  if (!pkg) throw new Error(`Missing public package ${name}`);
  const stage = path.join(root, 'node_modules', name);
  mkdirSync(stage, { recursive: true });
  writeSupportingFiles(pkg, stage);
  writeFileSync(
    path.join(stage, 'package.json'),
    JSON.stringify(createPublishManifest(pkg, { access: 'public' }))
  );
}
