// @vitest-environment node
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(new URL('./brutalist-spinner.capture.mts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('capture.mts', source, ts.ScriptTarget.Latest, true);
const callbacks: string[] = [];
let rgbSource = '';
function visit(node: ts.Node): void {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ['evaluate', 'evaluateAll'].includes(node.expression.name.text)
  ) {
    callbacks.push(node.arguments[0]!.getText(parsed));
  }
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'rgb') {
    rgbSource = node.initializer!.getText(parsed);
  }
  ts.forEachChild(node, visit);
}
visit(parsed);

describe('Spinner evidence browser-function serialization', () => {
  it('parses only supported RGB colors and keeps unknown or translucent facts unmeasured', () => {
    const module = { exports: undefined as unknown };
    vm.runInNewContext(
      transformSync(`module.exports = ${rgbSource}`, {
        loader: 'ts',
        target: 'es2022',
        keepNames: true,
      }).code,
      { module }
    );
    const parse = module.exports as (color: string) => unknown;
    expect(parse('rgb(40, 50, 60)')).toEqual({ channels: [40, 50, 60], alpha: 1 });
    expect(parse('rgba(0, 0, 0, 0)')).toEqual({ channels: [0, 0, 0], alpha: 0 });
    expect(parse('rgba(40, 50, 60, 0.5)')).toEqual({ channels: [40, 50, 60], alpha: 0.5 });
    for (const color of [
      'oklch(1 0 0)',
      'color(srgb 1 1 1)',
      'rgb(100% 100% 100%)',
      'rgb(256, 0, 0)',
      'rgba(0, 0, 0, 2)',
      'rgb(.., 0, 0)',
      'transparent',
    ]) {
      expect(parse(color), color).toBeNull();
    }
  });

  it('keeps every page callback independent of tsx keepNames helpers', () => {
    expect(callbacks).toHaveLength(3);
    for (const callback of callbacks) {
      const transformed = transformSync(`module.exports = ${callback}`, {
        loader: 'ts',
        target: 'es2022',
        keepNames: true,
      }).code;
      const module = { exports: undefined as unknown };
      vm.runInNewContext(transformed, { module });
      const serialized = String(module.exports);
      expect(serialized).not.toContain('__name');
      // Parse the serialized page function in a fresh realm with no Node helper.
      expect(typeof vm.runInNewContext(`(${serialized})`)).toBe('function');
    }
  });

  it('executes style measurement in an isolated page realm after keepNames compilation', () => {
    const transformed = transformSync(`module.exports = ${callbacks[0]}`, {
      loader: 'ts',
      target: 'es2022',
      keepNames: true,
    }).code;
    const module = { exports: undefined as unknown };
    vm.runInNewContext(transformed, { module });
    const style = { color: 'rgb(0, 0, 0)', backgroundColor: 'rgb(255, 255, 255)' };
    const measure = vm.runInNewContext(`(${String(module.exports)})`, {
      getComputedStyle: () => style,
    });
    const result = measure([{ parentElement: null, getAttribute: () => null }]);
    expect(result[0].color).toBe(style.color);
    expect(result[0].backgroundColors).toEqual([style.backgroundColor]);
  });
});
