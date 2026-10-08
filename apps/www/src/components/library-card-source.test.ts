import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
it('keeps ownership honest and removes fake previews and delayed placeholders', () => {
  const source = readFileSync('apps/www/src/components/UiLibraryGallery.astro', 'utf8');
  expect(source).not.toContain('PrototypePreviewer');
  expect(source).not.toMatch(
    /base-preview|shadcn-preview|brutalist-preview|background:\s*(?:#|linear-gradient)|box-shadow:/
  );
  expect(source).toContain("library.id === 'lucide' ? 'base'");
  expect(source).toContain("'brutalist-card'");
  expect(source).toContain('不透明 Surface 回退');
  const part = readFileSync('apps/www/src/components/LibraryCardPart.astro', 'utf8');
  expect(part).toContain('snapshotLibraryPart(part, props)');
  expect(part).toContain('renderSnapshotTokenCss(cssTokens)');
  expect(part).not.toContain('visibility');
});

it('prepares individually bound appearance screenshots without treating endpoints as frame evidence', () => {
  const source = readFileSync(
    'apps/www/src/content/docs/zh-cn/library-cards-first-frame.browser.test.ts',
    'utf8'
  );
  expect(source).toContain("phase: 'held-first-frame' | 'enhanced-endpoint'");
  expect(source).toContain('for (const family of families)');
  expect(source).toContain("'bootstrap-2-3-2'");
  expect(source).toContain("'liquid-glass'");
  expect(source).toContain("createHash('sha256').update(bytes).digest('hex')");
  expect(source).toContain('expect(sha).toBe(process.env.CANDIDATE_SHA)');
  expect(source).toContain('Endpoints do not replace intermediate-frame observations.');
  expect(source).toContain('captureBeyondViewport: !!clip');
});
