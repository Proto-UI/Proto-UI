import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { definePrototype, tw, type AnatomyPartView } from '@proto.ui/core';
import { asOverlay } from '@proto.ui/hooks';
import { createReactAdapter } from '../../../adapters/react/src';
import {
  asSelectContent,
  asSelectSurface,
  asSelectViewport,
  asSelectItemText,
  selectRoot,
  selectTrigger,
  selectValue,
  selectItem,
  SELECT_CONTEXT,
  SELECT_FAMILY,
} from '../../../prototypes/base/src/select';
import { requestSelectOpen } from '../../../prototypes/base/src/select/shared';
import { resolveInitialSelectAlignment } from '../../../prototypes/base/src/select/alignment-intent';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let proofFailure: string | null = null;
export const readProofFailure = () => proofFailure;

/** Real portable prototype consumer. No DOM geometry, selector, frame timer or host identity here. */
const content = definePrototype({
  name: 'alignment-proof-content',
  setup(def) {
    const select = asSelectContent();
    const overlay = asOverlay();
    const transition = select.asTransition;
    transition.configure({ coldEntryPreparation: true, enterDuration: 0, leaveDuration: 0 });
    def.rule({
      when: (w) => w.state(transition.transitionState).eq('preparing'),
      intent: (i) => i.feedback.style.use(tw('invisible pointer-events-none')),
    });
    let attempt = 0;
    let committed = false;
    const reject = (run: any, reason: string) => {
      proofFailure = reason;
      attempt++;
      requestSelectOpen(run, { open: false, reason: `proof.${reason}`, focusReason: null });
    };
    const resolve = (run: any) => {
      if (
        !committed ||
        !select.stateHandles.open.get() ||
        transition.transitionState.get() !== 'preparing'
      )
        return;
      const parts = run.anatomy.parts(SELECT_FAMILY) as readonly AnatomyPartView[];
      const one = (role: string) => {
        const found = parts.filter((part) => part.role === role);
        return found.length === 1 ? found[0]! : null;
      };
      const trigger = one('trigger'),
        value = one('value'),
        surface = one('surface'),
        scrollport = one('viewport');
      if (!trigger || !value || !surface || !scrollport) {
        reject(run, 'missing-or-ambiguous-parts');
        return;
      }
      const rows = run.anatomy.order.partsOf(SELECT_FAMILY, 'item') as readonly AnatomyPartView[];
      const records = rows.map((row) => {
        const snapshot = (
          row.getExpose('getCollectionItem') as (() => { value: string; disabled: boolean }) | null
        )?.();
        const texts = run.anatomy.descendantsOf(
          SELECT_FAMILY,
          row,
          'item-text'
        ) as readonly AnatomyPartView[];
        return {
          value: snapshot?.value ?? '',
          disabled: snapshot?.disabled ?? true,
          row,
          text: texts.length === 1 ? texts[0]! : null,
        };
      });
      const context = run.context.read(SELECT_CONTEXT);
      const intent = resolveInitialSelectAlignment({
        mode: 'item-aligned',
        phase: 'initial-settled',
        edge: {
          side: 'bottom',
          align: 'start',
          sideOffset: 4,
          alignOffset: 0,
          strategy: 'fixed',
          avoidCollisions: true,
          collisionBoundary: 'viewport',
          collisionPadding: 10,
        },
        committed: context.value ? { kind: 'value', value: context.value } : { kind: 'unset' },
        records,
        reference: { trigger, value },
      });
      if (intent.kind !== 'target-pair') {
        reject(run, intent.kind === 'unresolved' ? intent.reason : 'unexpected-edge-intent');
        return;
      }
      const release = transition.controls.capturePreparation();
      if (!release) return;
      const current = ++attempt;
      let released = false;
      overlay.registerTargetAlignment({
        family: SELECT_FAMILY,
        surface,
        scrollport,
        blockReference: intent.reference.block,
        inlineReference: intent.reference.inline,
        blockTarget: intent.floating.block,
        inlineTarget: intent.floating.inline,
        ...intent.contentEdges,
        constraints: intent.constraints,
        onAlignment(status) {
          if (released || current !== attempt || !select.stateHandles.open.get()) return;
          // The isolated proof rejects unsupported geometry instead of silently changing policy.
          // This is not a production Select fallback decision.
          if (status.status === 'unavailable') {
            reject(run, status.reason);
            return;
          }
          if (status.status !== 'applied') return;
          released = true;
          release();
          const focus = intent.floating.block.getExpose('focusSelf') as
            | ((options: {
                preventScroll: boolean;
                defer: boolean;
                reason: 'programmatic';
              }) => void)
            | null;
          focus?.({ preventScroll: true, defer: false, reason: 'programmatic' });
        },
      });
    };
    def.lifecycle.onMounted((run) => {
      committed = false;
      run.update();
    });
    def.lifecycle.onUpdated((run) => {
      committed = true;
      resolve(run);
    });
    for (const role of ['surface', 'viewport', 'item', 'item-text', 'value'])
      def.anatomy.subscribeParts(SELECT_FAMILY, role, (run) => resolve(run));
    def.lifecycle.onUnmounted(() => {
      committed = false;
      attempt++;
    });
    return (r) => [r.r.slot()];
  },
});
const surface = definePrototype({
  name: 'alignment-proof-surface',
  setup() {
    asSelectSurface();
    return (r) => [r.r.slot()];
  },
});
const viewport = definePrototype({
  name: 'alignment-proof-viewport',
  setup() {
    asSelectViewport();
    return (r) => [r.r.slot()];
  },
});
const text = definePrototype({
  name: 'alignment-proof-text',
  setup() {
    asSelectItemText();
    return (r) => [r.r.slot()];
  },
});

