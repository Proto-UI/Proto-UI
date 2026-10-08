import { readFile } from 'node:fs/promises';
import { evaluateTabsSettings } from './tabs-settings-oracle.mjs';

// Only a trusted coordinator supplies config. No participant-supplied paths/options.
try {
  const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const result = await evaluateTabsSettings(config);
  process.exitCode = result.execution === 'completed' ? 0 : 1;
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
