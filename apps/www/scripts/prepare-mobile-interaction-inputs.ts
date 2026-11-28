import { parseArgs } from 'node:util';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createStyleGenerationOwner } from '../src/content/docs/zh-cn/browser-harness';
import { prepareMobileInputs } from './mobile-prepared-inputs.mjs';

const { values } = parseArgs({
  options: { out: { type: 'string' }, 'expected-revision': { type: 'string' } },
});
if (!values.out || !values['expected-revision'])
  throw new Error('Preparation needs an output receipt and exact revision');
await mkdir(path.dirname(path.resolve(values.out)), { recursive: true });
const generation = createStyleGenerationOwner();
try {
  const receipt = await prepareMobileInputs({
    root: process.cwd(),
    receiptFile: values.out,
    expectedRevision: values['expected-revision'],
    generate: () => generation.run(process.platform === 'win32' ? 'corepack.cmd' : 'corepack'),
  });
  console.log(
    `[mobile-input-preparation] ${JSON.stringify({ source: receipt.source, preparationMs: receipt.preparationMs, outputCount: receipt.outputs.length })}`
  );
} finally {
  await generation.stop();
}
