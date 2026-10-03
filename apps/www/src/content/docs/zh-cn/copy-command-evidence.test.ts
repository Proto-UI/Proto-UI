import { describe, expect, it } from 'vitest';
import {
  copyPaintIssues,
  copyShadowLayers,
  copySourceBindingIssues,
  type CopyPaint,
} from './copy-command-evidence';

const idle: CopyPaint = {
  width: 32,
  height: 32,
  center: [0, 0],
  glyph: [18, 18],
  background: 'white',
  shadow: 'none',
  expectedRingShadow: 'rgba(100, 100, 100, 0.5) 0px 0px 0px 3px',
  expectedRingOffsetShadow: 'none',
  transform: 'none',
  translate: 'none',
  tokens: '',
  focused: false,
  focusVisible: false,
  hovered: false,
  pressed: false,
};
const brute = {
  ...idle,
  width: 40,
  height: 40,
  shadow: 'rgb(0, 0, 0) 4px 4px 0px 0px',
  expectedRingShadow: 'rgb(23, 23, 23) 0px 0px 0px 4px',
  expectedRingOffsetShadow: 'rgb(255, 255, 255) 0px 0px 0px 2px',
};
const focus = {
  shadcn: {
    ...idle,
    focused: true,
    focusVisible: true,
    shadow: idle.expectedRingShadow,
    tokens: 'data-[focus-visible]:ring-3 data-[focus-visible]:ring-ring/50',
  },
  brutalist: {
    ...brute,
    focused: true,
    focusVisible: true,
    shadow: `rgb(255, 255, 255) 0px 0px 0px 2px, ${brute.expectedRingShadow}, ${brute.shadow}`,
    tokens: 'ring-2 ring-ring ring-offset-2',
  },
};
describe('actual Copy family paint evidence', () => {
  it('accepts state-lowered Shadcn focus tokens and requires their real paint', () => {
    expect(copyPaintIssues('shadcn', idle, focus.shadcn, 'focus')).toEqual([]);
    expect(focus.shadcn.tokens.split(' ').includes('ring-3')).toBe(false);
  });
  it('accepts Brutalist hover +4/+4 and cleared elevation with the same background', () => {
    expect(
      copyPaintIssues(
        'brutalist',
        brute,
        {
          ...brute,
          hovered: true,
          transform: 'matrix(1,0,0,1,4,4)',
          shadow: 'none',
        },
        'hover'
      )
    ).toEqual([]);
  });
  it('requires an actual Shadcn outline hover fill delta', () => {
    expect(
      copyPaintIssues('shadcn', idle, { ...idle, hovered: true, background: 'grey' }, 'hover')
    ).toEqual([]);
    expect(copyPaintIssues('shadcn', idle, { ...idle, hovered: true }, 'hover')).toContain(
      'outline hover fill did not change'
    );
  });
  it.each(['shadcn', 'brutalist'] as const)(
    '%s rejects existing shadows, lost focus, absent state and absent ring recipes',
    (family) => {
      const base = family === 'shadcn' ? idle : brute;
      expect(copyPaintIssues(family, base, focus[family], 'focus')).toEqual([]);
      for (const mutation of [
        { shadow: base.shadow },
        { focused: false },
        { focusVisible: false },
        { tokens: '' },
      ])
        expect(
          copyPaintIssues(family, base, { ...focus[family], ...mutation }, 'focus').length
        ).toBeGreaterThan(0);
    }
  );
  it.each(['shadcn', 'brutalist'] as const)(
    '%s rejects focus tokens when only a hard shadow changes',
    (family) => {
      const base = family === 'shadcn' ? idle : brute;
      expect(
        copyPaintIssues(
          family,
          base,
          {
            ...focus[family],
            shadow: 'rgb(0, 0, 0) 3.5px 3.5px 0px 0px',
          },
          'focus'
        ).length
      ).toBeGreaterThan(0);
    }
  );
  it('rejects background-only Brutalist hover and unchanged hard shadow', () => {
    expect(
      copyPaintIssues('brutalist', brute, { ...brute, hovered: true, background: 'grey' }, 'hover')
    ).toHaveLength(2);
    expect(
      copyPaintIssues(
        'brutalist',
        brute,
        { ...brute, hovered: true, translate: '-1px -1px' },
        'hover'
      )
    ).toContain('Brutalist hover elevation did not clear');
  });
  it.each(['shadcn', 'brutalist'] as const)(
    '%s pressed needs state, applied translation and the recipe',
    (family) => {
      const base = family === 'shadcn' ? idle : brute;
      const press = {
        ...base,
        pressed: true,
        translate: family === 'brutalist' ? '4px 4px' : '1px 1px',
        shadow: 'none',
        tokens:
          family === 'brutalist'
            ? 'translate-x-1 translate-y-1 shadow-none'
            : 'data-[pressed]:translate-y-px',
      };
      expect(copyPaintIssues(family, base, press, 'pressed')).toEqual([]);
      for (const mutation of [{ pressed: false }, { translate: base.translate }, { tokens: '' }])
        expect(
          copyPaintIssues(family, base, { ...press, ...mutation }, 'pressed').length
        ).toBeGreaterThan(0);
    }
  );
  it('keeps Brutalist press at its hovered endpoint and rejects old lift or a doubled press offset', () => {
    const hovered = {
      ...brute,
      hovered: true,
      transform: 'matrix(1, 0, 0, 1, 4, 4)',
      shadow: 'none',
      tokens: 'translate-x-1 translate-y-1 shadow-none',
    };
    expect(copyPaintIssues('brutalist', hovered, { ...hovered, pressed: true }, 'pressed')).toEqual(
      []
    );
    for (const offset of [-1, 1, 8]) {
      const changed = {
        ...hovered,
        pressed: true,
        transform: `matrix(1, 0, 0, 1, ${offset}, ${offset})`,
      };
      expect(copyPaintIssues('brutalist', brute, changed, 'hover')).toContain(
        'Brutalist hover is not +4px/+4px'
      );
      expect(copyPaintIssues('brutalist', hovered, changed, 'pressed')).toContain(
        'Brutalist press is not +4px/+4px'
      );
    }
    expect(
      copyPaintIssues(
        'brutalist',
        brute,
        { ...hovered, shadow: 'rgba(0, 0, 0, 0) 0px 0px 0px 0px' },
        'hover'
      )
    ).toEqual([]);
  });
});
describe('computed ring-layer evidence', () => {
  it('parses layered modern colors without splitting their inner commas/spaces', () => {
    expect(
      copyShadowLayers(
        'rgba(10, 20, 30, 0.5) 0px 0px 0px 3px, oklab(0.5 0 0 / 0.5) 1px 2px 0px 0px'
      )
    ).toEqual([
      { x: 0, y: 0, blur: 0, spread: 3, color: 'rgba(10,20,30,0.5)', inset: false },
      { x: 1, y: 2, blur: 0, spread: 0, color: 'oklab(0.500/0.5)', inset: false },
    ]);
  });
  it.each(['shadcn', 'brutalist'] as const)(
    '%s rejects wrong ring color, width, blur, offset, inset and an already-painted ring',
    (family) => {
      const base = family === 'shadcn' ? idle : brute;
      const spread = family === 'shadcn' ? 3 : 4;
      const color = copyShadowLayers(base.expectedRingShadow)[0].color;
      for (const shadow of [
        `rgb(255, 0, 0) 0px 0px 0px ${spread}px`,
        ` ${color} 0px 0px 0px 8px`,
        `${color} 0px 0px 2px ${spread}px`,
        `${color} 1px 0px 0px ${spread}px`,
        `inset ${base.expectedRingShadow}`,
      ])
        expect(copyPaintIssues(family, base, { ...focus[family], shadow }, 'focus')).toContain(
          'computed family ring color/width layer is absent'
        );
      expect(
        copyPaintIssues(
          family,
          { ...base, shadow: base.expectedRingShadow },
          focus[family],
          'focus'
        )
      ).toContain('ring was already present before focus');
      expect(copyPaintIssues(family, { ...base, hovered: true }, focus[family], 'focus')).toContain(
        'focus comparison is not isolated from other states'
      );
    }
  );
});
describe('Brutalist ring band', () => {
  it('rejects a 4px solid ring without the 2px background offset, and a reversed layer order', () => {
    expect(
      copyPaintIssues(
        'brutalist',
        brute,
        { ...focus.brutalist, shadow: brute.expectedRingShadow },
        'focus'
      )
    ).toContain('Brutalist 2px offset and 2px ring band are absent');
    expect(
      copyPaintIssues(
        'brutalist',
        brute,
        {
          ...focus.brutalist,
          shadow: `${brute.expectedRingShadow}, ${brute.expectedRingOffsetShadow}`,
        },
        'focus'
      )
    ).toContain('Brutalist 2px offset and 2px ring band are absent');
  });
});
describe('ring reference visibility', () => {
  it('accepts opaque black and rejects a fully transparent ring', () => {
    const black = 'rgb(0, 0, 0) 0px 0px 0px 4px';
    expect(
      copyPaintIssues(
        'brutalist',
        brute,
        {
          ...focus.brutalist,
          shadow: `${brute.expectedRingOffsetShadow}, ${black}`,
          expectedRingShadow: black,
        },
        'focus'
      )
    ).toEqual([]);
    const invisible = 'rgba(0, 0, 0, 0) 0px 0px 0px 4px';
    expect(
      copyPaintIssues(
        'brutalist',
        brute,
        { ...focus.brutalist, shadow: invisible, expectedRingShadow: invisible },
        'focus'
      )
    ).toContain('independent family ring reference is invalid');
  });
});
describe('checkout evidence identity', () => {
  const binding = {
    exactSHA: 'a'.repeat(40),
    expectedSHA: 'a'.repeat(40),
    eventSHA: 'b'.repeat(40),
    dirty: false,
  };
  it('records a synthetic event SHA separately without replacing the checkout', () => {
    expect(copySourceBindingIssues(binding, true)).toEqual([]);
  });
  it('rejects event identity substituted for requested checkout', () => {
    expect(copySourceBindingIssues({ ...binding, exactSHA: binding.eventSHA }, true)).toContain(
      'checkout does not match requested candidate'
    );
  });
  it('rejects missing identity and dirty CI evidence', () => {
    expect(copySourceBindingIssues({ ...binding, exactSHA: 'local-unpublished' }, false)).toContain(
      'checkout SHA unavailable'
    );
    expect(copySourceBindingIssues({ ...binding, dirty: true }, true)).toContain(
      'checkout has uncommitted changes'
    );
    expect(copySourceBindingIssues({ ...binding, dirty: true }, false)).toEqual([]);
  });
});
