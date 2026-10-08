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
  expect(part).toContain('renderProtoStyleTokenCss(cssTokens)');
  expect(part).not.toContain('visibility');
});
