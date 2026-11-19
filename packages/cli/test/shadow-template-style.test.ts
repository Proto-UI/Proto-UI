// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import { createRootStyleEffect, resolveRootStyleEntry } from '@proto.ui/core/internal';
import { run } from '../src/index';
import { renderShadowStyleDelivery } from '../src/services/shadow-style-delivery';
import { renderProtoShadowStyleTokenCss } from '../src/services/proto-style-css';
import { SHADCN_STYLE_TOKENS } from '../src/generated/shadcn-style-tokens';
import { BRUTALIST_STYLE_TOKENS } from '../src/generated/brutalist-style-tokens';
import { createShadowSplitEffectsPort } from '../../adapters/web-component/src/shadow-split-effects';
import { validateShadowStyleArtifact } from '../../adapters/web-component/src/shadow-style-artifact';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function generate(source: string, recipes: Record<string, string> = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'pui-shadow-template-'));
  directories.push(dir);
  await writeFile(path.join(dir, 'fixture.proto.ts'), source);
  for (const [file, content] of Object.entries(recipes)) {
    await writeFile(path.join(dir, file), content);
  }
  await run([
    'tokens',
    '--input',
    dir,
    '--out',
    path.join(dir, 'tokens.css'),
    '--shadow-out',
    path.join(dir, 'shadow.js'),
  ]);
  const module = await readFile(path.join(dir, 'shadow.js'), 'utf8');
  const artifact = validateShadowStyleArtifact(
    JSON.parse(module.match(/const artifact = Object\.freeze\((.+)\);/)![1])
  );
  return { artifact, documentCss: await readFile(path.join(dir, 'tokens.css'), 'utf8') };
}

const template = (tokens: string) => `
  import { definePrototype, tw } from '@proto.ui/core';
  definePrototype({ name: 'template', setup(def) {
    def.feedback.style.use(tw('p-2'));
    return (r) => r.el('span', { style: tw(${JSON.stringify(tokens)}) }, 'content');
  }});
`;

