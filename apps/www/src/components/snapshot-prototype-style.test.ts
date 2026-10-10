import { describe, expect, it } from 'vitest';
import { renderProtoStyleTokenCss } from '../../../../packages/cli/src/services/proto-style-css';
import { renderSnapshotTokenCss } from './snapshot-prototype-style';

// Source/CSSOM membership evidence. The native first-frame CI owns the actual
// cascade and pixel result; this reconstructs the offending stylesheet order.
function matchingDeclarations(css: string, element: HTMLElement) {
  const output: Record<string, string> = {};
  for (const rule of css.matchAll(/(:where\([^{}]+\))\s*\{([^{}]*)\}/g)) {
    if (!element.matches(rule[1]!)) continue;
    for (const declaration of rule[2]!.split(';')) {
      const separator = declaration.indexOf(':');
      if (separator < 0) continue;
      output[declaration.slice(0, separator).trim()] = declaration.slice(separator + 1).trim();
    }
  }
  return output;
}

describe('snapshot CSS stays with its exact startup owner', () => {
  it('cannot let a later Button snapshot override another Text explicit leading', () => {
    const text = document.createElement('span');
    text.setAttribute('data-pui-style', 'text-sm leading-normal');
    const canonical = renderProtoStyleTokenCss(['leading-normal', 'text-sm']);
    const unscoped = canonical + renderSnapshotTokenCss(['text-sm']);
    expect(matchingDeclarations(unscoped, text)['line-height']).toBe('1.25rem');
    const scoped = canonical + renderSnapshotTokenCss(['text-sm'], '[data-startup-menu]');
    expect(matchingDeclarations(scoped, text)['line-height']).toBe('1.5');
    text.setAttribute('data-startup-menu', '');
    expect(matchingDeclarations(scoped, text)['line-height']).toBe('1.25rem');
  });

  it('retains token membership, variants, zero specificity and reset-free output', () => {
    const css = renderSnapshotTokenCss(['text-sm', 'disabled:opacity-50'], '[data-snapshot="one"]');
    expect(css).toContain(':where([data-snapshot="one"][data-pui-style~="text-sm"])');
    expect(css).toContain(':where([data-snapshot="one"][data-pui-style~="disabled:opacity-50"])');
    expect(css).toContain(':disabled');
    expect(css).not.toContain('box-sizing: border-box');
    const other = document.createElement('span');
    other.dataset.snapshot = 'two';
    other.setAttribute('data-pui-style', 'text-sm');
    expect(matchingDeclarations(css, other)).toEqual({});
  });
});
