import { readFile } from 'node:fs/promises';
import { evaluateTabs } from './tabs-oracle.mjs';

// Trusted coordinator creates this config; participant HTML never chooses paths.
try {
  const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const result = await evaluateTabs(config);
  process.exitCode = result.execution === 'completed' ? 0 : 1;
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
