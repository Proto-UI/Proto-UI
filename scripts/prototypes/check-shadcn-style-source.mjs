import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verifySources, normalizeRuleFixture } from './shadcn-style-source.mjs';

const directory = fileURLToPath(new URL('../../internal/fixtures/shadcn-style-source/', import.meta.url));
const manifest = JSON.parse(readFileSync(`${directory}/manifest.json`, 'utf8'));
const styles = verifySources(`${directory}/upstream`, manifest);
if (readFileSync(`${directory}/NOTICE.shadcn-MIT.txt`, 'utf8') !== readFileSync(`${directory}/upstream/LICENSE.md`, 'utf8')) throw new Error('Upstream MIT notice is missing or altered');
const fixtures = styles.filter(s => ['nova', 'rhea'].includes(s.style)).map(s => {
  const rule = s.rules.find(r => r.selectors.at(-1) === '.cn-button-variant-default');
  return {
    style: s.style,
    sourceSha256: manifest.sources.find(f => f.path.endsWith(`style-${s.style}.css`)).sha256,
    line: rule.line,
    selectors: rule.selectors,
    normalized: normalizeRuleFixture(s.style, rule),
  };
});
const inventory = { kind: 'source-text-inventory-only', rulesInventoried: styles.reduce((n,s) => n + s.rules.length, 0), protoRulesMapped: 0, inspectionFixtures: fixtures.length, styles };
const outputs = { 'inventory.json': inventory, 'normalized-fixtures.json': fixtures };
const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => arg !== '--write')) throw new Error('Usage: check-shadcn-style-source.mjs [--write]');
for (const [name, data] of Object.entries(outputs)) {
  const expected = JSON.stringify(data, null, 2) + '\n';
  if (args.includes('--write')) writeFileSync(`${directory}/${name}`, expected);
  else if (readFileSync(`${directory}/${name}`, 'utf8') !== expected) throw new Error(`Stale generated output: ${name}`);
}
console.log(JSON.stringify({ revision: manifest.revision, styles: styles.map(s => ({ name: s.style, rules: s.rules.length, applyStatements: s.rules.reduce((n,r) => n + r.apply.length, 0) })), componentPaths: manifest.componentInventory.length, normalizedFixtures: fixtures.length, projectionParity: 'not-implemented' }, null, 2));
