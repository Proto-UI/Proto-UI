import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanRuleStateReadInventory } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

async function observe(
  options: {
    declarations?: string;
    token?: string;
    setup?: string;
    extra?: Record<string, string>;
    helper?: string;
  } = {}
) {
  const directory = await mkdtemp(path.join(tmpdir(), 'lowered-satisfies-'));
  try {
    const files = {
      'state.ts': `import { defineAsHook } from '@proto.ui/core';
export const asChecked = defineAsHook({ name: 'as-checked',
  setup(def) { const checked = def.state.bool('checked', false);
    def.expose.state('checked', checked); return { stateHandles: { checked } }; } });`,
      ...(options.extra ?? {}),
      ...(options.helper ? { 'paint.ts': options.helper } : {}),
      'entry.proto.ts': `import { definePrototype, tw } from '@proto.ui/core';
import { asChecked } from './state';
${options.helper ? "import { paint } from './paint';" : ''}
${options.declarations ?? ''}
export default definePrototype({ name: 'satisfies-consumer', setup(def) {
  const state = asChecked().stateHandles;
  ${options.setup ?? ''}
  ${
    options.helper
      ? 'paint(def, state);'
      : `def.rule({
    when: w => w.state(state.checked).eq(true),
    intent: i => i.feedback.style.use(tw(${options.token ?? 'TOKENS'})),
  });`
  }
} });`,
    };
    for (const [name, text] of Object.entries(files))
      await writeFile(path.join(directory, name), text);
    const file = path.join(directory, 'entry.proto.ts');
    const inventory = scanRuleStateReadInventory([file]);
    return {
      unresolved: inventory.evaluated.flatMap((row) => row.unresolved),
      usages: inventory.evaluated.flatMap((row) => row.usages.map(({ state }) => state)),
      tokens: await collectProtoStyleTokensFromFiles([file]),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('transparent satisfies expressions in lowered token evidence', () => {
  it.each([
    ['inline', { token: "'bg-primary' satisfies string" }],
    ['scalar binding', { declarations: "const TOKENS = 'bg-primary' satisfies string;" }],
    [
      'nested transparent wrappers',
      { declarations: "const TOKENS = ((('bg-primary' as const) satisfies string) as string);" },
    ],
    ['array element', { token: "(['bg-primary' satisfies string] as const).join(' ')" }],
    [
      'literal computed map member',
      {
        declarations:
          "const TOKENS = { ready: 'bg-primary' } as const satisfies Record<string, string>;",
        token: "TOKENS['ready']",
      },
    ],
    [
      'relative imported scalar',
      {
        declarations: "import { TOKENS } from './tokens';",
        extra: { 'tokens.ts': "export const TOKENS = 'bg-primary' satisfies string;" },
      },
    ],
  ] as const)('matches the collector for %s', async (_name, options) => {
    const observed = await observe(options);
    expect(observed.tokens).toContain('data-[checked]:bg-primary');
    expect(observed.unresolved).toEqual([]);
    expect(observed.usages).toEqual(['checked']);
  });

  it.each([
    [
      'unknown initializer',
      { declarations: 'declare const external: string; const TOKENS = external satisfies string;' },
    ],
    [
      'reassigned binding',
      {
        declarations: 'declare const external: string;',
        setup: "let TOKENS = 'bg-primary' satisfies string; TOKENS = external;",
      },
    ],
    [
      'same-name shadow',
      {
        declarations:
          "const TOKENS = 'bg-primary' satisfies string; declare const external: string;",
        setup: 'const TOKENS = external satisfies string;',
      },
    ],
    ['cyclic binding', { declarations: 'const TOKENS = TOKENS satisfies string;' }],
  ] as const)('keeps %s unresolved', async (_name, options) => {
    const observed = await observe(options);
    expect(observed.unresolved.map((miss) => miss.reason)).toEqual(['intent']);
    expect(observed.tokens).not.toContain('data-[checked]:bg-primary');
  });

  it.each([
    [
      'unwrapped unknown map key',
      {
        declarations: "const TOKENS = { ready: 'bg-primary' }; declare const key: string;",
        token: 'TOKENS[key]',
      },
    ],
    [
      'inherited map member',
      {
        declarations: "const TOKENS = { ready: 'bg-primary' } satisfies Record<string, string>;",
        token: "TOKENS['__proto__']",
      },
    ],
    [
      'unknown map key',
      {
        declarations:
          "const TOKENS = { ready: 'bg-primary' } as const satisfies Record<string, string>; declare const key: string;",
        token: 'TOKENS[key]',
      },
    ],
    [
      'getter member',
      {
        declarations:
          "const TOKENS = { get ready() { return 'bg-primary'; } } satisfies Record<string, string>;",
        token: 'TOKENS.ready',
      },
    ],
    [
      'unknown spread',
      {
        declarations:
          "declare const external: Record<string, string>; const TOKENS = { ready: 'bg-primary', ...external } satisfies Record<string, string>;",
        token: 'TOKENS.ready',
      },
    ],
    [
      'unknown member write',
      {
        setup:
          "const TOKENS = { ready: 'bg-primary' } satisfies Record<string, string>; TOKENS.ready = external;",
        declarations: 'declare const external: string;',
        token: 'TOKENS.ready',
      },
    ],
    [
      'imported mutable object',
      {
        declarations: "import { TOKENS } from './tokens';",
        token: 'TOKENS.ready',
        extra: {
          'tokens.ts':
            "export const TOKENS = { ready: 'bg-primary' } satisfies Record<string, string>;",
        },
      },
    ],
  ] as const)('preserves the private-owner refusal for %s', async (_name, options) => {
    const observed = await observe(options);
    expect(observed.unresolved.map((miss) => miss.reason)).toEqual(['intent']);
    expect(observed.usages).toEqual([]);
  });

  it('does not certify a prototype setter initializer as an own token leaf', async () => {
    const runtime = { __proto__: 'bg-primary' };
    expect(Object.hasOwn(runtime, '__proto__')).toBe(false);
    expect(Object.getPrototypeOf(runtime)).toBe(Object.prototype);
    // A non-object prototype setter value is ignored, including when quoted.
    // Reading the inherited accessor does not return this authored string.
    expect(runtime.__proto__).not.toBe('bg-primary');
    for (const key of ['__proto__', "'__proto__'"]) {
      const observed = await observe({
        declarations: `const TOKENS = { ${key}: 'bg-primary' };`,
        token: "TOKENS['__proto__']",
      });
      expect(observed.unresolved.map((miss) => miss.reason)).toEqual(['intent']);
      expect(observed.usages).toEqual([]);
    }
  });

  it('does not certify a string inherited through a literal prototype setter', async () => {
    const runtime = { __proto__: { ready: 'bg-primary' } };
    expect(Object.hasOwn(runtime, 'ready')).toBe(false);
    expect(Object.getPrototypeOf(runtime).ready).toBe('bg-primary');
    const observed = await observe({
      declarations: "const TOKENS = { __proto__: { ready: 'bg-primary' } };",
      token: "TOKENS['ready']",
    });
    expect(observed.unresolved.map((miss) => miss.reason)).toEqual(['intent']);
    expect(observed.usages).toEqual([]);
  });

  it('records the conservative boundary for a computed own prototype-named key', async () => {
    const runtime = { ['__proto__']: 'bg-primary' };
    expect(Object.hasOwn(runtime, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(runtime)).toBe(Object.prototype);
    expect(runtime.__proto__).toBe('bg-primary');
    const observed = await observe({
      declarations: "const TOKENS = { ['__proto__']: 'bg-primary' };",
      token: "TOKENS['__proto__']",
    });
    // This is real own data and the collector does emit its selector. The
    // existing private-leaf proof does not model computed definition keys;
    // retain that explicit conservative limit in this bounded repair.
    expect(observed.tokens).toContain('data-[checked]:bg-primary');
    expect(observed.unresolved.map((miss) => miss.reason)).toEqual(['intent']);
    expect(observed.usages).toEqual([]);
  });

  it.each([
    ["Reflect.get([], '__proto__')[Symbol.iterator] = function*() { yield 'center'; };"],
    [
      "const arrayPrototype = Reflect.get([], '__proto__'); arrayPrototype[Symbol.iterator] = function*() { yield 'center'; };",
    ],
  ])('does not admit a reflective iterator rewrite: %s', async (poison) => {
    const observed = await observe({
      helper: `import { tw } from '@proto.ui/core';
${poison}
const PAINT = { left: 'bg-lime-500', right: 'bg-amber-500', center: 'text-red-900' }
  as const satisfies Record<string, string>;
export function paint(def, state) {
  for (const row of ['left', 'right'] as const) {
    def.rule({ when: w => w.state(state.checked).eq(true),
      intent: i => i.feedback.style.use(tw(PAINT[row])) });
  }
}`,
    });
    expect(observed.unresolved.map((miss) => miss.reason)).toEqual(['intent', 'intent']);
    // The existing collector only visits the lexical left/right rows; keep
    // the gate's refusal rather than certifying these incomplete selectors.
    expect(observed.tokens).not.toContain('data-[checked]:text-red-900');
  });
});
