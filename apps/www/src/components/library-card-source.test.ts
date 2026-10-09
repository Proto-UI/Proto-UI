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
  const capture = readFileSync('apps/www/src/content/docs/zh-cn/library-card-capture.ts', 'utf8');
  expect(capture).toContain("createHash('sha256').update(bytes).digest('hex')");
  expect(source).toContain('expect(sha).toBe(process.env.CANDIDATE_SHA)');
  expect(source).toContain('Endpoints do not replace intermediate-frame observations.');
  expect(capture).toContain('captureBeyondViewport: !!clip');
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
      new RegExp(
        `\\.library-card(?:\\:not\\(\\[data-library='bootstrap-2-3-2'\\]\\))? :global\\(\\.library-card__${part}\\)\\s*\\{([^}]+)\\}`
      )
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
  expect(source).toContain('libraryCardReadabilityFailures(cards)');
  expect(source).toContain('expect(readabilityFailures).toEqual([])');
  expect(source).toContain('expect(clip.width).toBe(320)');
  expect(source).toContain(
    "it('keeps all destinations available with no JavaScript at 320px and 200% text'"
  );
  expect(source).toContain('}, 90_000);');
  expect(source).not.toContain('page.screenshot(');
});

it('keeps the Bootstrap layout conditional while family prototypes own its paint', () => {
  const frame = readFileSync('apps/www/src/components/LibraryCardFrame.astro', 'utf8');
  expect(frame).toContain('bootstrap ?');
  expect(frame).toMatch(/\)\s*:\s*\(\s*<slot\s*\/>\s*\)/);
  expect(frame).not.toMatch(/role=|tabindex=|onclick=|<button/);
  const source = readFileSync('apps/www/src/components/UiLibraryGallery.astro', 'utf8');
  expect(source).toContain('bootstrap ? bootstrapLibraryHeadingProps : libraryHeadingProps');
  expect(source).toContain('const bodyProps = libraryBodyPropsForFamily(family)');
  expect(source).toContain('props={bodyProps}');
  expect(source).toContain('const captionProps = libraryCaptionPropsForFamily(family)');
  expect(source).toContain('props={captionProps}');
  expect(source).toContain("props={{ ...captionProps, tone: 'inherit' }}");
  expect(source).toContain('<a href={library.href} data-library-action>');
  const bootstrapRules = [
    ...source.matchAll(/\[data-library='bootstrap-2-3-2'\] :global\([^}]+\{([^}]+)\}/g),
  ]
    .map((match) => match[1])
    .join('\n');
  expect(bootstrapRules).toContain('padding: 0.25rem;');
  expect(bootstrapRules).toContain('padding: 0.5625rem;');
  expect(bootstrapRules).not.toMatch(/background|border|shadow|color|font/);
});

it('inlines the licensed family font without hiding text or altering desktop typography', () => {
  const source = readFileSync('apps/www/src/components/UiLibraryGallery.astro', 'utf8');
  expect(source).toContain('DMSans-Variable.ttf?inline');
  expect(source).toContain('font-display: swap;');
  expect(source).not.toMatch(/font-display: (optional|block)|visibility: hidden/);
  expect(source).toContain('container-type: inline-size;');
  expect(source).toContain('@container (max-width: 18rem)');
  expect(source).toContain('flex-direction: column-reverse;');
  expect(source).toContain('padding-inline: min(1.5rem, 5cqi);');
  const narrow = source.slice(source.indexOf('@container (max-width: 18rem)'));
  expect(narrow).not.toMatch(/font-size:|font-family:|line-height:|overflow: hidden/);
});

it('keeps Bootstrap narrow padding on its caption instead of its outer shell and action', () => {
  const source = readFileSync('apps/www/src/components/UiLibraryGallery.astro', 'utf8');
  const narrow = source
    .slice(
      source.indexOf('@container (max-width: 18rem)'),
      source.indexOf('@media (max-width: 50rem)')
    )
    .replace(/\s+/g, ' ');
  expect(narrow).toContain(
    ".library-card:not([data-library='brutalist']):not([data-library='bootstrap-2-3-2']) :global(.library-card__surface)"
  );
  expect(narrow).toContain(
    ".library-card:not([data-library='bootstrap-2-3-2']) :global(.library-card__action) { padding-inline: min(1rem, 5cqi); }"
  );
  expect(narrow).toContain(
    "[data-library='bootstrap-2-3-2'] :global(.library-card__thumbnail-caption) { padding-inline: min(0.5625rem, 2cqi); }"
  );
  expect(narrow).not.toMatch(/font-size:|font-family:|line-height:|overflow: hidden/);
});

it('measures the actual title Text and verifies real fonts in both reload phases', () => {
  const source = readFileSync(
    'apps/www/src/content/docs/zh-cn/library-cards-first-frame.browser.test.ts',
    'utf8'
  );
  expect(source).toContain('title: measure(title, titleText)');
  expect(source).toContain('titleLeaf: measure(titleText)');
  const start = source.indexOf("phase = 'reloading';");
  const reload = source.slice(start, source.indexOf("phase = 'passed';", start));
  const release = reload.indexOf('release();');
  const beforeRelease = reload.slice(0, release);
  expect(beforeRelease).toContain('reloadFontFaces = await page.evaluate(');
  expect(beforeRelease).toContain(
    "face.family.includes('Library DM Sans') && face.status === 'loaded'"
  );
  expect(beforeRelease).toContain(
    'platformFonts.reloadHeld = await readLibraryPlatformFonts(page)'
  );
  expect(beforeRelease).toContain(
    'expect(libraryCardFontFailures(platformFonts.reloadHeld)).toEqual([])'
  );
  expect(beforeRelease.indexOf('platformFonts.reloadHeld =')).toBeLessThan(
    beforeRelease.indexOf('reloadBefore = await page.evaluate(readCards, true)')
  );
  expect(beforeRelease).not.toMatch(/fonts\.ready|fonts\.load\(|waitForTimeout|expect\.poll/);
  expect(reload.slice(release)).toContain(
    'platformFonts.reloadEnhanced = await readLibraryPlatformFonts(page)'
  );
  expect(reload.slice(release)).toContain(
    'expect(libraryCardFontFailures(platformFonts.reloadEnhanced)).toEqual([])'
  );
  expect(reload).toContain('expect(reloadAfter).toEqual(reloadBefore)');
  expect(reload).toContain('for (const frame of reloadFrames) expect(frame).toEqual(reloadBefore)');
  const records = source.slice(source.indexOf('} catch (error)', start));
  expect([...records.matchAll(/^\s+platformFonts,$/gm)]).toHaveLength(2);
  expect([...records.matchAll(/^\s+reloadFontFaces,$/gm)]).toHaveLength(2);
});
