import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
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
    expect(control).toContain("() => page.keyboard.press('Tab')");
    expect(control).not.toContain("page.keyboard.press('Shift+Tab')");
    expect(control).toMatch(
      /if \(input === 'programmatic'\) \{\s*state\.selectCode\(\);\s*target\.focus\(\{ preventScroll: true \}\);/
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

// Execute the exact snippets used by the native lane, not a test-local
// approximation of its policy or acceptance predicate. These are deterministic
// evidence-logic controls and do not claim native CSP/browser execution.
function snippet(start: string, end: string) {
  const value = control.split(`// ${start}\n`)[1]?.split(`// ${end}`)[0];
  if (!value) throw new Error(`Missing native diagnostic snippet: ${start}`);
  return transformSync(value, { loader: 'ts' }).code;
}
const policy = "script-src 'self'; script-src-attr 'none'";
const headerCode = snippet(
  'fragment-control-response-headers-start',
  'fragment-control-response-headers-end'
);
const evaluateHeaders = (code = headerCode) =>
  new Function('response', 'inlineScriptPolicy', `${code}\nreturn headers;`)(
    {
      headers: () => ({
        'content-security-policy': "default-src 'self'",
        'content-type': 'text/html',
      }),
    },
    policy
  );
const observedEnforcement = new Function(
  'before',
  'inlineScriptPolicy',
  `${snippet('enforced-inline-policy-observation-start', 'enforced-inline-policy-observation-end')}\nreturn enforcedInlineBlock;`
) as (before: { inlinePolicyViolations: Record<string, unknown>[] }, policy: string) => boolean;
const enforcedEvent = {
  disposition: 'enforce',
  effectiveDirective: 'script-src-elem',
  originalPolicy: policy,
  blockedURI: 'inline',
};

describe('actual native diagnostic CSP admission (no browser)', () => {
  it('sets an enforced response policy while preserving the original policy and other headers', () => {
    expect(evaluateHeaders()).toEqual({
      'content-security-policy': `default-src 'self', ${policy}`,
      'content-type': 'text/html',
    });
  });
  it('rejects moving the actual response policy into a report-only header', () => {
    const mutated = headerCode.replace(
      /(["'])content-security-policy\1:/,
      '"content-security-policy-report-only":'
    );
    expect(mutated).not.toBe(headerCode);
    expect(evaluateHeaders(mutated)['content-security-policy']).not.toBe(
      `default-src 'self', ${policy}`
    );
  });
  it('records all native CSP admission facts without relabeling their disposition', () => {
    for (const field of ['disposition', 'effectiveDirective', 'originalPolicy', 'blockedURI'])
      expect(control).toContain(`${field}: event.${field}`);
    expect(control).toContain(
      "expect(enforcedInlineBlock, 'the browser actually enforced the no-inline policy')"
    );
  });
  it.each(['script-src-elem', 'script-src'])(
    'accepts an enforced matching inline %s violation',
    (effectiveDirective) => {
      expect(
        observedEnforcement(
          { inlinePolicyViolations: [{ ...enforcedEvent, effectiveDirective }] },
          policy
        )
      ).toBe(true);
    }
  );
  it.each([
    ['report-only', { disposition: 'report' }],
    ['missing disposition', { disposition: undefined }],
    ['event-handler-only directive', { effectiveDirective: 'script-src-attr' }],
    ['unrelated directive', { effectiveDirective: 'style-src-elem' }],
    ['unrelated policy', { originalPolicy: "script-src 'none'" }],
    ['external script', { blockedURI: 'https://example.test/script.js' }],
  ])('rejects %s evidence even when the other event fields match', (_name, change) => {
    expect(
      observedEnforcement({ inlinePolicyViolations: [{ ...enforcedEvent, ...change }] }, policy)
    ).toBe(false);
  });
  it('rejects an empty event set', () => {
    expect(observedEnforcement({ inlinePolicyViolations: [] }, policy)).toBe(false);
  });
});
