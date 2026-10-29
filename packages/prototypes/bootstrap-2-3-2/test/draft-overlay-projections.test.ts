import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import {
  dialogClose,
  dialogContent,
  dialogDescription,
  dialogMask,
  dialogRoot,
  dialogTitle,
  dialogTrigger,
} from '../src/dialog';
import { hoverCardContent, hoverCardRoot, hoverCardTrigger } from '../src/hover-card';
import { tooltipContent, tooltipGroup, tooltipRoot, tooltipTrigger } from '../src/tooltip';
import { drawerContent, drawerFooter, drawerHeader, drawerRoot, drawerTitle } from '../src/drawer';

type Host = HTMLElement & { getExposes(): Record<string, unknown> };

const protos = [
  dialogRoot,
  dialogTrigger,
  dialogMask,
  dialogContent,
  dialogTitle,
  dialogDescription,
  dialogClose,
  hoverCardRoot,
  hoverCardTrigger,
  hoverCardContent,
  tooltipGroup,
  tooltipRoot,
  tooltipTrigger,
  tooltipContent,
  drawerRoot,
  drawerContent,
  drawerTitle,
  drawerHeader,
  drawerFooter,
] as const;
for (const proto of protos) AdaptToWebComponent(proto);

function stateValue<T>(element: Host, key: string): T {
  const expose = element.getExposes()[key];
  if (!expose || typeof expose !== 'object' || !('get' in expose))
    throw new Error(`[test] missing expose state: ${key}`);
  const reader = expose.get;
  if (typeof reader !== 'function') throw new Error(`[test] expose ${key} is not readable`);
  return reader.call(expose) as T;
}

function transitionState(element: Host): string | null {
  const exposes = element.getExposes();
  if (!('transitionState' in exposes)) return null;
  return stateValue<string>(element, 'transitionState');
}

async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) await Promise.resolve();
}
async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await flush();
}
async function completeTransitions(...elements: Host[]): Promise<void> {
  for (const element of elements) {
    const phase = transitionState(element);
    if (phase !== 'entering' && phase !== 'leaving') continue;
    const controls = element.getExposes()['controls'];
    if (!controls || typeof controls !== 'object' || !('complete' in controls))
      throw new Error('[test] missing transition controls expose');
    const complete = controls.complete;
    if (typeof complete !== 'function') throw new Error('[test] controls.complete missing');
    complete.call(controls);
  }
  await flush();
}

function appendDialog(parent: HTMLElement, props: Record<string, unknown> = {}) {
  const root = document.createElement(dialogRoot.name) as Host;
  const trigger = document.createElement(dialogTrigger.name) as Host;
  const mask = document.createElement(dialogMask.name) as Host;
  const content = document.createElement(dialogContent.name) as Host;
  const title = document.createElement(dialogTitle.name) as Host;
  const description = document.createElement(dialogDescription.name) as Host;
  const close = document.createElement(dialogClose.name) as Host;
  title.appendChild(document.createTextNode('Session preferences'));
  description.appendChild(document.createTextNode('Choose how sessions are restored.'));
  content.append(title, description, close);
  root.append(trigger, mask, content);
  setElementProps(root, props);
  parent.appendChild(root);
  return { root, trigger, mask, content, title, description, close };
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});

