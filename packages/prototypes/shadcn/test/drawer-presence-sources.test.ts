import { expect, it } from 'vitest';
import { collectProtoStyleTokensFromFiles } from '../../../cli/src/services/prototype-style-tokens';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import { DRAWER_PRESENCE_SOURCE_FILES } from './fixtures/drawer-presence-sources';

it('compiles the physical Drawer presence source closure into split styles', async () => {
  const tokens = await collectProtoStyleTokensFromFiles(DRAWER_PRESENCE_SOURCE_FILES);
  expect(tokens.every((token) => typeof token === 'string')).toBe(true);
  // Actual a847 native failure: Root setup rejected before providing Drawer Context.
  expect(tokens).toContain('relative');
  expect(() => renderProtoShadowSplitStyleArtifact(tokens as string[])).not.toThrow();
});
