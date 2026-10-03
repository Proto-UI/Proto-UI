import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { collectProtoStyleTokens } from '../../../packages/cli/dist/services/prototype-style-tokens.js';
import { renderProtoStyleTokenCss } from '../../../packages/cli/dist/services/proto-style-css.js';

// Use the same compiler as the CLI, with one website-specific source union.
// A second generated stylesheet would repeat the global data-pui-style reset
// after existing Prototype declarations and could erase their ring/shadow state.
const roots = [
  new URL('../../../packages/prototypes/', import.meta.url),
  new URL('../src/prototypes/', import.meta.url),
];
const groups = await Promise.all(roots.map((root) => collectProtoStyleTokens(fileURLToPath(root))));
const tokens = [...new Set(groups.flat())].sort();
const output = new URL('../src/styles/proto-ui-tokens.generated.css', import.meta.url);
await fs.writeFile(output, renderProtoStyleTokenCss(tokens), 'utf8');
console.log(
  `[website-prototypes] generated one style sheet from ${tokens.length} package + website tokens`
);
