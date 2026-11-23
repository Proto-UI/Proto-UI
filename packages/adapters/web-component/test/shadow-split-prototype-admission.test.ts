import { describe, expect, it } from 'vitest';
import dialogMask from '../../../prototypes/shadcn/src/dialog/overlay.proto';
import dialogRoot from '../../../prototypes/shadcn/src/dialog/root.proto';
import { AdaptToWebComponent, setElementProps } from '../src';
import {
  isNativeFocusTargetReady,
  subscribeFocusTargetOwnerReady,
} from '../src/platform/instance-tree';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import { rewriteSplitBaseDeclarations } from './shadow-split-test-utils';

// Port the deferred-valid control from signed reconciliation candidate 8e4da4df.
const cases = [
  { mode: 'ordinary', invalid: true, deferred: false },
  { mode: 'deferred-invalid', invalid: true, deferred: true },
  { mode: 'deferred-valid', invalid: false, deferred: true },
];

// D1 pilot boundary + D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 C/K:
// the actual asDialogMask -> asTransition closure requires an I1 hidden recipe.
describe('composed Shadow prototype admission', () => {
  it.each(cases)('admits the Dialog Mask ($mode)', async ({ mode, invalid, deferred }) => {
    const Parent = AdaptToWebComponent(dialogRoot, { registerAs: `x-split-mask-parent-${mode}` });
    const parent = new Parent();
    setElementProps(parent, { open: true });
    document.body.append(parent);
    // This case exercises the actual public closure. A partial old hand-written
    // token list rejected new source tokens before reaching the I1 control.
    const closure = (
      await Promise.all([
        collectProtoStyleTokens('packages/prototypes/shadcn/src/dialog'),
        collectProtoStyleTokens('packages/prototypes/base/src/dialog'),
      ])
    ).flat();
    const artifact = renderProtoShadowSplitStyleArtifact(closure);
    const oldArtifact = {
      ...artifact,
      cssText: rewriteSplitBaseDeclarations(artifact.cssText, (declarations) =>
        declarations.replace('--pui-split-participation-coordinate-recipe: i1;', '')
      ),
    };
    const environmentListeners = new Set<() => void>();
    const lifecycleEvents: string[] = [];
    let readyPublications = 0;
    let unsubscribeReady: (() => void) | undefined;
    let finishDisposal!: () => void;
    const disposed = new Promise<void>((resolve) => {
      finishDisposal = resolve;
    });
    const Mask = AdaptToWebComponent(dialogMask, {
      registerAs: `x-split-mask-admission-${mode}`,
      ...(deferred ? { createVisualSink: () => null } : {}),
      shadow: {
        mode: 'open',
        presentation: 'split',
        styleArtifact: invalid ? oldArtifact : artifact,
        colorSchemeSource: {
          get: () => 'light',
          subscribe(listener) {
            environmentListeners.add(listener);
            return () => {
              environmentListeners.delete(listener);
            };
          },
        },
      },
      diagnostics: {
        onLifecycleEvent(event) {
          lifecycleEvents.push(event.type);
          if (event.type === 'mount.phase') lifecycleEvents.push(event.phase);
          if (event.type === 'mount.commit.done') {
            unsubscribeReady = subscribeFocusTargetOwnerReady(host, () => {
              if (isNativeFocusTargetReady(host)) readyPublications++;
            });
          }
          if (event.type === 'instance.dispose.done') finishDisposal();
        },
      },
      schedule: (task) => task(),
    });
    const host = new Mask();
    const errors: unknown[] = [];
    const capture = (event: ErrorEvent) => {
      errors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener('error', capture);
    try {
      expect(parent.getExposes().open.get()).toBe(true);
      // Capture native CE reports and the harness's synchronous transport;
      // neither changes the real connected Dialog provider association.
      try {
        parent.append(host);
      } catch (error) {
        errors.push(error);
      }
      expect(lifecycleEvents).toContain('mount.commit.done');
      if (invalid) {
        expect(errors).toHaveLength(1);
        expect(errors[0]).toBeInstanceOf(Error);
        expect(String(errors[0])).toMatch(/hidden.*I1 recipe/);
        expect(lifecycleEvents).not.toContain('mounted');
        expect(lifecycleEvents).not.toContain('mount.mounted');
        expect(readyPublications).toBe(0);
      } else {
        expect(errors).toHaveLength(0);
        expect(lifecycleEvents).toContain('mounted');
        expect(lifecycleEvents).toContain('mount.mounted');
        expect(environmentListeners.size).toBe(1);
        host.remove();
      }
      await disposed;
      expect(environmentListeners.size).toBe(0);
      expect(host.getExposes?.() ?? {}).toEqual({});
      expect(host.hasAttribute('data-pui-color-scheme')).toBe(false);
      expect(host.hasAttribute('data-pui-split-root-style')).toBe(false);
      expect(host.shadowRoot?.childNodes.length).toBe(0);
      expect(errors).toHaveLength(invalid ? 1 : 0);
    } finally {
      unsubscribeReady?.();
      host.remove();
      parent.remove();
      await Promise.resolve();
      window.removeEventListener('error', capture);
    }
  });
});
