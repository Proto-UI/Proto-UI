import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultWebMetaGetter,
  createDefaultWebStyleSupportSource,
  readWebStyleSupport,
} from '../src';
describe('finite Web style support facts', () => {
  it('requires the real alpha lowering syntaxes and exact 4px blur syntax', () => {
    const supports = vi.fn(() => true);
    const doc = { defaultView: { CSS: { supports } } } as unknown as Document;
    const getter = createDefaultWebMetaGetter(doc);
    const source = createDefaultWebStyleSupportSource(getter, doc)!;
    expect(source.getter).toBe(getter);
    const invalidate = vi.fn();
    const off = source.subscribe(['styleSupport.alphaFill'], invalidate);
    expect(getter('styleSupport.alphaFill')).toBe(true);
    expect(supports.mock.calls).toEqual([
      ['background-color', 'color-mix(in oklab, rgb(44 44 46) 80%, transparent)'],
      ['background-color', 'color-mix(in oklab, var(--pui-secondary) 80%, transparent)'],
    ]);
    expect(getter('styleSupport.backdropBlur4px')).toBe(true);
    expect(supports).toHaveBeenLastCalledWith('backdrop-filter', 'blur(4px)');
    off();
    off();
    expect(invalidate).not.toHaveBeenCalled();
  });
  it('preserves explicit rejection and unknown for missing/throwing APIs', () => {
    const doc = { defaultView: { CSS: { supports: () => false } } } as unknown as Document;
    expect(readWebStyleSupport(doc, 'styleSupport.alphaFill')).toBe(false);
    expect(readWebStyleSupport(doc, 'styleSupport.backdropBlur4px')).toBe(false);
    expect(readWebStyleSupport(undefined, 'styleSupport.alphaFill')).toBe('unknown');
    expect(
      readWebStyleSupport({ defaultView: null } as Document, 'styleSupport.backdropBlur4px')
    ).toBe('unknown');
    expect(
      createDefaultWebStyleSupportSource(() => true, { defaultView: null } as Document)
    ).toBeUndefined();
    const throwing = {
      defaultView: {
        CSS: {
          supports: () => {
            throw Error('unavailable');
          },
        },
      },
    } as unknown as Document;
    expect(readWebStyleSupport(throwing, 'styleSupport.alphaFill')).toBe('unknown');
    expect(readWebStyleSupport(doc, 'styleSupport.refraction')).toBeUndefined();
  });
});
