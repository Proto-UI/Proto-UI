import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { classifyTwTokenApplicationRoleV0 } from '../../../core/src/spec/feedback/application-role';
import { createRootStyleEffect, resolveRootStyleEntry } from '@proto.ui/core/internal';
import {
  collectProtoRootStyleTokenOccurrences,
  collectProtoStyleTokens,
} from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowSplitStyleArtifact,
} from '../../../cli/src/services/proto-style-css';
import button from '../../../prototypes/shadcn/src/button';
import { switchRoot, switchThumb } from '../../../prototypes/shadcn/src/switch';
import { AdaptToWebComponent, setElementProps } from '../src';
import { createShadowSplitEffectsPort } from '../src/shadow-split-effects';

// Happy DOM does not project @layer/:host stylesheet geometry; materialize only the
// declared physical prerequisites here. Real Shadow geometry remains a browser gate.
const recipeSheet = document.createElement('style');
beforeAll(() => {
  recipeSheet.textContent =
    renderProtoStyleTokenCss(['relative', 'inline-flex'])
      .replace('@layer proto-ui {', '')
      .replace(/}\s*$/, '') +
    '\n[data-pui-split-root-style~="inline-flex"]{display:inline-flex}[data-pui-split-root-style~="relative"]{position:relative}';
  document.head.append(recipeSheet);
});
afterAll(() => recipeSheet.remove());

// These newer profile/drag branches have no admitted split application role.
// Their atomic rejection controls do not satisfy the complete-prototype inventory
// gate below, which still requires no unresolved Root token.
const unresolvedSwitchThumb = [
  'translate-x-[calc((100%_-_2px)*var(--pui-percentage)/100)]',
  'translate-x-[calc((100%_-_4px)*var(--pui-percentage)/100)]',
  'translate-x-[calc((100%_-_8px)*var(--pui-percentage)/100)]',
  'translate-x-[calc((2px_-_100%)*var(--pui-percentage)/100)]',
  'translate-x-[calc((4px_-_100%)*var(--pui-percentage)/100)]',
  'translate-x-[calc((8px_-_100%)*var(--pui-percentage)/100)]',
  'translate-x-[calc(-1px_-_(100%_+_1px)*var(--pui-percentage)/100)]',
  'translate-x-[calc(100%_-_4px)]',
  'translate-x-[calc(1px_+_(100%_+_1px)*var(--pui-percentage)/100)]',
] as const;

// Default-state public prototype admission after H1. This proves lifecycle/wiring,
// not all profile branches or rendered geometry: L-O still needs Chrome.
const cases = [
  {
    proto: button,
    directory: 'packages/prototypes/shadcn/src/button',
    file: 'button.proto.ts',
    unresolved: [],
  },
  {
    proto: switchRoot,
    directory: 'packages/prototypes/shadcn/src/switch',
    file: 'root.proto.ts',
    unresolved: [],
  },
  {
    proto: switchThumb,
    directory: 'packages/prototypes/shadcn/src/switch',
    file: 'thumb.proto.ts',
    unresolved: [],
  },
] as const;
let serial = 0;
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('S2 current public admission boundary', () => {
  it.each(unresolvedSwitchThumb)(
    'rejects unsupported active Switch token %s atomically',
    (token) => {
      const host = document.createElement('s2-unsupported-switch');
      const surface = document.createElement('div');
      host.attachShadow({ mode: 'open' }).append(surface);
      const port = createShadowSplitEffectsPort({
        host,
        surface,
        artifact: renderProtoShadowSplitStyleArtifact(['block', token]),
        prototypeName: 's2-unsupported-switch',
      });
      const effect = (tokens: string[]) =>
        createRootStyleEffect(tokens.map((item) => resolveRootStyleEntry(item, 'runtime')));
      try {
        port.queueStyle(effect(['block']));
        port.flushNow!();
        const before = [host.outerHTML, surface.outerHTML];
        expect(() => port.queueStyle(effect(['block', token]))).toThrow(/unresolved/);
        port.flushNow!();
        expect([host.outerHTML, surface.outerHTML]).toEqual(before);
      } finally {
        port.dispose();
      }
      expect(host.hasAttribute('data-pui-split-root-style')).toBe(false);
    }
  );

  for (const entry of cases) {
    it(`${entry.proto.name}: inventories all unresolved Root tokens, not just the first failure`, async () => {
      const occurrences = await collectProtoRootStyleTokenOccurrences(entry.directory);
      const tokens = [
        ...new Set<string>(
          occurrences
            .filter((occurrence) => occurrence.path === entry.file)
            .map((occurrence) => occurrence.token)
        ),
      ];
      if (entry.proto === switchThumb || entry.proto === switchRoot) {
        expect(tokens).not.toContain('transition-all');
        // The current source-bound Thumb animates its translation explicitly;
        // Root remains color-only. Its unresolved-token inventory stays exact.
        if (entry.proto === switchThumb) expect(tokens).toContain('transition-transform');
        else expect(tokens).not.toContain('transition-transform');
      } else expect(tokens).toContain('transition-all');
      expect(
        tokens
          .filter((token) => classifyTwTokenApplicationRoleV0(token).role === 'unresolved')
          .sort()
      ).toEqual([...entry.unresolved].sort());
      expect(classifyTwTokenApplicationRoleV0('transition-all')).toMatchObject({
        role: 'surface',
        roleSource: 'canonical',
      });
    });

    it(`${entry.proto.name}: activates the default state and releases resources across reconnect`, async () => {
      const closure = (await collectProtoStyleTokens(entry.directory)) as string[];
      // Shadcn Button also uses the Base Button setup styles.
      if (entry.proto === button)
        closure.push(...(await collectProtoStyleTokens('packages/prototypes/base/src/button')));
      const artifact = renderProtoShadowSplitStyleArtifact(closure);
      const listeners = new Set<() => void>();
      const source = {
        get: () => 'light' as const,
        subscribe(callback: () => void) {
          listeners.add(callback);
          return () => {
            listeners.delete(callback);
          };
        },
      };
      const C = AdaptToWebComponent(entry.proto, {
        registerAs: `s2-admission-${++serial}`,
        shadow: {
          mode: 'open',
          presentation: 'split',
          styleArtifact: artifact,
          colorSchemeSource: source,
        },
        schedule: (task) => task(),
      });
      const el = new C();
      const text = document.createTextNode('Consumer content');
      el.append(text);
      setElementProps(el, { disabled: true });
      // Keep Thumb in a real Light Root's Context, not a mocked anatomy provider.
      const Parent = AdaptToWebComponent(switchRoot, {
        registerAs: `s2-admission-parent-${++serial}`,
      });
      const parent = new Parent();
      document.body.append(parent);
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          parent.append(el);
          await flush();
          expect(listeners.size).toBe(1);
          expect(el.shadowRoot!.querySelector('[part="surface"]')).not.toBeNull();
          expect(el.hasAttribute('data-pui-split-root-style')).toBe(true);
          expect(el.firstChild).toBe(text);
          el.remove();
          await flush();
          expect(listeners.size).toBe(0);
          expect(el.shadowRoot!.childNodes).toHaveLength(0);
          expect(el.hasAttribute('data-pui-color-scheme')).toBe(false);
          expect(el.hasAttribute('data-pui-split-root-style')).toBe(false);
          expect(el.firstChild).toBe(text);
        }
      } finally {
        parent.remove();
        await flush();
      }
    });
  }
});
