// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { renderPrefixedThemeCss } from '../../../cli/src/services/proto-style-css';

it('binds both New York shell measurements to the fixed 10px fixture radius, not the old 8px theme', () => {
  const source = readFileSync(resolve('scripts/prototypes/shadcn-command-evidence.mjs'), 'utf8');
  const workflow = readFileSync(resolve('.github/workflows/shadcn-command-style.yml'), 'utf8');
  const required = [
    ':root{--radius:0.625rem;',
    "assert.equal(r.shell.radius, style === 'rhea' ? '18px' : '8px')",
    "assert.equal(r.shell.radius, '8px')",
    "assert.equal(r.theme.rootFontSize, '16px')",
    "assert.equal(r.theme.rootRadiusToken, '0.625rem')",
    "assert.equal(r.theme.mdRadiusToken, 'max(calc(0.625rem - 2px), 0px)')",
    "rootFontSize: getComputedStyle(document.documentElement).fontSize",
    "rootRadiusToken: ss.getPropertyValue('--pui-radius').trim()",
    "mdRadiusToken: ss.getPropertyValue('--pui-radius-md').trim()",
  ];
  const verify = (candidate: string) => {
    for (const fragment of required) expect(candidate).toContain(fragment);
    expect(candidate).not.toContain("'6px'");
  };
  verify(source);
  for (const fragment of required) expect(() => verify(source.replaceAll(fragment, ''))).toThrow();
  expect(() => verify(source.replace("? '18px' : '8px'", "? '18px' : '6px'"))).toThrow();
  const css = renderPrefixedThemeCss(':root{--radius:0.625rem;}');
  expect(css).toContain('--pui-radius:0.625rem;');
  expect(css).toContain('--pui-radius-md: max(calc(var(--pui-radius) - 2px), 0px);');
  expect(0.625 * 16 - 2).toBe(8);
  expect(0.5 * 16 - 2).toBe(6);
  expect(workflow).toContain('packages/prototypes/shadcn/test/command-evidence-contract.test.ts');
});
