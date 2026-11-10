import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import base from '../../../vitest.config.ts';
import { readPlan, sourceVariantPlugin } from './source-variant.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const plan = readPlan(root);
const cell = process.env.PROTO_UI_DIALOG_STUDY_CELL;
const variant = plan.variants.find((item) => item.id === process.env.PROTO_UI_DIALOG_STUDY_VARIANT);
if (!cell || !variant || !fs.existsSync(path.join(cell, 'cell.json')))
  throw new Error('Start this bounded study through run.mjs, which freezes source bytes first.');

export default defineConfig({
  ...base,
  root,
  plugins: [...(base.plugins ?? []), sourceVariantPlugin(root, cell, plan, variant)],
  test: {
    ...base.test,
    include: [...Object.keys(plan.existingSuites), plan.oracleSuite],
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    isolate: true,
    reporters: ['default', 'json', path.join(root, 'scripts/test/dialog-run-integrity-reporter.mjs')],
    outputFile: path.join(cell, 'vitest.json'),
  },
});