let disposeProof: (() => void) | null = null;
export async function unmountAlignmentProof() {
  await act(async () => {
    disposeProof?.();
    disposeProof = null;
  });
}

export async function mountAlignmentProof(
  options: {
    direction?: 'ltr' | 'rtl';
    count?: number;
    selected?: number;
    top?: number;
    omitPart?: 'surface' | 'item-text';
  } = {}
) {
  proofFailure = null;
  const count = options.count ?? 3,
    selected = options.selected ?? 1;
  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; } body { margin: 0; font: 14px/20px sans-serif; }
    [data-pui-view-detached] { display:none; } .proof-content[data-transition-state="preparing"] { visibility:hidden; pointer-events:none; } .hidden { display: none; } .invisible { visibility: hidden; } .pointer-events-none { pointer-events:none; }
    .proof-root { position:absolute; top:${options.top ?? 240}px; left:180px; }
    .proof-trigger { display:flex; align-items:center; width:180px; height:36px; padding:0 12px; border:1px solid #aaa; background:white; }
    .proof-content { z-index:50; position:fixed; display:flex; flex-direction:column; }
    .proof-surface { position:relative; display:flex; flex-direction:column; max-height:100%; min-width:128px; padding:0px; border:1px solid #888; background:white; }
    .proof-viewport { position:relative; flex:1; min-height:0; overflow-y:auto; padding:4px; }
    .proof-item { position:relative; display:flex; align-items:center; height:32px; padding:6px 8px; outline:none; white-space:nowrap; }
    .proof-item:focus { background:#ddd; }
  `;
  document.head.append(style);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  disposeProof = () => {
    root.unmount();
    host.remove();
    style.remove();
  };
  const adapt = createReactAdapter(React);
  const Root = adapt(selectRoot),
    Trigger = adapt(selectTrigger, { rootTag: 'button' }),
    Value = adapt(selectValue, { rootTag: 'span' });
  const Content = adapt(content),
    Surface = adapt(surface),
    Viewport = adapt(viewport),
    Item = adapt(selectItem),
    Text = adapt(text, { rootTag: 'span' });
  const items = Array.from({ length: count }, (_, i) => {
    const itemProps: React.ComponentProps<typeof Item> & { 'data-demo-ref': string } = {
      className: 'proof-item',
      value: `v${i}`,
      textValue: `Option ${i}`,
      key: i,
      'data-demo-ref': `item-${i}`,
    };
    return React.createElement(
      Item,
      itemProps,
      options.omitPart === 'item-text' && i === selected
        ? `Option ${i}`
        : React.createElement(Text, { 'data-demo-ref': `text-${i}` }, `Option ${i}`)
    );
  });
  const rows = React.createElement(
    Viewport,
    { className: 'proof-viewport', 'data-demo-ref': 'viewport' },
    ...items
  );
  const painted =
    options.omitPart === 'surface'
      ? rows
      : React.createElement(
          Surface,
          { className: 'proof-surface', 'data-demo-ref': 'surface' },
          rows
        );
  const triggerProps: React.ComponentProps<typeof Trigger> & { 'data-demo-ref': string } = {
    className: 'proof-trigger',
    'data-demo-ref': 'trigger',
  };
  const valueProps: React.ComponentProps<typeof Value> & { 'data-demo-ref': string } = {
    'data-demo-ref': 'value',
  };
  const tree = React.createElement(
    Root,
    { className: 'proof-root', dir: options.direction ?? 'ltr', defaultValue: `v${selected}` },
    React.createElement(Trigger, triggerProps, React.createElement(Value, valueProps)),
    React.createElement(Content, { className: 'proof-content', 'data-demo-ref': 'frame' }, painted)
  );
  await act(async () => root.render(tree));
  return { count, selected };
}
