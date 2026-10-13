import { expect, it } from 'vitest';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import { DRAWER_PRESENCE_SOURCE_FILES } from './fixtures/drawer-presence-sources';

it('presence companion covers every registered Drawer recipe and style-bearing Base hook', async () => {
  const registeredRecipes = ['root', 'content', 'mask'].map(
    (part) => `packages/prototypes/shadcn/src/drawer/${part}.proto.ts`
  );
  const hookClosure = ['root.proto.ts', 'content.proto.ts', 'overlay.proto.ts', 'snap.ts'].map(
    (file) => `packages/prototypes/base/src/drawer/${file}`
  );
  const tokens = await collectProtoStyleTokensFromFiles(DRAWER_PRESENCE_SOURCE_FILES);
  expect(tokens.every((token) => typeof token === 'string')).toBe(true);
  for (const source of [...registeredRecipes, ...hookClosure]) {
    expect(DRAWER_PRESENCE_SOURCE_FILES, source).toContain(source);
    const authored = await collectProtoStyleTokensFromFiles([source]);
    for (const token of authored) expect(tokens, `${source}: ${String(token)}`).toContain(token);
  }
  // Actual a847 native failure: Root setup rejected before providing Drawer Context.
  expect(tokens).toContain('relative');
  expect(() => renderProtoShadowSplitStyleArtifact(tokens as string[])).not.toThrow();
});
