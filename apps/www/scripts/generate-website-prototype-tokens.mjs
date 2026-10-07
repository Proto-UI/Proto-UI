import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { collectProtoShadowStyleTokenUsage } from '../../../packages/cli/dist/services/prototype-style-tokens.js';
import { renderShadowStyleDelivery } from '../../../packages/cli/dist/services/shadow-style-delivery.js';

// Use the same compiler as the CLI, with one website-specific source union.
// A second generated stylesheet would repeat the global data-pui-style reset
// after existing Prototype declarations and could erase their ring/shadow state.
const roots = [
  new URL('../../../packages/prototypes/', import.meta.url),
  new URL('../src/prototypes/', import.meta.url),
];
const groups = await Promise.all(
  roots.map((root) => collectProtoShadowStyleTokenUsage(fileURLToPath(root)))
);
const union = (key) => [...new Set(groups.flatMap((group) => group[key]))].sort();
const tokens = union('tokens');
const delivery = renderShadowStyleDelivery(tokens, 'protoShadowStyleArtifact', {
  rootTokens: union('rootTokens'),
  templateTokens: union('templateTokens'),
});
await Promise.all([
  fs.writeFile(
    new URL('../src/styles/proto-ui-tokens.generated.css', import.meta.url),
    delivery.documentCss,
    'utf8'
  ),
  fs.writeFile(
    new URL('../src/styles/proto-ui-shadow-style.generated.js', import.meta.url),
    delivery.shadowModule,
    'utf8'
  ),
  fs.writeFile(
    new URL('../src/styles/proto-ui-shadow-style.generated.d.ts', import.meta.url),
    delivery.shadowDeclaration,
    'utf8'
  ),
]);
console.log(
  `[website-prototypes] generated one style sheet and its Shadow companion from ${tokens.length} package + website tokens`
);
