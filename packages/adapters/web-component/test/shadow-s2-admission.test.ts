import { afterEach, describe, expect, it } from 'vitest';
import { classifyTwTokenApplicationRoleV0 } from '../../../core/src/spec/feedback/application-role';
import {
  collectProtoRootStyleTokenOccurrences,
  collectProtoStyleTokens,
} from '../../../cli/src/services/prototype-style-tokens';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import button from '../../../prototypes/shadcn/src/button';
import { switchRoot, switchThumb } from '../../../prototypes/shadcn/src/switch';
import { AdaptToWebComponent, setElementProps } from '../src';

// Complete public prototype admission after H1. This proves lifecycle/wiring,
// not rendered geometry: D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 L-O needs Chrome.
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
      expect(tokens).toContain('transition-all');
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

    it(`${entry.proto.name}: activates the complete prototype and releases resources across reconnect`, async () => {
      const closure = (await collectProtoStyleTokens(entry.directory)) as string[];
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