describe('prototypes/bootstrap-2-3-2: dialog projection', () => {
  it('inherits open/close ownership, presence, and title/description relations', async () => {
    const { root, trigger, mask, content, title, description, close } = appendDialog(
      document.body,
      { a11yLabel: 'Session preferences' }
    );
    await flush();

    expect(stateValue<boolean>(root, 'open')).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(mask.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(stateValue<boolean>(trigger, 'disabled')).toBe(false);

    trigger.focus();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(stateValue<boolean>(root, 'open')).toBe(true);
    expect(transitionState(content)).toBe('entering');
    expect(transitionState(mask)).toBe('entering');
    expect(content.getAttribute('role')).toBe('dialog');
    expect(content.getAttribute('aria-modal')).toBe('true');
    expect(content.getAttribute('aria-labelledby')).toBe(title.id);
    expect(content.getAttribute('aria-describedby')).toBe(description.id);
    expect(styleContains(content, 'w-[560px]')).toBe(true);
    expect(styleContains(content, 'top-[10%]')).toBe(true);
    expect(styleContains(content, 'rounded-[6px]')).toBe(true);
    expect(styleContains(content, 'bg-clip-padding')).toBe(true);
    expect(styleContains(mask, 'bg-black')).toBe(true);
    expect(styleContains(close, 'text-paint-[#000_0_1px_0_rgb(255_255_255/100%)]')).toBe(true);

    await completeTransitions(mask, content);
    expect(transitionState(content)).toBe('entered');
    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(document.activeElement).toBe(close);

    title.remove();
    description.remove();
    await flush();
    expect(content.hasAttribute('aria-labelledby')).toBe(false);
    expect(content.hasAttribute('aria-describedby')).toBe(false);
    expect(content.getAttribute('aria-label')).toBe('Session preferences');

    close.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(stateValue<boolean>(root, 'open')).toBe(false);
    expect(transitionState(content)).toBe('leaving');
    await completeTransitions(mask, content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(mask.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('routes Escape and outside dismissal through controlled requests without closing', async () => {
    const { root, mask, content } = appendDialog(document.body, { open: true });
    const requests: unknown[] = [];
    root.addEventListener('openChange', (event) => {
      if (event instanceof CustomEvent) requests.push(event.detail);
    });
    await flush();
    expect(stateValue<boolean>(root, 'open')).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(stateValue<boolean>(root, 'open')).toBe(true);
    expect(transitionState(content)).not.toBe('leaving');

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(stateValue<boolean>(root, 'open')).toBe(true);
    expect(requests).toEqual([
      expect.objectContaining({ open: false, reason: 'escape', focusReason: 'keyboard' }),
      expect.objectContaining({ open: false, reason: 'outside.press', focusReason: 'pointer' }),
    ]);

    setElementProps(root, { open: false });
    await flush();
    expect(stateValue<boolean>(root, 'open')).toBe(false);
    await completeTransitions(mask, content);
  });

  it('inherits disabled suppression without retiring the trigger command', async () => {
    const { root, trigger, mask, content } = appendDialog(document.body, { disabled: true });
    const requests: unknown[] = [];
    root.addEventListener('openChange', (event) => {
      if (event instanceof CustomEvent) requests.push(event.detail);
    });
    await flush();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(stateValue<boolean>(trigger, 'disabled')).toBe(true);
    expect(stateValue<boolean>(root, 'open')).toBe(false);
    expect(requests).toEqual([]);

    setElementProps(root, { disabled: false });
    await flush();
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(stateValue<boolean>(trigger, 'disabled')).toBe(false);
    expect(stateValue<boolean>(root, 'open')).toBe(true);
    expect(requests).toEqual([
      expect.objectContaining({ open: true, reason: 'trigger.press', focusReason: 'pointer' }),
    ]);
    await completeTransitions(mask, content);
  });
});

describe('prototypes/bootstrap-2-3-2: tooltip projection', () => {
  it('keeps Base openDelay timing and exposes tooltip semantics', async () => {
    vi.useFakeTimers();
    const root = document.createElement(tooltipRoot.name) as Host;
    const trigger = document.createElement(tooltipTrigger.name) as Host;
    const content = document.createElement(tooltipContent.name) as Host;
    content.appendChild(document.createTextNode('Supplementary description'));
    root.append(trigger, content);
    document.body.appendChild(root);
    await flush();

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(699);
    expect(stateValue<boolean>(root, 'open')).toBe(false);
    await advance(1);
    expect(stateValue<boolean>(root, 'open')).toBe(true);

    expect(trigger.getAttribute('aria-describedby')).toBe(content.id);
    expect(content.getAttribute('role')).toBe('tooltip');
    expect(styleContains(content, 'text-[11px]')).toBe(true);
    expect(styleContains(content, 'max-w-[200px]')).toBe(true);
    expect(styleContains(content, 'bg-black')).toBe(true);
    expect(styleContains(content, 'rounded-[4px]')).toBe(true);

    trigger.dispatchEvent(new Event('pointerleave'));
    await advance(100);
    expect(stateValue<boolean>(root, 'open')).toBe(false);
  });

  it('keeps group warm handoff between sibling tooltips', async () => {
    vi.useFakeTimers();
    const group = document.createElement(tooltipGroup.name) as Host;
    const firstRoot = document.createElement(tooltipRoot.name) as Host;
    const firstTrigger = document.createElement(tooltipTrigger.name) as Host;
    const firstContent = document.createElement(tooltipContent.name) as Host;
    const secondRoot = document.createElement(tooltipRoot.name) as Host;
    const secondTrigger = document.createElement(tooltipTrigger.name) as Host;
    const secondContent = document.createElement(tooltipContent.name) as Host;
    firstRoot.append(firstTrigger, firstContent);
    secondRoot.append(secondTrigger, secondContent);
    group.append(firstRoot, secondRoot);
    document.body.appendChild(group);
    await flush();

    firstTrigger.dispatchEvent(new Event('pointerenter'));
    await advance(700);
    expect(stateValue<boolean>(firstRoot, 'open')).toBe(true);

    firstTrigger.dispatchEvent(new Event('pointerleave'));
    secondTrigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(stateValue<boolean>(secondRoot, 'open')).toBe(true);
    expect(stateValue<boolean>(firstRoot, 'open')).toBe(false);
    expect(firstContent.hasAttribute('data-pui-view-detached')).toBe(true);

    // Retiring the active owner restores the cold delay rather than keeping a stale warmth lease.
    secondRoot.remove();
    await flush();
    firstTrigger.dispatchEvent(new Event('pointerenter'));
    await advance(699);
    expect(stateValue<boolean>(firstRoot, 'open')).toBe(false);
    await advance(1);
    expect(stateValue<boolean>(firstRoot, 'open')).toBe(true);

    firstTrigger.dispatchEvent(new Event('pointerleave'));
    await advance(100);
    expect(stateValue<boolean>(firstRoot, 'open')).toBe(false);
    await advance(300);
    firstTrigger.dispatchEvent(new Event('pointerenter'));
    await advance(699);
    expect(stateValue<boolean>(firstRoot, 'open')).toBe(false);
    await advance(1);
    expect(stateValue<boolean>(firstRoot, 'open')).toBe(true);
  });

  it('keeps Tooltip controlled requests and withdraws only its description relation', async () => {
    vi.useFakeTimers();
    const root = document.createElement(tooltipRoot.name) as Host;
    const trigger = document.createElement(tooltipTrigger.name) as Host;
    const content = document.createElement(tooltipContent.name) as Host;
    const requests: unknown[] = [];
    trigger.setAttribute('aria-describedby', 'host-help');
    content.appendChild(document.createTextNode('Tooltip description'));
    setElementProps(root, { open: false, openDelay: 0, closeDelay: 0 });
    root.addEventListener('openChange', (event) => {
      if (event instanceof CustomEvent) requests.push(event.detail);
    });
    root.append(trigger, content);
    document.body.appendChild(root);
    await flush();

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(stateValue<boolean>(root, 'open')).toBe(false);
    expect(requests.at(-1)).toMatchObject({ open: true, reason: 'trigger.pointerenter' });
    expect(trigger.getAttribute('aria-describedby')).toBe('host-help');

    setElementProps(root, { open: true, openDelay: 0, closeDelay: 0 });
    await flush();
    await completeTransitions(content);
    expect(trigger.getAttribute('aria-describedby')).toBe(`host-help ${content.id}`);
    expect(content.getAttribute('role')).toBe('tooltip');
    expect(content.hasAttribute('tabindex')).toBe(false);
    expect(trigger.getAttribute('role')).toBeNull();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await advance(0);
    expect(stateValue<boolean>(root, 'open')).toBe(true);
    expect(transitionState(content)).not.toBe('leaving');
    expect(requests.at(-1)).toMatchObject({ open: false, reason: 'escape' });

    content.remove();
    await flush();
    expect(trigger.getAttribute('aria-describedby')).toBe('host-help');
  });
});

describe('prototypes/bootstrap-2-3-2: hover-card projection', () => {
  it('keeps 700/300ms delays and the trigger-to-content hover bridge', async () => {
    vi.useFakeTimers();
    const root = document.createElement(hoverCardRoot.name) as Host;
    const trigger = document.createElement(hoverCardTrigger.name) as Host;
    const content = document.createElement(hoverCardContent.name) as Host;
    content.appendChild(document.createTextNode('Preview body'));
    root.append(trigger, content);
    document.body.appendChild(root);
    await flush();

    expect(styleContains(trigger, 'text-[#08c]')).toBe(true);
    expect(styleContains(trigger, 'no-underline')).toBe(true);

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(699);
    expect(stateValue<boolean>(root, 'open')).toBe(false);
    expect(styleContains(trigger, 'data-[hovered]:text-[#005580]')).toBe(true);
    expect(styleContains(trigger, 'data-[hovered]:underline')).toBe(true);
    await advance(1);
    expect(stateValue<boolean>(root, 'open')).toBe(true);
    expect(transitionState(content)).toBe('entering');
    await completeTransitions(content);
    expect(transitionState(content)).toBe('entered');
    expect(styleContains(content, 'max-w-[276px]')).toBe(true);
    expect(styleContains(content, 'rounded-[6px]')).toBe(true);
    expect(styleContains(content, 'shadow-[0_5px_10px_rgb(0_0_0/20%)]')).toBe(true);

    // Bridge: leaving the trigger for the open content stays open past closeDelay.
    trigger.dispatchEvent(new Event('pointerleave'));
    content.dispatchEvent(new Event('pointerenter'));
    await advance(300);
    expect(stateValue<boolean>(root, 'open')).toBe(true);

    content.dispatchEvent(new Event('pointerleave'));
    await advance(299);
    expect(stateValue<boolean>(root, 'open')).toBe(true);
    await advance(1);
    expect(stateValue<boolean>(root, 'open')).toBe(false);
  });

  it('keeps HoverCard controlled refusal independent of its content fade', async () => {
    vi.useFakeTimers();
    const root = document.createElement(hoverCardRoot.name) as Host;
    const trigger = document.createElement(hoverCardTrigger.name) as Host;
    const content = document.createElement(hoverCardContent.name) as Host;
    const requests: unknown[] = [];
    setElementProps(root, { open: false, openDelay: 0, closeDelay: 0 });
    root.addEventListener('openChange', (event) => {
      if (event instanceof CustomEvent) requests.push(event.detail);
    });
    root.append(trigger, content);
    document.body.appendChild(root);
    await flush();

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(stateValue<boolean>(root, 'open')).toBe(false);
    expect(requests.at(-1)).toMatchObject({ open: true, reason: 'trigger.pointerenter' });
    expect(trigger.getAttribute('role')).toBeNull();
    expect(content.getAttribute('role')).toBeNull();

    setElementProps(root, { open: true, openDelay: 0, closeDelay: 0 });
    await flush();
    await completeTransitions(content);
    trigger.dispatchEvent(new Event('pointerleave'));
    await advance(0);
    expect(stateValue<boolean>(root, 'open')).toBe(true);
    expect(transitionState(content)).not.toBe('leaving');
    expect(requests.at(-1)).toMatchObject({ open: false, reason: 'trigger.pointerleave' });

    setElementProps(root, { open: false, openDelay: 0, closeDelay: 0 });
    await flush();
    expect(stateValue<boolean>(root, 'open')).toBe(false);
    expect(transitionState(content)).toBe('leaving');
    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);
    await completeTransitions(content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
  });
});

describe('prototypes/bootstrap-2-3-2: drawer header/footer projection', () => {
  it('renders authored children through both semantic parts with modal chrome', async () => {
    const root = document.createElement(drawerRoot.name) as Host;
    const content = document.createElement(drawerContent.name) as Host;
    const header = document.createElement(drawerHeader.name) as Host;
    const title = document.createElement(drawerTitle.name) as Host;
    const footer = document.createElement(drawerFooter.name) as Host;
    setElementProps(root, { defaultOpen: true });
    title.appendChild(document.createTextNode('Filters'));
    footer.appendChild(document.createTextNode('Actions'));
    header.appendChild(title);
    content.append(header, footer);
    root.appendChild(content);
    document.body.appendChild(root);
    await flush();

    expect(header.textContent).toContain('Filters');
    expect(footer.textContent).toContain('Actions');
    expect(styleContains(header, 'border-b')).toBe(true);
    expect(styleContains(header, 'py-[9px]')).toBe(true);
    expect(styleContains(footer, 'text-right')).toBe(true);
    expect(styleContains(footer, 'justify-end')).toBe(false);
    expect(styleContains(footer, 'bg-[#f5f5f5]')).toBe(true);
    expect(styleContains(footer, 'rounded-b-[6px]')).toBe(true);
    expect(drawerHeader.name).toBe('bootstrap-2-3-2-drawer-header');
    expect(drawerFooter.name).toBe('bootstrap-2-3-2-drawer-footer');
  });
});
