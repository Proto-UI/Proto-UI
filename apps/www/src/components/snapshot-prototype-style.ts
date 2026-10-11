import { createRuntimeSession } from '../../../../packages/runtime/src';
import { EFFECTS_CAP } from '../../../../packages/modules/feedback/src';
import { renderProtoStyleTokenCss } from '../../../../packages/cli/src/services/proto-style-css';
import {
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
  AS_TRIGGER_GET_PROTO_CAP,
} from '../../../../packages/modules/as-trigger/src';
import {
  EVENT_ROOT_TARGET_CAP,
  EVENT_GLOBAL_TARGET_CAP,
} from '../../../../packages/modules/event/src';
import type { Prototype, StyleHandle } from '@proto.ui/core';

/** Bind a reviewed, finite recipe collection. Callers select a key, never an
 * arbitrary prototype or dynamic import. Command identity is opt-in per key;
 * passive collections (including the library cards) need no event capabilities.
 * Registration is source review, not a sandbox for untrusted lifecycle code. */
export function createStyleSnapshotter<const R extends Record<string, Prototype<any, any>>>(
  registry: R,
  commandKeys: readonly (keyof R)[] = []
) {
  const recipes = new Map(Object.entries(registry));
  const commands = new Set(commandKeys);
  return (key: keyof R, props: Record<string, unknown>): Promise<string[]> => {
    const prototype = recipes.get(String(key));
    if (!prototype) throw new Error(`Unreviewed startup recipe: ${String(key)}`);
    return snapshotPrototypeStyle(
      prototype,
      props,
      commands.has(key) ? 'command-style' : 'passive'
    );
  };
}

/** Internal build-time projection for the reviewed passive Surface/Text and
 * Button recipes only. This runs setup/mount lifecycle; it is not a pure
 * arbitrary-Prototype evaluator. Callers must not pass resource-owning recipes.
 * Command-style mode provides detached event identity, never real host input.
 * Build-time, style-only projection of the actual Prototype. It installs no
 * browser interaction source, never claims a functioning SSR command, and
 * disposes the Runtime even when rendering fails. */
async function snapshotPrototypeStyle(
  prototype: Prototype<any, any>,
  props: Record<string, unknown>,
  mode: 'passive' | 'command-style' = 'passive'
): Promise<string[]> {
  let tokens: string[] = [];
  // A detached, never-dispatched identity lets command recipes declare their
  // standard hooks without connecting input or implying an interactive host.
  const identity = new EventTarget();
  const session = createRuntimeSession(prototype, {
    prototypeName: prototype.name,
    getRawProps: () => props,
    schedule: (task) => task(),
    commit: (_children, signal) => signal?.done(),
    onRuntimeReady(wiring) {
      if (mode === 'command-style') {
        wiring.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, identity],
          [AS_TRIGGER_PARENT_CAP, () => null],
          [AS_TRIGGER_GET_PROTO_CAP, () => prototype],
        ]);
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => identity],
          [EVENT_GLOBAL_TARGET_CAP, () => identity],
        ]);
      }
      wiring.attach('feedback', [
        [
          EFFECTS_CAP,
          {
            queueStyle(style: StyleHandle) {
              tokens = [...style.tokens];
            },
            requestFlush() {},
          },
        ],
      ]);
    },
  });
  try {
    await session.mount();
    return tokens;
  } finally {
    await session.dispose();
  }
}

/** Static native hosts without a data-pui-style slot (e.g. an authored code
 * figure's decorative pseudo plane) still use the canonical token compiler.
 * Only its zero-specificity host selector is rebound; declarations, ordering,
 * variants, theme selectors and media queries remain compiler-owned. */
export function renderSnapshotTokenCss(tokens: string[], scope?: string): string {
  // The site already loads the canonical document reset. Do not emit it again:
  // a later snapshot must not reset earlier controls in the same CSS layer.
  const reset = renderProtoStyleTokenCss([]);
  const prefix = reset.slice(0, reset.lastIndexOf('}'));
  const compiled = renderProtoStyleTokenCss(tokens);
  if (!compiled.startsWith(prefix)) throw new Error('Snapshot compiler prelude changed');
  const css = '@layer proto-ui {' + compiled.slice(prefix.length);
  // A late inline snapshot must not re-declare composite utilities globally:
  // e.g. a Button's text-sm would override another Text's explicit leading.
  // Keep the compiler's token membership and variants on the same host, at
  // zero specificity. Unscoped output is for declaration extraction/rebinding.
  return scope
    ? css.replace(
        /:where\((\[data-pui-style~="(?:\\.|[^"\\])*"\])\)/g,
        (_match, token: string) => `:where(${scope}${token})`
      )
    : css;
}

export function renderSnapshotSelectorCss(tokens: string[], selector: string): string {
  const pseudo = selector.endsWith('::before') ? '::before' : '';
  const host = pseudo ? selector.slice(0, -pseudo.length) : selector;
  return renderSnapshotTokenCss(tokens).replace(
    /:where\(\[data-pui-style~="(?:\\.|[^"\\])*"\]\)/g,
    `:where(${host})${pseudo}`
  );
}
