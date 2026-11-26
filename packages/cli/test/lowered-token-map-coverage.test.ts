import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

type TokenMapFixture = {
  declarations: string;
  argument: string;
  constants?: string;
  tokenModule?: string;
  imports?: readonly string[];
  moduleDeclarations?: string;
  files?: Readonly<Record<string, string>>;
};

const template = (member: string, suffix: string) =>
  String.fromCharCode(96) + '$' + '{' + member + '} ' + suffix + String.fromCharCode(96);

async function observeTokenMap({
  declarations,
  argument,
  constants,
  tokenModule = './tokens',
  imports = [],
  moduleDeclarations = '',
  files = {},
}: TokenMapFixture) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'lowered-token-map-')));
  try {
    const producer = path.join(directory, 'producer.ts');
    const file = path.join(directory, 'consumer.proto.ts');
    await writeFile(
      producer,
      [
        "import { defineAsHook } from '@proto.ui/core';",
        'export const asTokenMapState = defineAsHook({',
        "  name: 'token-map-state',",
        "  setup(def) { def.state.bool('ready', false); },",
        '  projectHandle: (result) => ({ ready: result.stateHandles.ready }),',
        '});',
      ].join('\n')
    );
    if (constants !== undefined) await writeFile(path.join(directory, 'tokens.ts'), constants);
    for (const [name, text] of Object.entries(files))
      await writeFile(path.join(directory, name), text);
    const source = [
      "import { definePrototype, tw } from '@proto.ui/core';",
      "import { asTokenMapState } from './producer';",
      ...(constants === undefined ? [] : ["import { TOKENS } from '" + tokenModule + "';"]),
      ...imports,
      moduleDeclarations,
      'export default definePrototype({',
      "  name: 'token-map-consumer',",
      '  setup(def) {',
      '    const { ready } = asTokenMapState();',
      declarations,
      '    def.rule({',
      '      when: (w) => w.state(ready).eq(true),',
      '      intent: (i) => i.feedback.style.use(tw(' + argument + ')),',
      '    });',
      '  },',
      '});',
    ].join('\n');
    await writeFile(file, source);
    // Assert the actual prefixed collector output, not the unprefixed inventory.
    const tokens = (await collectProtoStyleTokensFromFiles([file])).filter((token) =>
      token.startsWith('data-[ready]:')
    );
    return { scan: scanRuleStateReads(source, file), tokens, producer };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe.sequential('lowered literal token-map coverage agrees with actual collection', () => {
  const literal = "const TOKENS = { active: 'bg-primary' };";
  for (const [name, fixture, expectedTokens] of [
    [
      'literal element control',
      { declarations: literal, argument: "TOKENS['active']" },
      ['bg-primary'],
    ],
    ['literal dot', { declarations: literal, argument: 'TOKENS.active' }, ['bg-primary']],
    [
      'literal dot inside a template',
      { declarations: literal, argument: template('TOKENS.active', 'ring-2') },
      ['bg-primary', 'ring-2'],
    ],
    [
      'literal dot in a variadic tw',
      { declarations: literal, argument: "TOKENS.active, 'ring-2'" },
      ['bg-primary', 'ring-2'],
    ],
    [
      'nested literal dot',
      {
        declarations: "const TOKENS = { palette: { active: 'bg-primary' } };",
        argument: 'TOKENS.palette.active',
      },
      ['bg-primary'],
    ],
    [
      'literal element beside a proven State handle',
      {
        declarations: "const TOKENS = { handle: ready, active: 'bg-primary' };",
        argument: "TOKENS['active']",
      },
      ['bg-primary'],
    ],
    [
      'nested literal dot beside a proven State handle',
      {
        declarations: "const TOKENS = { handle: ready, palette: { active: 'bg-primary' } };",
        argument: 'TOKENS.palette.active',
      },
      ['bg-primary'],
    ],
  ] as const) {
    it(name, async () => {
      const { scan, tokens, producer } = await observeTokenMap(fixture);
      expect(tokens).toEqual(expectedTokens.map((token) => 'data-[ready]:' + token).sort());
      expect(scan.unresolved).toEqual([]);
      expect(scan.exposedLocals).toEqual([]);
      expect(
        scan.usages.map(({ hook, state, provenance }) => ({
          hook,
          state,
          declaredName: provenance?.declaredName,
          owner: provenance?.owner.file,
          declaration: provenance?.declaration.file,
        }))
      ).toEqual([
        {
          hook: 'asTokenMapState',
          state: 'ready',
          declaredName: 'ready',
          owner: producer,
          declaration: producer,
        },
      ]);
    });
  }

  it.each(["controls['className']", 'controls.className'])(
    'retains the actual exposed-State variant for %s in a mixed container',
    async (argument) => {
      const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'lowered-mixed-token-')));
      try {
        const file = path.join(directory, 'mixed.proto.ts');
        const source = [
          "import { definePrototype, tw } from '@proto.ui/core';",
          "export default definePrototype({ name: 'mixed-tokens', setup(def) {",
          "  const flag = def.state.bool('internalFlag', false);",
          "  def.expose.state('visible', flag);",
          "  const controls = { ready: flag, className: 'bg-red' };",
          '  def.rule({',
          '    when: (w) => w.state(controls.ready).eq(true),',
          `    intent: (i) => i.feedback.style.use(tw(${argument})),`,
          '  });',
          '} });',
        ].join('\n');
        await writeFile(file, source);
        const tokens = await collectProtoStyleTokensFromFiles([file]);
        expect(tokens.filter((token) => token.endsWith('bg-red'))).toEqual([
          'bg-red',
          'data-[internal-flag]:bg-red',
        ]);
        const scan = scanRuleStateReads(source, file);
        expect(scan.unresolved).toEqual([]);
        expect(scan.usages).toEqual([]);
        expect(scan.exposedLocals).toEqual([
          { state: 'flag', exposedAs: 'visible', attribute: 'internal-flag' },
        ]);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  );

  for (const [name, declarations, argument, inventory] of [
    ['missing own member', literal, 'TOKENS.missing', []],
    ['primitive receiver', "const TOKENS = 'bg-primary';", 'TOKENS.active', []],
    [
      'getter member',
      "const TOKENS = { get active() { return 'bg-primary'; } };",
      'TOKENS.active',
      [],
    ],
    [
      'opaque spread',
      "const TOKENS = { active: 'bg-primary', ...opaque };",
      'TOKENS.active',
      ['bg-primary'],
    ],
    ['unknown member write', literal + '\nTOKENS.active = getTokens();', 'TOKENS.active', []],
    [
      'owner escapes to unknown code',
      literal + '\nmutate(TOKENS);',
      'TOKENS.active',
      ['bg-primary'],
    ],
    [
      'unknown index before dot',
      "const TOKENS = { palette: { active: 'bg-primary' } };",
      'TOKENS[key].active',
      ['bg-primary'],
    ],
    [
      'a State handle used as token data',
      "const TOKENS = { handle: ready, active: 'bg-primary' };",
      'TOKENS.handle',
      [],
    ],
    [
      'an unknown sibling value',
      "const TOKENS = { handle: foreignHandle, active: 'bg-primary' };",
      'TOKENS.active',
      ['bg-primary'],
    ],
    [
      'a getter beside a proven State handle',
      "const TOKENS = { handle: ready, get active() { return 'bg-primary'; } };",
      'TOKENS.active',
      [],
    ],
    [
      'a mutable mixed owner',
      "let TOKENS = { handle: ready, active: 'bg-primary' };",
      'TOKENS.active',
      ['bg-primary'],
    ],
    [
      'an alias of a mixed owner',
      "const TOKENS = { handle: ready, active: 'bg-primary' }; const alias = TOKENS;",
      'TOKENS.active',
      ['bg-primary'],
    ],
  ] as const) {
    it('withholds complete coverage for ' + name, async () => {
      const { scan, tokens } = await observeTokenMap({ declarations, argument });
      // Known inventory may survive an opaque overwrite or escape. That is not
      // proof that every runtime token is available to the lowered rule.
      expect(tokens).toEqual(inventory.map((token) => 'data-[ready]:' + token).sort());
      expect(scan.usages).toEqual([]);
      expect(scan.exposedLocals).toEqual([]);
      expect(scan.unresolved.map(({ reason }) => reason)).toEqual(['intent']);
    });
  }

  // A relative const object can be changed by another module without passing
  // it to a call here. Inventory is observable; this scanner's private-owner
  // proof deliberately does not certify those shared mutable values.
  for (const [name, fixture, inventory] of [
    [
      'an imported mutable const',
      {
        declarations: '',
        constants: "export const TOKENS = { active: 'bg-primary' };",
        argument: 'TOKENS.active',
      },
      ['bg-primary'],
    ],
    [
      'an imported mutable const in a template',
      {
        declarations: '',
        constants: "export const TOKENS = { active: 'bg-primary' };",
        argument: template('TOKENS.active', 'ring-2'),
      },
      ['bg-primary', 'ring-2'],
    ],
    [
      'a third-module mutator with no token argument',
      {
        declarations: 'mutateTokens();',
        constants: "export const TOKENS = { active: 'bg-primary' };",
        imports: ["import { mutateTokens } from './mutator';"],
        files: {
          'mutator.ts': [
            "import { TOKENS } from './tokens';",
            'export function mutateTokens() { TOKENS.active = getTokens(); }',
          ].join('\n'),
        },
        argument: 'TOKENS.active',
      },
      ['bg-primary'],
    ],
    [
      'an effectful intermediate barrel',
      {
        declarations: '',
        constants: "export const TOKENS = { active: 'bg-primary' };",
        tokenModule: './barrel',
        files: {
          'barrel.ts': [
            "import { TOKENS } from './tokens';",
            'TOKENS.active = getTokens();',
            'export { TOKENS };',
          ].join('\n'),
        },
        argument: 'TOKENS.active',
      },
      ['bg-primary'],
    ],
    [
      'a locally exported const owner',
      {
        declarations: '',
        moduleDeclarations: "export const TOKENS = { active: 'bg-primary' };",
        argument: 'TOKENS.active',
      },
      ['bg-primary'],
    ],
    [
      'a named export of a local owner',
      {
        declarations: '',
        moduleDeclarations:
          "const TOKENS = { active: 'bg-primary' };\nexport { TOKENS as shared };",
        argument: 'TOKENS.active',
      },
      ['bg-primary'],
    ],
    [
      'dynamic lexical execution',
      {
        declarations: literal + '\neval("TOKENS.active = getTokens()");',
        argument: 'TOKENS.active',
      },
      ['bg-primary'],
    ],
    [
      'a nested owner escaping',
      {
        declarations:
          "const TOKENS = { palette: { active: 'bg-primary' } };\nmutate(TOKENS.palette);",
        argument: 'TOKENS.palette.active',
      },
      ['bg-primary'],
    ],
  ] as const) {
    it('withholds complete coverage for ' + name, async () => {
      const { scan, tokens } = await observeTokenMap(fixture);
      expect(tokens).toEqual(inventory.map((token) => 'data-[ready]:' + token).sort());
      expect(scan.usages).toEqual([]);
      expect(scan.exposedLocals).toEqual([]);
      expect(scan.unresolved.map(({ reason }) => reason)).toEqual(['intent']);
    });
  }
});
