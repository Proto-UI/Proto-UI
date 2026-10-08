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
  expect(part).toContain('renderSnapshotTokenCss(cssTokens, snapshotScope)');
  expect(part).toContain('data-library-snapshot={snapshotId}');
  expect(part).toContain("createHash('sha256')");
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

it('serializes the same fallback host layout and empty style state before definition', () => {
  const source = readFileSync('apps/www/src/components/UiLibraryGallery.astro', 'utf8');
  const defaultHost = source.match(
    /\.library-card :global\(\[data-library-part\]\)\s*\{([^}]+)\}/
  )?.[1];
  expect(defaultHost).toContain('display: block;');
  expect(defaultHost).not.toMatch(/color:|background:|font-|box-shadow:|border:/);
  // Preserve the actual page-owned display rules over the fallback.
  for (const [part, display] of [
    ['surface', 'flex'],
    ['header', 'flex'],
    ['content', 'grid'],
    ['footer', 'flex'],
  ]) {
    const rule = source.match(
      new RegExp(`\\.library-card :global\\(\\.library-card__${part}\\)\\s*\\{([^}]+)\\}`)
    )?.[1];
    expect(rule).toContain(`display: ${display};`);
  }
  const part = readFileSync('apps/www/src/components/LibraryCardPart.astro', 'utf8');
  expect(part).toContain("data-pui-style={tokens.length ? tokens.join(' ') : undefined}");
});

it('retains enhanced-family failure evidence before the unchanged strict comparison', () => {
  const source = readFileSync(
    'apps/www/src/content/docs/zh-cn/library-cards-first-frame.browser.test.ts',
    'utf8'
  );
  expect(source.indexOf("captureFamilyCards(page, name, 'enhanced-endpoint')")).toBeLessThan(
    source.indexOf('expect(after).toEqual(before)')
  );
  expect(source).toContain('for (const frame of frames) expect(frame).toEqual(before)');
  expect(source).toContain("await recordPhase('full-document-capture')");
  expect(source).toContain('document.documentElement.scrollHeight');
  expect(source).toContain('cards.every((card) => card.root.overflow < 2 && card.root.width > 0)');
  expect(source).not.toContain('page.screenshot(');
});