// D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 F/K: Template CSS is not a Root recipe.
describe('source-scanned Shadow Template/Root separation', () => {
  it('keeps reduced-motion Template rules in the host-local environment while preserving document fallback', async () => {
    const tokens = 'dark:motion-reduce:animate-none dark:animate-spin dark:transition-transform';
    const { artifact, documentCss } = await generate(template(tokens));
    const css = artifact.cssText;
    for (const [token, declaration] of [
      ['dark:motion-reduce:animate-none', 'animation: none;'],
      ['dark:animate-spin', 'animation: none;'],
      ['dark:transition-transform', 'transition-property: none;'],
    ]) {
      const selector = `:where(:host([data-pui-color-scheme='dark'])) :where([data-pui-style~="${token}"])`;
      expect(css).toContain(`${selector} {\n      ${declaration}`);
    }
    expect(css).not.toContain(':where(.dark)');
    expect(css).not.toContain('data-theme');
    expect(css).not.toContain('prefers-color-scheme');
    expect(documentCss).toContain(':where(.dark)');
    expect(documentCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(documentCss).toContain('@media (prefers-color-scheme: dark)');
  });

  it.each([
    `const helper = { el(_tag, props) { def.feedback.style.use(props.style); } };
     helper.el('span', { style: tw('p-[10%]') });`,
    `definePrototype({ name: 'helper', setup(def) {
      const helper = { el(_tag, props) { def.feedback.style.use(props.style); } };
      return r => helper.el('span', { style: tw('p-[10%]') });
    }});`,
    `definePrototype({ name: 'escape', setup(def) {
      const escape = style => { def.feedback.style.use(style); return style; };
      return r => r.el('span', { style: escape(tw('p-[10%]')) });
    }});`,
    `const render = r => r.el('span', { style: tw('p-[10%]') });`,
    `otherFactory({ setup(def) { return r => r.el('span', { style: tw('p-[10%]') }); }});`,
    `definePrototype({ name: 'reassigned', setup(def) {
      return r => { r = helper; return r.el('span', { style: tw('p-[10%]') }); };
    }});`,
    `definePrototype({ name: 'shadowed', setup(def) {
      return r => { { const r = helper; return r.el('span', { style: tw('p-[10%]') }); } };
    }});`,
    `definePrototype({ name: 'replaced-method', setup(def) {
      return r => { r.el = helper.el; return r.el('span', { style: tw('p-[10%]') }); };
    }});`,
    `definePrototype({ name: 'escaped-receiver', setup(def) {
      return r => { consume(r); return r.el('span', { style: tw('p-[10%]') }); };
    }});`,
    `definePrototype({ name: 'escaped-node', setup(def) {
      return r => consume(r.el('span', { style: tw('p-[10%]') }));
    }});`,
    `definePrototype({ name: 'wrapped-children', setup(def) {
      return r => r.el('section', {}, consume([r.el('span', { style: tw('p-[10%]') })]));
    }});`,
    `definePrototype({ name: 'helper-parent', setup(def) {
      return r => helper.el('section', {}, r.el('span', { style: tw('p-[10%]') }));
    }});`,
  ])('does not trust helper receivers or escaping style handles: %s', async (source) => {
    await expect(
      generate(`import { definePrototype, tw } from '@proto.ui/core';\n${source}`)
    ).rejects.toThrow(/verified length recipe/);
  });

  it.each(['p-[10%]', 'p-[var(--space)]', 'placeholder:text-muted-foreground'])(
    'keeps Template-only %s in ordinary Shadow CSS without a Root receipt',
    async (token) => {
      const { artifact, documentCss } = await generate(template(token));
      expect(artifact.cssText).toContain(renderProtoShadowStyleTokenCss([token]));
      expect(artifact.cssText).not.toContain(`[data-pui-split-root-style~="${token}"]`);
      expect(artifact.cssText).toContain('[data-pui-split-root-style~="p-2"]');
      expect(documentCss).toContain(`[data-pui-style~="${token}"]`);
    }
  );

  it.each([
    "def.feedback.style.to(target).use(tw('p-[10%]'));",
    "def.rule({when: w => w.state(active).eq(true), intent: i => i.feedback.style.to(target).use(tw('p-[10%]'))});",
    "def.feedback.style.to(target).use(tw('opacity-50'), tw('p-[10%]'));",
    "const paint = tw('p-[10%]'); const alias = paint; def.feedback.style.to(target).use(alias);",
    "const paint = tw('p-[10%]'); def.rule({when: w => w.state(active).eq(true), intent: i => i.feedback.style.to(target).use(paint)});",
    "if (enabled) { def.feedback.style.to(target).use(tw('p-[10%]')); }",
    "for (const variant of [1, 2]) { def.feedback.style.to(target).use(tw('p-[10%]')); }",
    "{ def.feedback.style.to(target).use(tw('p-[10%]')); }",
    "if (enabled) def.rule({when: w => w.state(active).eq(true), intent: i => { if (enabled) i.feedback.style.to(target).use(tw('p-[10%]')); }});",
  ])('compiles targeted decoration paint as Template CSS: %s', async (contribution) => {
    const { artifact, documentCss } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'decoration', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const active = def.state.bool('active', false);
        def.feedback.style.use(tw('p-2'));
        ${contribution}
        return r => [r.decoration(target), r.slot()];
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).toContain('[data-pui-style~="p-[10%]"]');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
    expect(artifact.cssText).toContain('[data-pui-split-root-style~="p-2"]');
    expect(documentCss).toContain('[data-pui-style~="p-[10%]"]');
  });

  it('classifies each verified decoration operation in a Rule intent block', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'decorations-in-rule', setup(def) {
        const track = def.feedback.style.declareDecoration();
        const marker = def.feedback.style.declareDecoration();
        const active = def.state.bool('active', true);
        def.rule({
          when: w => w.state(active).eq(true),
          intent: i => {
            i.feedback.style.to(track).use(tw('p-[10%]'));
            i.feedback.style.to(marker).use(tw('p-[var(--space)]'));
          },
        });
        return r => [r.decoration(track), r.decoration(marker)];
      }});
    `);
    for (const token of ['p-[10%]', 'p-[var(--space)]']) {
      expect(artifact.cssText).toContain(`[data-pui-style~="${token}"]`);
      expect(artifact.cssText).not.toContain(`[data-pui-split-root-style~="${token}"]`);
    }
  });

  it('follows a setup call to a synchronous decoration helper', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      function declareDecoration(definition) {
        const target = definition.feedback.style.declareDecoration();
        definition.feedback.style.to(target).use(tw('p-[10%]'));
        return target;
      }
      definePrototype({ name: 'decoration-helper', setup(def) {
        const target = declareDecoration(def);
        return r => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it('retains Root preflight when a Rule intent receiver is rebound', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'rebound-intent', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const active = def.state.bool('active', true);
        def.rule({
          when: w => w.state(active).eq(true),
          intent: i => {
            i = other;
            i.feedback.style.to(target).use(tw('p-[10%]'));
          },
        });
        return r => r.decoration(target);
      }});
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('keeps a targeted lookalike helper outside proven setup calls unclassified', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      function declareDecoration(definition) {
        const target = definition.feedback.style.declareDecoration();
        definition.feedback.style.to(target).use(tw('p-[10%]'));
        return target;
      }
      declareDecoration(opaque);
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('follows a local synchronous helper that closes over the setup receiver', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'local-decoration-helper', setup(def) {
        function declareDecoration() {
          const target = def.feedback.style.declareDecoration();
          def.feedback.style.to(target).use(tw('p-[10%]'));
          return target;
        }
        const target = declareDecoration();
        return r => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it('retains preflight for a helper with both setup and unknown call sites', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      function declareDecoration(definition) {
        const target = definition.feedback.style.declareDecoration();
        definition.feedback.style.to(target).use(tw('p-[10%]'));
        return target;
      }
      definePrototype({ name: 'shared-decoration-helper', setup(def) {
        const target = declareDecoration(def);
        return r => r.decoration(target);
      }});
      declareDecoration(opaque);
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('retains preflight when Rule intent shadows the declared target', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'shadowed-target', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const active = def.state.bool('active', true);
        def.rule({
          when: w => w.state(active).eq(true),
          intent: i => {
            const target = other;
            i.feedback.style.to(target).use(tw('p-[10%]'));
          },
        });
        return r => r.decoration(target);
      }});
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('classifies targeted Rule styles declared by a verified setup helper', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      function declarePaint(definition) {
        const target = definition.feedback.style.declareDecoration();
        const enabled = definition.state.bool('enabled', true);
        definition.rule({
          when: w => w.state(enabled).eq(true),
          intent: i => i.feedback.style.to(target).use(tw('p-[10%]')),
        });
        return target;
      }
      definePrototype({ name: 'helper-rule', setup(def) {
        const target = declarePaint(def);
        return r => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it('keeps decoration scope when setup retains the targeted use disposer', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'decoration-disposer', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const stop = def.feedback.style.to(target).use(tw('p-[10%]'));
        def.lifecycle.onUnmounted(stop);
        return r => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it('follows a verified setup helper call through a conditional block', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      function declarePaint(definition) {
        const target = definition.feedback.style.declareDecoration();
        definition.feedback.style.to(target).use(tw('p-[10%]'));
        return target;
      }
      definePrototype({ name: 'conditional-helper', setup(def) {
        if (enabled) {
          const decoration = declarePaint(def);
          return r => r.decoration(decoration);
        }
        return r => r.slot();
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it('keeps preflight for a helper called from an unverified nested callback', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      function declarePaint(definition) {
        const target = definition.feedback.style.declareDecoration();
        definition.feedback.style.to(target).use(tw('p-[10%]'));
        return target;
      }
      definePrototype({ name: 'deferred-helper', setup(def) {
        register(() => declarePaint(def));
        return r => r.slot();
      }});
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('follows the proven setup receiver through two synchronous helpers', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      function inner(definition) {
        const target = definition.feedback.style.declareDecoration();
        definition.feedback.style.to(target).use(tw('p-[10%]'));
        return target;
      }
      function outer(definition) { return inner(definition); }
      definePrototype({ name: 'nested-decoration-helpers', setup(def) {
        const target = outer(def);
        return r => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it.each(['(definition) =>', 'function (definition)'])(
    'follows an imported synchronous helper declared as %s',
    async (prefix) => {
      const { artifact } = await generate(
        `
        import { definePrototype } from '@proto.ui/core';
        import { add as prepare } from './paint';
        const delegate = definition => prepare(definition);
        definePrototype({ name: 'function-valued-decoration-helper', setup(def) {
          const target = delegate(def);
          return r => r.decoration(target);
        }});
      `,
        {
          'paint.ts': `
          import { tw } from '@proto.ui/core';
          export const add = ${prefix} {
            const target = definition.feedback.style.declareDecoration();
            definition.feedback.style.to(target).use(tw('p-[10%]'));
            return target;
          };
        `,
        }
      );
      expect(artifact.cssText).toContain('padding: 10%;');
      expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
    }
  );

  it('follows an imported anonymous default setup helper', async () => {
    const { artifact } = await generate(
      `
        import { definePrototype } from '@proto.ui/core';
        import add from './paint';
        definePrototype({ name: 'default-decoration-helper', setup(def) {
          const target = add(def);
          return r => r.decoration(target);
        }});
      `,
      {
        'paint.ts': `
        import { tw } from '@proto.ui/core';
        export default function (definition) {
          const target = definition.feedback.style.declareDecoration();
          definition.feedback.style.to(target).use(tw('p-[10%]'));
          return target;
        }
      `,
      }
    );
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it.each([
    ['export { paint as exposed };', "import { exposed as add } from './fixture.proto';"],
    ['export default paint;', "import add from './fixture.proto';"],
  ])('retains preflight for an opaque consumer of %s', async (exported, imported) => {
    await expect(
      generate(
        `
      import { definePrototype, tw } from '@proto.ui/core';
      function paint(definition) {
        const target = definition.feedback.style.declareDecoration();
        definition.feedback.style.to(target).use(tw('p-[10%]'));
        return target;
      }
      definePrototype({ name: 'export-list-helper', setup(def) {
        const target = paint(def);
        return r => r.decoration(target);
      }});
      ${exported}
    `,
        { 'other.ts': imported + ' register(add);' }
      )
    ).rejects.toThrow(/verified length recipe/);
  });

  it.each([
    ['function paint(i) { i.feedback.style.to(target).use(tw("p-[10%]")); }', 'intent: paint'],
    ['const paint = (i) => i.feedback.style.to(target).use(tw("p-[10%]"));', 'intent: (paint)'],
    ['function intent(i) { i.feedback.style.to(target).use(tw("p-[10%]")); }', 'intent'],
  ])('classifies a locally referenced Rule intent', async (declaration, intent) => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'referenced-rule-intent', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const active = def.state.bool('active', true);
        ${declaration}
        def.rule({ when: w => w.state(active).eq(true), ${intent} });
        return r => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it('retains preflight when a referenced Rule intent also escapes', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'escaped-rule-intent', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const active = def.state.bool('active', true);
        function paint(i) { i.feedback.style.to(target).use(tw('p-[10%]')); }
        def.rule({ when: w => w.state(active).eq(true), intent: paint });
        expose(paint);
        return r => r.decoration(target);
      }});
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('classifies a method-shorthand Rule intent as targeted paint', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'method-intent-decoration', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const active = def.state.bool('active', true);
        def.rule({
          when: w => w.state(active).eq(true),
          intent(i) { i.feedback.style.to(target).use(tw('p-[10%]')); },
        });
        return r => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it.each([
    ['def.rule(spec);', false],
    ['consume(spec); def.rule(spec);', true],
    ['spec.intent = opaque; def.rule(spec);', true],
  ])('tracks a local Rule spec only through its verified uses: %s', async (use, escaped) => {
    const result = generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'referenced-rule-spec', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const active = def.state.bool('active', true);
        const spec = {
          when: w => w.state(active).eq(true),
          intent(i) { i.feedback.style.to(target).use(tw('p-[10%]')); },
        };
        ${use}
        return r => r.decoration(target);
      }});
    `);
    if (escaped) {
      await expect(result).rejects.toThrow(/verified length recipe/);
      return;
    }
    const { artifact } = await result;
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it.each([
    ['paint(def, target);', false],
    ['paint(def, target); useElsewhere(paint);', true],
    ['paint(def, target); paint(def, opaque);', true],
    ['paint(...args, target);', true],
  ])(
    'tracks explicit decoration target arguments at proven helper calls: %s',
    async (use, escaped) => {
      const result = generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      function paint(receiver, leaf) {
        receiver.feedback.style.to(leaf).use(tw('p-[10%]'));
      }
      definePrototype({ name: 'explicit-decoration-helper-target', setup(def) {
        const target = def.feedback.style.declareDecoration();
        ${use}
        return r => r.decoration(target);
      }});
    `);
      if (escaped) {
        await expect(result).rejects.toThrow(/verified length recipe/);
        return;
      }
      const { artifact } = await result;
      expect(artifact.cssText).toContain('padding: 10%;');
      expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
    }
  );

  it.each([
    ['paint(def, target);', false],
    ['paint(def, target); escape(def);', true],
  ])('checks Rule spec and helper receiver use together: %s', async (calls, escaped) => {
    const result = generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      function paint(receiver, leaf) {
        receiver.feedback.style.to(leaf).use(tw('p-[10%]'));
      }
      function escape(receiver) { consume(receiver); }
      definePrototype({ name: 'setup-rule-and-helper', setup(def) {
        const target = def.feedback.style.declareDecoration();
        ${calls}
        const active = def.state.bool('active', false);
        const spec = {
          when: w => w.state(active).eq(true),
          intent(i) { i.feedback.style.to(target).use(tw('p-[10%]')); },
        };
        def.rule(spec);
        return r => r.decoration(target);
      }});
    `);
    if (escaped) {
      await expect(result).rejects.toThrow(/verified length recipe/);
      return;
    }
    const { artifact } = await result;
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it('follows inline spread arrays into the targeted rest argument', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'spread-decoration', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const compact = tw('p-2');
        def.feedback.style.to(target).use(...[...[tw('p-[10%]')], compact]);
        return r => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    for (const token of ['p-[10%]', 'p-2']) {
      expect(artifact.cssText).toContain('[data-pui-style~="' + token + '"]');
      expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="' + token + '"]');
    }
  });

  it('retains preflight when a style handle sits in an unspread nested array', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'unspread-decoration', setup(def) {
        const target = def.feedback.style.declareDecoration();
        def.feedback.style.to(target).use(...[[tw('p-[10%]')]]);
        return r => r.decoration(target);
      }});
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it.each([
    'function paint() { def.feedback.style.to(target).use(tw("p-[10%]")); } paint();',
    'const paint = (receiver) => receiver.feedback.style.to(target).use(tw("p-[10%]")); paint(def);',
  ])('keeps a verified helper paint on its setup-owned target', async (helper) => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'captured-decoration-target', setup(def) {
        const target = def.feedback.style.declareDecoration();
        ${helper}
        return r => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it.each(['spec', '(spec)', '((spec) as typeof spec)', '(spec satisfies typeof spec)'])(
    'classifies decoration paint from a const prototype spec argument: %s',
    async (argument) => {
      const { artifact } = await generate(`
      import { definePrototype as define, tw } from '@proto.ui/core';
      const spec = {
        name: 'const-decoration-spec',
        setup(def) {
          const target = def.feedback.style.declareDecoration();
          def.feedback.style.to(target).use(tw('p-[10%]'));
          return (r) => r.decoration(target);
        },
      };
      define(${argument});
    `);
      expect(artifact.cssText).toContain('padding: 10%;');
      expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
    }
  );

  it.each(['spec.setup = opaque;', 'consume(spec);', 'export { spec };'])(
    'keeps Root preflight for a const prototype spec with an escape: %s',
    async (escape) => {
      await expect(
        generate(`
        import { definePrototype, tw } from '@proto.ui/core';
        const spec = { name: 'const-decoration-spec-escape', setup(def) {
          const target = def.feedback.style.declareDecoration();
          def.feedback.style.to(target).use(tw('p-[10%]'));
          return (r) => r.decoration(target);
        }};
        ${escape}
        definePrototype(spec);
      `)
      ).rejects.toThrow(/verified length recipe/);
    }
  );

  it.each([
    "import { add } from '@app/paint'; add(opaque);",
    "import * as paint from '@app/paint'; paint.add(opaque);",
    "const { add } = await import('@app/paint'); add(opaque);",
  ])(
    'retains Root preflight when a source alias escapes an exported helper: %s',
    async (opaqueUse) => {
      await expect(
        generate(
          `
        import { definePrototype } from '@proto.ui/core';
        import { add } from './paint';
        definePrototype({ name: 'aliased-helper-origin', setup(def) {
          const target = add(def);
          return (r) => r.decoration(target);
        }});
        `,
          {
            'tsconfig.json': JSON.stringify({
              compilerOptions: { paths: { '@app/paint': ['./paint.ts'] } },
            }),
            'paint.ts': `
            import { tw } from '@proto.ui/core';
            export function add(def) {
              const target = def.feedback.style.declareDecoration();
              def.feedback.style.to(target).use(tw('p-[10%]'));
              return target;
            }
          `,
            'other.ts': opaqueUse,
          }
        )
      ).rejects.toThrow(/verified length recipe/);
    }
  );

  it.each([
    "import { leaf } from '@app/palette';",
    "import * as palette from '@app/palette'; const leaf = palette.leaf;",
  ])('keeps Root preflight for a source-aliased style handle: %s', async (importLine) => {
    await expect(
      generate(
        `
      import { definePrototype } from '@proto.ui/core';
      import { leaf } from './palette';
      definePrototype({ name: 'relative-decoration-using-aliased-style', setup(def) {
        const target = def.feedback.style.declareDecoration();
        def.feedback.style.to(target).use(leaf);
        return r => r.decoration(target);
      }});
    `,
        {
          'tsconfig.json': JSON.stringify({
            compilerOptions: { paths: { '@app/palette': ['./palette.ts'] } },
          }),
          'palette.ts': "import { tw } from '@proto.ui/core'; export const leaf = tw('p-[10%]');",
          'other.ts': `
        import { definePrototype } from '@proto.ui/core';
        ${importLine}
        definePrototype({ name: 'root-using-aliased-style', setup(def) {
          def.feedback.style.use(leaf);
          return r => r.el('div', {});
        }});
      `,
        }
      )
    ).rejects.toThrow(/verified length recipe/);
  });

  it('classifies targeted paint from an aliased canonical prototype factory', async () => {
    const { artifact } = await generate(`
      import { definePrototype as define, tw } from '@proto.ui/core';
      define({ name: 'aliased-decoration-factory', setup(def) {
        const target = def.feedback.style.declareDecoration();
        def.feedback.style.to(target).use(tw('p-[10%]'));
        return r => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it.each([
    ['function setup(def) { BODY }', 'setup'],
    ['const configure = (def) => { BODY };', 'setup: configure'],
  ])(
    'classifies decoration paint from a referenced prototype setup',
    async (declaration, property) => {
      const { artifact } = await generate(`
      import { definePrototype as define, tw } from '@proto.ui/core';
      ${declaration.replace(
        'BODY',
        `
        const target = def.feedback.style.declareDecoration();
        def.feedback.style.to(target).use(tw('p-[10%]'));
        return r => r.decoration(target);
      `
      )}
      define({ name: 'referenced-decoration-setup', ${property} });
    `);
      expect(artifact.cssText).toContain('padding: 10%;');
      expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
    }
  );

  it('retains preflight when a referenced setup also escapes to an opaque caller', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      function setup(def) {
        const target = def.feedback.style.declareDecoration();
        def.feedback.style.to(target).use(tw('p-[10%]'));
        return r => r.decoration(target);
      }
      definePrototype({ name: 'escaped-decoration-setup', setup });
      consume(setup);
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('identifies a verified decoration helper receiver after its options argument', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      function add(options, receiver) {
        const target = receiver.feedback.style.declareDecoration();
        receiver.feedback.style.to(target).use(tw('p-[10%]'));
        return target;
      }
      definePrototype({ name: 'indexed-decoration-receiver', setup(def) {
        const target = add({}, def);
        return r => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it('retains preflight when a spread makes the helper receiver index unknown', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      function add(options, receiver) {
        const target = receiver.feedback.style.declareDecoration();
        receiver.feedback.style.to(target).use(tw('p-[10%]'));
        return target;
      }
      definePrototype({ name: 'unknown-decoration-receiver-index', setup(def) {
        const target = add(...options, def);
        return r => r.decoration(target);
      }});
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it.each([
    [
      "import('./paint').then(({ add }) => add(opaque));",
      "export { add as paint } from './paint';",
    ],
    [
      "import('./bridge').then(({ paint }) => paint(opaque));",
      "export { add as paint } from './paint';",
    ],
  ])('retains preflight for a dynamically imported helper escape', async (dynamicUse, bridge) => {
    await expect(
      generate(
        `
      import { definePrototype } from '@proto.ui/core';
      import { add } from './paint';
      definePrototype({ name: 'dynamic-decoration-escape', setup(def) {
        const target = add(def);
        return r => r.decoration(target);
      }});
    `,
        {
          'paint.ts': `
        import { tw } from '@proto.ui/core';
        export function add(def) {
          const target = def.feedback.style.declareDecoration();
          def.feedback.style.to(target).use(tw('p-[10%]'));
          return target;
        }
      `,
          'bridge.ts': bridge,
          'other.ts': dynamicUse,
        }
      )
    ).rejects.toThrow(/verified length recipe/);
  });

  it('retains preflight when a captured-target helper escapes the setup call', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'escaped-decoration-target', setup(def) {
        const target = def.feedback.style.declareDecoration();
        function paint() { def.feedback.style.to(target).use(tw('p-[10%]')); }
        paint();
        expose(paint);
        return r => r.decoration(target);
      }});
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it.each(['(config) => config', 'defineAsHook'])(
    'keeps preflight when a local factory shadows definePrototype with %s',
    async (localFactory) => {
      await expect(
        generate(`
        import { definePrototype, defineAsHook, tw } from '@proto.ui/core';
        {
          const definePrototype = ${localFactory};
          definePrototype({ name: 'lexically-shadowed-producer', setup(def) {
            const target = def.feedback.style.declareDecoration();
            def.feedback.style.to(target).use(tw('p-[10%]'));
            return r => r.decoration(target);
          }});
        }
      `)
      ).rejects.toThrow(/verified length recipe/);
    }
  );

  it.each([
    '(def.feedback.style.declareDecoration())',
    '(def.feedback.style.declareDecoration() as ReturnType<typeof def.feedback.style.declareDecoration>)',
  ])('recognizes the declared decoration through %s', async (initializer) => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'wrapped-decoration-target', setup(def) {
        const target = ${initializer};
        def.feedback.style.to(target).use(tw('p-[10%]'));
        return r => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it('keeps both conditional handle alternatives on the targeted decoration', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'conditional-decoration-handle', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const compact = tw('p-2');
        def.feedback.style.to(target).use(enabled ? (large ? tw('p-[10%]') : compact) : tw('p-4'));
        return r => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    for (const token of ['p-[10%]', 'p-2', 'p-4']) {
      expect(artifact.cssText).toContain('[data-pui-style~="' + token + '"]');
      expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="' + token + '"]');
    }
  });

  it('retains preflight for a handle read by the conditional predicate', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'conditional-handle-predicate', setup(def) {
        const target = def.feedback.style.declareDecoration();
        def.feedback.style.to(target).use(tw('p-[10%]') ? tw('p-2') : tw('p-4'));
        return r => r.decoration(target);
      }});
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('retains preflight when a function-valued helper escapes setup', async () => {
    await expect(
      generate(`
        import { definePrototype, tw } from '@proto.ui/core';
        const add = definition => {
          const target = definition.feedback.style.declareDecoration();
          definition.feedback.style.to(target).use(tw('p-[10%]'));
          return target;
        };
        definePrototype({ name: 'escaping-decoration-helper', setup(def) {
          const target = add(def);
          register(add);
          return r => r.decoration(target);
        }});
      `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it.each(['(def) =>', 'function (def)'])(
    'accepts the canonical function-valued setup form %s',
    async (prefix) => {
      const { artifact } = await generate(`
        import { definePrototype, tw } from '@proto.ui/core';
        definePrototype({ name: 'function-setup', setup: ${prefix} {
          const target = def.feedback.style.declareDecoration();
          def.feedback.style.to(target).use(tw('p-[10%]'));
          return r => r.decoration(target);
        }});
      `);
      expect(artifact.cssText).toContain('padding: 10%;');
      expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
    }
  );

  it('retains preflight when an intermediate helper also has an opaque caller', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      function inner(definition) {
        const target = definition.feedback.style.declareDecoration();
        definition.feedback.style.to(target).use(tw('p-[10%]'));
        return target;
      }
      function outer(definition) { return inner(definition); }
      definePrototype({ name: 'mixed-helper-chain', setup(def) {
        const target = outer(def);
        return r => r.decoration(target);
      }});
      outer(opaque);
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('follows a renamed re-export of a synchronous setup helper', async () => {
    const { artifact } = await generate(
      `
      import { definePrototype } from '@proto.ui/core';
      import { prepare as addDecoration } from './recipe';
      definePrototype({ name: 'exported-decoration-helper', setup(def) {
        const target = addDecoration(def);
        return r => r.decoration(target);
      }});
    `,
      {
        'recipe.ts': "export { declarePaint as prepare } from './paint';",
        'paint.ts': `
        import { tw } from '@proto.ui/core';
        export function declarePaint(def) {
          const target = def.feedback.style.declareDecoration();
          def.feedback.style.to(target).use(tw('p-[10%]'));
          return target;
        }
      `,
      }
    );
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it('retains preflight for an exported helper with an opaque caller elsewhere', async () => {
    await expect(
      generate(
        `
      import { definePrototype } from '@proto.ui/core';
      import { declarePaint } from './paint';
      definePrototype({ name: 'mixed-external-helper', setup(def) {
        const target = declarePaint(def);
        return r => r.decoration(target);
      }});
    `,
        {
          'paint.ts': `
        import { tw } from '@proto.ui/core';
        export function declarePaint(def) {
          const target = def.feedback.style.declareDecoration();
          def.feedback.style.to(target).use(tw('p-[10%]'));
          return target;
        }
      `,
          'other.ts': "import { declarePaint } from './paint'; declarePaint(opaque);",
        }
      )
    ).rejects.toThrow(/verified length recipe/);
  });

  it('keeps the original target identity when passing an immutable alias to style and render', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'aliased-decoration', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const alias = target;
        const second = alias;
        def.feedback.style.to(second).use(tw('p-[10%]'));
        return r => r.decoration(second);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it('retains preflight when an alias shadows the declared target', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'shadowed-alias', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const alias = target;
        {
          const target = opaque;
          const alias = target;
          def.feedback.style.to(alias).use(tw('p-[10%]'));
        }
        return r => r.decoration(alias);
      }});
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('follows a renamed imported recipe handle into the targeted argument', async () => {
    const { artifact } = await generate(
      `
      import { definePrototype } from '@proto.ui/core';
      import { sharedPaint as paint } from './recipe';
      definePrototype({ name: 'imported-decoration', setup(def) {
        const target = def.feedback.style.declareDecoration();
        def.feedback.style.to(target).use(paint);
        return r => r.decoration(target);
      }});
    `,
      {
        'recipe.ts': "export { paint as sharedPaint } from './palette';",
        'palette.ts': "import { tw } from '@proto.ui/core'; export const paint = tw('p-[10%]');",
      }
    );
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it.each(['./recipes', './palette'])(
    'withdraws targeted-only proof for a dynamic style handle import from %s',
    async (moduleName) => {
      await expect(
        generate(
          `
        import { definePrototype } from '@proto.ui/core';
        import { paint } from './palette';
        const { paint: rootPaint } = await import('${moduleName}');
        definePrototype({ name: 'dynamically-shared-decoration', setup(def) {
          const target = def.feedback.style.declareDecoration();
          def.feedback.style.to(target).use(paint);
          def.feedback.style.use(rootPaint);
          return r => r.decoration(target);
        }});
        `,
          {
            'recipes.ts': "export { paint } from './palette';",
            'palette.ts':
              "import { tw } from '@proto.ui/core'; export const paint = tw('p-[10%]');",
          }
        )
      ).rejects.toThrow(/verified length recipe/);
    }
  );

  it('classifies a const shorthand decoration palette member', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'shorthand-decoration-palette', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const leaf = tw('p-[10%]');
        const styles = { leaf };
        def.feedback.style.to(target).use(styles.leaf);
        return (r) => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it('classifies decoration handles spread from a readonly tuple', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'tuple-decoration-paint', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const leaf = tw('p-[15%]');
        const paints = [tw('p-[10%]'), leaf] as const;
        def.feedback.style.to(target).use(...paints);
        return (r) => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).toContain('padding: 15%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[15%]"]');
  });

  it.each([
    '(paints as any)[0] = opaque;',
    'consume(paints);',
    'def.feedback.style.use(...paints);',
  ])('keeps Root preflight for a readonly tuple with an unverified use: %s', async (otherUse) => {
    await expect(
      generate(`
        import { definePrototype, tw } from '@proto.ui/core';
        definePrototype({ name: 'tuple-decoration-escape', setup(def) {
          const target = def.feedback.style.declareDecoration();
          const paints = [tw('p-[10%]')] as const;
          ${otherUse}
          def.feedback.style.to(target).use(...paints);
          return (r) => r.decoration(target);
        }});
      `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('keeps Root preflight for a stable dynamic style import specifier', async () => {
    await expect(
      generate(
        `
      import { definePrototype } from '@proto.ui/core';
      import { paint } from './palette';
      const palettePath = './palette';
      const { paint: rootPaint } = await import(palettePath);
      definePrototype({ name: 'dynamic-style-identifier', setup(def) {
        const target = def.feedback.style.declareDecoration();
        def.feedback.style.to(target).use(paint);
        def.feedback.style.use(rootPaint);
        return r => r.decoration(target);
      }});
    `,
        {
          'palette.ts': "import { tw } from '@proto.ui/core'; export const paint = tw('p-[10%]');",
        }
      )
    ).rejects.toThrow(/verified length recipe/);
  });

  it('classifies decoration handles stored in immutable object members', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'member-decoration-paint', setup(def) {
        const target = def.feedback.style.declareDecoration();
        const styles = { leaf: tw('p-[10%]') };
        def.feedback.style.to(target).use(styles.leaf);
        return (r) => r.decoration(target);
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it.each(
    ['leaf: tw("p-[10%]")', 'leaf'].flatMap((member) =>
      ['styles.leaf = opaque;', 'consume(styles);', 'def.feedback.style.use(styles.leaf);'].map(
        (otherUse) => [member, otherUse]
      )
    )
  )(
    'keeps Root preflight when an object-held handle is unproven: %s / %s',
    async (member, otherUse) => {
      await expect(
        generate(`
        import { definePrototype, tw } from '@proto.ui/core';
        definePrototype({ name: 'member-decoration-escape', setup(def) {
          const target = def.feedback.style.declareDecoration();
          ${member === 'leaf' ? "const leaf = tw('p-[10%]');" : ''}
          const styles = { ${member} };
          ${otherUse}
          def.feedback.style.to(target).use(styles.leaf);
          return (r) => r.decoration(target);
        }});
      `)
      ).rejects.toThrow(/verified length recipe/);
    }
  );

  it('classifies a known namespace member used only for decoration paint', async () => {
    const { artifact } = await generate(
      `
      import { definePrototype } from '@proto.ui/core';
      import * as styles from './palette';
      definePrototype({ name: 'namespace-decoration-paint', setup(def) {
        const target = def.feedback.style.declareDecoration();
        def.feedback.style.to(target).use(styles['paint']);
        return (r) => r.decoration(target);
      }});
      `,
      {
        'palette.ts': "import { tw } from '@proto.ui/core'; export const paint = tw('p-[10%]');",
      }
    );
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it('withdraws targeted-only proof for Root paint through a namespace import', async () => {
    await expect(
      generate(
        `
        import { definePrototype } from '@proto.ui/core';
        import { paint } from './palette';
        definePrototype({ name: 'named-decoration-paint', setup(def) {
          const target = def.feedback.style.declareDecoration();
          def.feedback.style.to(target).use(paint);
          return (r) => r.decoration(target);
        }});
        `,
        {
          'palette.ts': "import { tw } from '@proto.ui/core'; export const paint = tw('p-[10%]');",
          'root.ts': `
            import { definePrototype } from '@proto.ui/core';
            import * as styles from './palette';
            definePrototype({ name: 'namespace-root-paint', setup(def) {
              def.feedback.style.use(styles.paint);
              return (r) => r.slot();
            }});
          `,
        }
      )
    ).rejects.toThrow(/verified length recipe/);
  });

  it.each([
    'def.feedback.style.use(paint);',
    'consume(paint);',
    "const unrelated = tw('p-[10%]');",
  ])('keeps the Root preflight when a targeted handle has another use: %s', async (otherUse) => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'shared-decoration', setup(def) {
        const paint = tw('p-[10%]');
        const target = def.feedback.style.declareDecoration();
        def.feedback.style.to(target).use(paint);
        ${otherUse}
        return r => r.decoration(target);
      }});
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('still preflights tokens independently used on Root and an owned decoration', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'root-and-decoration', setup(def) {
        const target = def.feedback.style.declareDecoration();
        def.feedback.style.to(target).use(tw('p-[10%]'));
        def.feedback.style.use(tw('p-[10%]'));
        return r => r.decoration(target);
      }});
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('retains preflight for an unverified nested callback inside setup control flow', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'opaque-nested-callback', setup(def) {
        const target = def.feedback.style.declareDecoration();
        if (enabled) register(() => {
          def.feedback.style.to(target).use(tw('p-[10%]'));
        });
        return r => r.decoration(target);
      }});
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('treats lookalike targeted calls with a rebound receiver as unclassified', async () => {
    await expect(
      generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'lookalike', setup(def) {
        const target = def.feedback.style.declareDecoration();
        def = other;
        def.feedback.style.to(target).use(tw('p-[10%]'));
        return r => r.decoration(target);
      }});
    `)
    ).rejects.toThrow(/verified length recipe/);
  });

  it('accepts a direct single-return renderer without writes', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'simple-return', setup(def) {
        return r => { return r.el('span', { style: tw('p-[10%]') }); };
      }});
    `);
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).not.toContain('[data-pui-split-root-style~="p-[10%]"]');
  });

  it('accepts literal arrays and same-renderer nested children without opaque wrappers', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      definePrototype({ name: 'nested-array', setup(def) {
        return r => [
          r.el('section', {}, [
            r.el('span', { style: tw('p-[10%]') }),
            r.el('div', r.el('span', { style: tw('p-[var(--space)]') })),
          ]),
          r.el('input', { style: tw('placeholder:text-muted-foreground') }),
        ]);
      }});
    `);
    for (const token of ['p-[10%]', 'p-[var(--space)]', 'placeholder:text-muted-foreground']) {
      expect(artifact.cssText).toContain(`[data-pui-style~="${token}"]`);
      expect(artifact.cssText).not.toContain(`[data-pui-split-root-style~="${token}"]`);
    }
    expect(artifact.cssText).toContain('padding: 10%;');
    expect(artifact.cssText).toContain('padding: var(--space);');
    expect(artifact.cssText).toContain('::placeholder');
  });

  it('does not turn Template membership into runtime Root admission', async () => {
    const { artifact } = await generate(template('p-4'));
    const document = new Window().document as unknown as Document;
    const host = document.createElement('x-template-receipt');
    const surface = document.createElement('div');
    host.attachShadow({ mode: 'open' }).append(surface);
    const effects = createShadowSplitEffectsPort({
      host,
      surface,
      artifact,
      prototypeName: 'test',
    });
    const effect = (token: string) =>
      createRootStyleEffect([resolveRootStyleEntry(token, 'runtime')]);
    try {
      effects.queueStyle(effect('p-2'));
      effects.requestFlush();
      const before = [host.outerHTML, surface.outerHTML];
      expect(() => effects.queueStyle(effect('p-4'))).toThrow(/missing token/);
      effects.requestFlush();
      expect([host.outerHTML, surface.outerHTML]).toEqual(before);
    } finally {
      effects.dispose();
    }
  });

  it('renders shared tokens on both targets without resetting Template composed properties', async () => {
    const { artifact } = await generate(template('p-2 shadow-sm translate-y-px'));
    const css = artifact.cssText;
    expect(css).toContain('[data-pui-split-root-style~="p-2"]');
    expect(css).toContain(':where([data-pui-style~="p-2"])');
    expect(css).not.toContain('[data-pui-split-root-style~="translate-y-px"]');
    expect(css.lastIndexOf('--pui-translate-y: initial;')).toBeLessThan(
      css.indexOf(':where([data-pui-style~="translate-y-px"])')
    );
    expect(css.lastIndexOf('--pui-shadow: initial;')).toBeLessThan(
      css.indexOf(':where([data-pui-style~="shadow-sm"])')
    );
  });

  it('renders an unclassified reusable Template style handle on both targets', async () => {
    const { artifact } = await generate(`
      import { definePrototype, tw } from '@proto.ui/core';
      const labelStyle = tw('text-sm');
      definePrototype({ name: 'template-handle', setup(def) {
        def.feedback.style.use(tw('p-2'));
        return r => r.el('span', { style: labelStyle }, 'Label');
      }});
    `);

    expect(artifact.cssText).toContain('[data-pui-split-root-style~="text-sm"]');
    expect(artifact.cssText).toContain(':where([data-pui-style~="text-sm"])');
  });

  it('keeps lowered Root conditions when the same physical token also occurs in a Template', async () => {
    const { artifact } = await generate(
      template('dark:p-4') +
        `
      def.rule({ when: w => w.meta('colorScheme').eq('dark'),
        intent: i => i.feedback.style.use(tw('p-4')) });
    `
    );
    expect(artifact.cssText).toContain('[data-pui-split-root-style~="dark:p-4"]');
    expect(artifact.cssText).toContain(':where([data-pui-style~="dark:p-4"])');
  });

  it.each([
    `def.feedback.style.use(tw('p-[10%]'));`,
    `def.rule({ when: w => w.meta('colorScheme').eq('dark'), intent: i => i.feedback.style.use(tw('p-[10%]')) });`,
    `run.feedback.style.patch(tw('p-[10%]'));`,
    `const unclassified = tw('p-[10%]');`,
    `const unrelated = { style: tw('p-[10%]') };`,
  ])('retains fail-closed Root or unclassified use: %s', async (use) => {
    await expect(generate(template('p-[10%]') + use)).rejects.toThrow(/verified length recipe/);
  });

  it('keeps unclassified flat delivery conservative, including preset-style closures', () => {
    for (const token of ['p-[10%]', 'md:p-4']) {
      expect(() => renderShadowStyleDelivery(['p-2', token], 'artifact')).toThrow(
        /verified length recipe|unsupported condition/
      );
    }
    // Non-color `placeholder:` payloads are outside the finite vocabulary:
    // they are reported unsupported rather than rendered as ::placeholder CSS.
    const placeholder = renderShadowStyleDelivery(['p-2', 'placeholder:p-4'], 'artifact');
    expect(placeholder.documentCss).toContain('placeholder:p-4');
    expect(placeholder.documentCss).toContain('Unsupported Proto UI style tokens');
    expect(placeholder.documentCss).not.toContain('::placeholder {');
  });

  it.each([
    ['shadcn', SHADCN_STYLE_TOKENS],
    ['brutalist', BRUTALIST_STYLE_TOKENS],
  ] as const)('preserves the actual %s preset command output', async (preset, tokens) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'pui-shadow-template-preset-'));
    directories.push(dir);
    await run([preset, '--styles-dir', dir, '--shadow-out', path.join(dir, 'shadow.js')]);
    const expected = renderShadowStyleDelivery(tokens, 'protoShadowStyleArtifact');
    const artifact = JSON.parse(
      expected.shadowModule.match(/const artifact = Object\.freeze\((.+)\);/)![1]
    );
    expect(artifact.cssText).toContain(':where([data-pui-style~="block"])');
    expect(await readFile(path.join(dir, 'shadow.js'), 'utf8')).toBe(expected.shadowModule);
    expect(await readFile(path.join(dir, 'shadow.d.ts'), 'utf8')).toBe(expected.shadowDeclaration);
    expect(await readFile(path.join(dir, 'proto-ui-tokens.generated.css'), 'utf8')).toBe(
      expected.documentCss
    );
  });
});
