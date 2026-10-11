import {
  AdaptToWebComponent,
  setElementProps,
  setElementAssociations,
} from '@proto.ui/adapter-web-component';
import { createControlLabelRef, definePrototype, snapshotStaticHitInset } from '@proto.ui/core';
import { asHitParticipation } from '@proto.ui/hooks';
import { asSwitchRoot } from '@proto.ui/prototypes-base/switch';
import { createWebHitParticipationHostBridge } from '@proto.ui/module-hit-participation';
import label from '@proto.ui/prototypes-base/label';

// An isolated real-protocol consumer. The production Switch recipe is deliberately
// not resized or activated until exact-head native evidence has been reviewed.
const probe = definePrototype({
  name: 'static-hit-switch-probe',
  setup() {
    asSwitchRoot();
    const hit = asHitParticipation();
    hit.configure({
      staticHitInset: {
        top: { value: 0.5, unit: 'rem' },
        right: { value: 0.75, unit: 'rem' },
        bottom: { value: 0.5, unit: 'rem' },
        left: { value: 0.75, unit: 'rem' },
      },
    });
  },
});
const events: { type: string; target: string; trusted: boolean }[] = [];
const roots: HTMLElement[] = [];
let scope: Document | ShadowRoot = document;
const append = (node: Node) => (scope === document ? document.body : scope).appendChild(node);
export async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
export async function mount(shadow = false) {
  const style = document.createElement('style');
  style.textContent = `html{font-size:16px}body{margin:0;padding:80px;font:16px Arial}static-hit-switch-probe{display:inline-flex;position:relative;box-sizing:border-box;width:32px;height:18.4px;border:1px solid transparent;border-radius:99px;background:#bbb;vertical-align:top}static-hit-switch-probe[aria-checked=true]{background:#444}static-hit-switch-probe:focus-visible{outline:2px solid #26f} .row{position:relative;margin-bottom:75px;width:220px;height:50px} .clip{overflow:hidden;width:32px;height:18.4px}.cover{position:absolute;left:-11px;top:3px;width:10px;height:10px;background:orange;z-index:1}base-label{display:inline-block;margin-left:40px}`;
  document.head.append(style);
  if (shadow) {
    const shell = document.createElement('div');
    shell.id = 'shadow-fixture';
    document.body.append(shell);
    scope = shell.attachShadow({ mode: 'open' });
    scope.appendChild(style.cloneNode(true));
  }
  AdaptToWebComponent(probe, { shadow });
  if (!customElements.get(label.name)) AdaptToWebComponent(label);
  for (const kind of ['normal', 'clipped', 'covered', 'disabled', 'hidden']) {
    const row = document.createElement('div');
    row.className = 'row';
    row.id = kind;
    const root = document.createElement(probe.name);
    root.id = `${kind}-root`;
    roots.push(root);
    if (kind === 'hidden') root.style.visibility = 'hidden';
    if (kind === 'disabled') setElementProps(root, { disabled: true });
    for (const type of ['pointerdown', 'pointerup', 'click', 'pointercancel'])
      root.addEventListener(type, (e) =>
        events.push({ type, target: (e.target as HTMLElement).id, trusted: e.isTrusted })
      );
    if (kind === 'clipped') {
      const clip = document.createElement('div');
      clip.className = 'clip';
      clip.append(root);
      row.append(clip);
    } else row.append(root);
    if (kind === 'covered') {
      const cover = document.createElement('button');
      cover.className = 'cover';
      cover.id = 'cover';
      cover.textContent = '';
      row.append(cover);
    }
    if (kind === 'normal') {
      const text = document.createElement(label.name);
      text.id = 'probe-label';
      text.textContent = 'Switch label';
      const ref = createControlLabelRef();
      setElementAssociations(root, { controlLabel: ref });
      setElementAssociations(text, { controlLabel: ref });
      setElementProps(text, { naming: true, activation: true });
      row.append(text);
    }
    append(row);
  }
  const generic = document.createElement('div');
  generic.id = 'generic';
  generic.style.cssText = 'position:relative;display:block;width:180px;height:40px;background:#eee';
  generic.innerHTML =
    '<button id="nested-button">Nested button</button><a id="nested-link" href="#link-target">Link</a>';
  for (const node of generic.children)
    node.addEventListener('click', (e) =>
      events.push({
        type: 'nested-click',
        target: (e.target as HTMLElement).id,
        trusted: e.isTrusted,
      })
    );
  append(generic);
  createWebHitParticipationHostBridge().sync({
    config: { mode: 'participating' },
    regions: [
      {
        target: generic,
        mode: 'participating',
        staticHitInset: snapshotStaticHitInset({
          top: { value: 8, unit: 'px' },
          left: { value: 12, unit: 'px' },
          right: { value: 12, unit: 'px' },
          bottom: { value: 8, unit: 'px' },
        }),
      },
    ],
  });
  await flush();
}
export function sample(id = 'normal-root') {
  const root = scope.getElementById(id)!;
  const rect = root.getBoundingClientRect();
  const exposes = (root as any).getExposes();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    checked: exposes.checked.get(),
    disabled: exposes.disabled.get(),
    focused: exposes.focused.get(),
    focusVisible: exposes.focusVisible.get(),
    pressed: exposes.pressed.get(),
    active: scope.activeElement?.id,
    events: events.slice(),
    children: root.querySelectorAll('[role=switch],button,input').length,
  };
}
export async function setDisabled(value: boolean) {
  setElementProps(roots[0], { disabled: value });
  await flush();
}
export function clearEvents() {
  events.length = 0;
}
export async function remount() {
  const root = roots[0];
  const parent = root.parentElement!;
  root.remove();
  await flush();
  parent.prepend(root);
  await flush();
}

/** Real CSSOM negative controls; the local DOM model is not the native oracle. */
export function cssomNegativeControls() {
  const outcomes: { mutation: string; rejected: boolean; preserved: boolean }[] = [];
  for (const mutation of ['insertRule', 'deleteRule', 'ruleStyle', 'disabled', 'move']) {
    const target = document.createElement('div');
    target.style.cssText = 'position:relative;display:block;width:20px;height:20px';
    append(target);
    const bridge = createWebHitParticipationHostBridge();
    const args = {
      config: { mode: 'participating' as const },
      regions: [
        {
          target,
          mode: 'participating' as const,
          staticHitInset: snapshotStaticHitInset({ left: { value: 5, unit: 'px' } }),
        },
      ],
    };
    bridge.sync(args);
    const marker = target.getAttribute('data-pui-static-hit');
    const styles =
      scope === document
        ? document.head.querySelectorAll('style')
        : scope.querySelectorAll('style');
    const style = Array.from(styles).find((item) =>
      item.textContent?.startsWith(`[data-pui-static-hit="${marker}"]`)
    )!;
    const sheet = style.sheet!;
    if (mutation === 'insertRule')
      sheet.insertRule('body { --static-hit-author: 1; }', sheet.cssRules.length);
    if (mutation === 'deleteRule') sheet.deleteRule(0);
    if (mutation === 'ruleStyle')
      (sheet.cssRules[0] as CSSStyleRule).style.setProperty('cursor', 'crosshair');
    if (mutation === 'disabled') sheet.disabled = true;
    if (mutation === 'move') target.appendChild(style);
    let rejected = false;
    try {
      bridge.sync(args);
    } catch (error) {
      rejected = String(error).includes('projection changed externally');
    }
    bridge.sync({ config: args.config, regions: [] });
    outcomes.push({ mutation, rejected, preserved: style.isConnected });
    style.remove();
    target.remove();
  }
  return outcomes;
}
