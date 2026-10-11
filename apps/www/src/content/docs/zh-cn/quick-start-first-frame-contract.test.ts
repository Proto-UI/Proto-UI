import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = readFileSync(
  'apps/www/src/content/docs/zh-cn/quick-start-first-frame.browser.test.ts',
  'utf8'
);
describe('first-frame harness load-gate contract', () => {
  it('keeps exact coverage including delayed ownership without broad paint exceptions', () => {
    const workflow = readFileSync('.github/workflows/quick-start-first-frame-evidence.yml', 'utf8');
    expect(workflow).toContain('numTotalTests, 20');
    expect(workflow).toContain('numPassedTests, 20');
    expect(source).toContain('nativeNodesPreserved');
    expect(source).toContain('selectionSame');
    expect(source).toContain('public disabled-to-ready opacity exception');
    expect(source).toContain("'strokeWidth'");
    expect(source).toContain("'shapes'");
  });
  it('persists real ownership facts and native focus/selection traces before strict assertions', () => {
    const save = source.indexOf('endToEndEarlyInputDebt:');
    const assertion = source.indexOf('expect(facts).toEqual(');
    expect(save).toBeGreaterThan(-1);
    expect(assertion).toBeGreaterThan(save);
    expect(source).toContain("'selection-write-before'");
    expect(source).toContain("'selection-write-after'");
    expect(source).toContain('initialFocusCorrect: document.activeElement === target');
    expect(source).toContain('expect(diagnostics.initialFocusCorrect).toBe(true)');
    expect(source).toContain('focused: true');
    expect(source).toContain('`${name}-trace.json`');
    const ownershipStart = source.indexOf('for (const focusOwner');
    const initialSave = source.indexOf('ownership-initial.json', ownershipStart);
    const initialAssertion = source.indexOf('expect(initial.focused', ownershipStart);
    const ownershipRelease = source.indexOf('release();', ownershipStart);
    expect(initialSave).toBeGreaterThan(ownershipStart);
    expect(initialAssertion).toBeGreaterThan(initialSave);
    expect(ownershipRelease).toBeGreaterThan(initialAssertion);
    expect(source.slice(initialAssertion, ownershipRelease)).toMatch(
      /expect\(\s*initial\.selectionNonempty/
    );
    expect(source.slice(initialAssertion, ownershipRelease)).toMatch(
      /expect\(\s*initial\.selectionSame/
    );
  });
  it('waits for the shared real Typography completion predicate before observing final ownership', () => {
    const ownershipStart = source.indexOf('for (const focusOwner');
    const wait = source.indexOf(
      'await page.waitForFunction(quickStartOwnershipReady)',
      ownershipStart
    );
    const finalFacts = source.indexOf('const facts = await page.evaluate', ownershipStart);
    expect(wait).toBeGreaterThan(ownershipStart);
    expect(finalFacts).toBeGreaterThan(wait);
    expect(source).toContain("from './quick-start-first-frame-ownership'");
  });
  const start = source.indexOf('await page.locator(targets.noteBody)');
  const release = source.indexOf('release();', start);
  const gated = source.slice(start, release);
  it('does not await document completion while deferred module requests are paused', () => {
    expect(gated).not.toContain('document.fonts.ready');
    expect(gated).toContain('await waitForCapturedFonts(page)');
    expect(source).toContain('document.fonts.load(');
    expect(source).toContain('fontFaceReady: document.fonts.check(');
  });
  it('uses native Chromium capture without a hidden whole-document font wait', () => {
    expect(source).toContain("session.send('Page.captureScreenshot'");
    expect(source).not.toContain('page.screenshot(');
    expect(source).toContain("'required fonts'");
    expect(source).toContain('beforeReleaseDeadline');
  });
  it('starts nonempty frame observation before releasing scripts', () => {
    expect(gated).toContain('observe: true');
    expect(source).toMatch(
      /frames\.length,[\s\S]{0,100}'at least one real pre-release frame was observed'/
    );
  });
  it('saves a raw viewport on precondition failure and preserves the original exception', () => {
    expect(source).toContain('await captureFailure(page, prefix, error)');
    expect(source).toContain('`${name}-failure.png`');
    expect(source).toMatch(/captureFailure\(page, prefix, error\);\s*throw error;/);
    expect(source).toContain('await stopFrameTrace(page, prefix)');
  });
});
