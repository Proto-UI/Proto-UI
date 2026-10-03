// @vitest-environment node
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(new URL('./brutalist-spinner.capture.mts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('capture.mts', source, ts.ScriptTarget.Latest, true);
const callbacks: string[] = [];
function visit(node: ts.Node): void {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ['evaluate', 'evaluateAll'].includes(node.expression.name.text)
  ) {
    callbacks.push(node.arguments[0]!.getText(parsed));
  }
  ts.forEachChild(node, visit);
}
visit(parsed);

describe('Spinner evidence browser-function serialization', () => {
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

  it('does not use rounded 8-bit alpha as proof of an opaque foreground or background', () => {
    const module = { exports: undefined as unknown };
    vm.runInNewContext(
      transformSync(`module.exports = ${callbacks[0]}`, {
        loader: 'ts',
        target: 'es2022',
        keepNames: true,
      }).code,
      { module }
    );
    let color = 'rgba(0, 0, 0, 0.999)';
    const style = {
      get color() {
        return color;
      },
      get backgroundColor() {
        return color;
      },
      backgroundImage: 'none',
      opacity: '1',
      filter: 'none',
      backdropFilter: 'none',
      mixBlendMode: 'normal',
    };
    // Controlled model of native alpha quantization, not browser pixel evidence.
    const painter = {
      fillStyle: '',
      fillRect() {},
      clearRect() {},
      getImageData() {
        return { data: new Uint8ClampedArray([0, 0, 0, 255]) };
      },
    };
    const measure = vm.runInNewContext(`(${String(module.exports)})`, {
      getComputedStyle: () => style,
      CSS: { supports: () => true },
      OffscreenCanvas: class {
        getContext() {
          return painter;
        }
      },
    });
    for (color of ['rgba(0, 0, 0, 0.999)', 'oklch(0 0 0 / .999)', 'color(srgb 0 0 0 / 99.9%)']) {
      const [facts] = measure([{ parentElement: null, getAttribute: () => null }]);
      expect(facts.backgroundRgba[3]).toBe(255);
      expect(facts.opaqueForeground).toBe(false);
      expect(facts.opaqueBackground).toBe(false);
    }
    for (color of ['rgb(0, 0, 0)', 'oklch(0 0 0 / 1)', 'color(srgb 0 0 0 / 100%)']) {
      const [facts] = measure([{ parentElement: null, getAttribute: () => null }]);
      expect(facts.opaqueForeground).toBe(true);
      expect(facts.opaqueBackground).toBe(true);
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
    const style = {
      color: 'rgb(0, 0, 0)',
      backgroundColor: 'rgb(255, 255, 255)',
      backgroundImage: 'none',
      opacity: '1',
      filter: 'none',
      backdropFilter: 'none',
      mixBlendMode: 'normal',
    };
    const measure = vm.runInNewContext(`(${String(module.exports)})`, {
      getComputedStyle: () => style,
      CSS: { supports: () => false },
      OffscreenCanvas: class {
        getContext() {
          return null;
        }
      },
    });
    const result = measure([{ parentElement: null, getAttribute: () => null }]);
    expect(result[0].color).toBe(style.color);
    expect(result[0].backgroundColors).toEqual([style.backgroundColor]);
    expect(result[0].foregroundRgba).toBeNull();
    expect(result[0].backgroundRgba).toBeNull();
  });
});
