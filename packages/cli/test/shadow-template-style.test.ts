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

async function generate(source: string) {
  const dir = await mkdtemp(path.join(tmpdir(), 'pui-shadow-template-'));
  directories.push(dir);
  await writeFile(path.join(dir, 'fixture.proto.ts'), source);
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

  it.each(['p-[10%]', 'p-[var(--space)]', 'placeholder:p-4'])(
    'keeps Template-only %s in ordinary Shadow CSS without a Root receipt',
    async (token) => {
      const { artifact, documentCss } = await generate(template(token));
      expect(artifact.cssText).toContain(renderProtoShadowStyleTokenCss([token]));
      expect(artifact.cssText).not.toContain(`[data-pui-split-root-style~="${token}"]`);
      expect(artifact.cssText).toContain('[data-pui-split-root-style~="p-2"]');
      expect(documentCss).toContain(`[data-pui-style~="${token}"]`);
    }
  );

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
          r.el('input', { style: tw('placeholder:p-4') }),
        ];
      }});
    `);
    for (const token of ['p-[10%]', 'p-[var(--space)]', 'placeholder:p-4']) {
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
      expect(() => effects.queueStyle(effect('p-4'))).toThrow(
        /absent from the compiled split closure/
      );
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
    for (const token of ['p-[10%]', 'placeholder:p-4']) {
      expect(() => renderShadowStyleDelivery(['p-2', token], 'artifact')).toThrow(
        /verified length recipe|unsupported condition/
      );
    }
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
