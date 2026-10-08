import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const control = readFileSync(
  'apps/www/src/content/docs/zh-cn/quick-start-first-frame-fragment-control.browser.test.ts',
  'utf8'
);
const main = readFileSync(
  'apps/www/src/content/docs/zh-cn/quick-start-first-frame.browser.test.ts',
  'utf8'
);
const workflow = readFileSync('.github/workflows/quick-start-first-frame-evidence.yml', 'utf8');

describe('native fragment diagnostic evidence boundaries (source controls only)', () => {
  it('keeps native fragment navigation and completely disables application execution', () => {
    expect(control).toContain("const route = '/zh-cn/start-here/quick-start/#_top'");
    expect(control).toContain(
      `const inlineScriptPolicy = "script-src 'self'; script-src-attr 'none'"`
    );
    expect(control).toContain("response.headers()['content-security-policy']");
    expect(control).toMatch(/request\.fulfill\(\{\s*response,\s*body,/);
    expect(control).toContain('scriptInventory');
    expect(control).toContain('emptyModuleSHA256');
    expect(control).toContain(
      "if (request.request().resourceType() !== 'script') return request.continue()"
    );
    expect(control).toContain('await gate;');
    expect(control).toContain('body: emptyModule');
    for (const field of ['menuEnhanced', 'typographyEnhanced', 'codeEnhanced'])
      expect(control).toContain(`expect(after.${field}).toBe(false)`);
    expect(control).not.toMatch(/(?:location\.hash\s*=|history\.(?:replaceState|pushState)\()/);
  });
  it('records input attribution and never restores focus after module release', () => {
    expect(control).toContain("for (const input of ['programmatic', 'keyboard']");
    expect(control).toContain("event.key === 'Tab' && event.isTrusted");
    expect(control).toContain("await page.keyboard.press('Shift+Tab')");
    expect(control).toContain(
      "if (input === 'programmatic') target.focus({ preventScroll: true })"
    );
    const release = control.indexOf('release();');
    const final = control.indexOf('} catch (error)', release);
    expect(release).toBeGreaterThan(control.indexOf('expect(before.focused'));
    expect(control.slice(release, final)).not.toContain('.focus(');
    expect(control).toContain("selectionInput: 'script-created native Range'");
    expect(control).toContain('expect(before.trustedTabCount).toBeGreaterThan(0)');
    expect(control).toContain('selection.focusNode === state.extent');
    expect(control).toContain('selection.focusOffset === state.extentOffset');
  });
  it('runs after a failed original suite and cannot replace its 18 strict passing results', () => {
    const original = workflow.indexOf('report.numPassedTests, 18');
    const diagnostic = workflow.indexOf('name: Isolate native fragment focus');
    const retain = workflow.indexOf('name: Retain exact-source');
    expect(diagnostic).toBeGreaterThan(original);
    expect(workflow.slice(diagnostic, retain)).toContain('if: always()');
    expect(workflow.slice(diagnostic, retain)).toContain('report.numPassedTests, 4');
    expect(workflow.slice(diagnostic, retain)).not.toContain('continue-on-error');
    expect(main).toContain('focused: true');
    expect(main).toContain('await page.waitForFunction(quickStartOwnershipReady)');
    const plan = readFileSync('scripts/test/runtime-test-plan.mjs', 'utf8');
    expect(plan).toContain('quick-start-first-frame-fragment-control.browser.test.ts');
  });
  it('labels no-JS requested preferences separately from fixed dark SSR and captures both targets', () => {
    expect(main).toContain('requestedColorScheme: condition.colorScheme');
    expect(main).toContain(
      "themeCoverage: { dark: actualTheme === 'dark', light: actualTheme === 'light' }"
    );
    expect(main).toContain(
      "const actualTheme = await page.locator('html').getAttribute('data-theme')"
    );
    expect(main).toContain("'actual no-JS theme, independent of requested system preference'");
    expect(main).toContain("expect(reading.fragmentTarget).toBe('_top')");
    expect(main).toContain(
      'expect(reading[key].bottom).toBeLessThanOrEqual(reading.viewport.height)'
    );
    expect(main).toContain('`${name}-document-top`');
    expect(main).toContain('expect(top.geometry.scroll.y).toBe(0)');
    expect(main).toContain('`${name}-menu-open`');
  });
});
