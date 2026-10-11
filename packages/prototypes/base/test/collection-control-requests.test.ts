import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { resizableRoot } from '../src/resizable';
import {
  carouselRoot,
  carouselViewport,
  carouselSlide,
  carouselNext,
  carouselPrevious,
} from '../src/carousel';
import { treeRoot, treeItem, treeToggle } from '../src/tree';

// Bounded draft request/disabled cases, not family-level conformance or native input evidence.
for (const p of [
  resizableRoot,
  carouselRoot,
  carouselViewport,
  carouselSlide,
  carouselNext,
  carouselPrevious,
  treeRoot,
  treeItem,
  treeToggle,
])
  AdaptToWebComponent(p as any, { registerAs: `requests-${p.name}` });
const owned: HTMLElement[] = [];
const node = (name: string, props: Record<string, unknown> = {}): any => {
  const el = document.createElement(`requests-base-${name}`);
  setElementProps(el, props);
  owned.push(el);
  return el;
};
const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const el of owned.splice(0)) el.remove();
  await flush();
});
const events = (el: HTMLElement, name: string, key: string): any[] => {
  const values: any[] = [];
  el.addEventListener(name, (e: any) => {
    if (e.target === el) values.push(e.detail[key]);
  });
  return values;
};
const exposed = (el: any) => el.getExposes();
const disabled = (el: any, value: boolean) => {
  expect(exposed(el).disabled.get()).toBe(value);
  expect(el.getAttribute('aria-disabled')).toBe(String(value));
  expect(el.tabIndex).toBe(value ? -1 : 0);
};
// Use the actual WC click route; a DOM event named press.commit is not a host protocol injection.
const commit = (el: HTMLElement) => el.click();
async function resize(props: Record<string, unknown> = {}) {
  const root = node('resizable-root', props);
  document.body.append(root);
  await flush();
  return {
    root,
    api: exposed(root),
    changes: events(root, 'valueChange', 'value'),
    commits: events(root, 'valueCommit', 'value'),
  };
}
it('Resizable retains 50 -> 60 -> 50 proposals while owner rejects all updates', async () => {
  const { api, changes, commits } = await resize({ value: 50 });
  api.requestValue(60);
  api.requestValue(50, true);
  expect(changes).toEqual([60, 50]);
  expect(commits).toEqual([50]);
  expect(api.value.get()).toBe(50);
});
it('Resizable deduplicates normalized proposals but always emits requested commits', async () => {
  const { api, changes, commits } = await resize({ value: 50 });
  api.requestValue(200);
  api.requestValue(100);
  api.requestValue(90, true);
  api.requestValue(90, true);
  expect(changes).toEqual([90, 90]);
  expect(commits).toEqual([90, 90]);
  expect(api.value.get()).toBe(50);
});
it('Resizable resets a completed proposal stream so a rejected value can be requested again', async () => {
  const { api, changes } = await resize({ value: 50 });
  api.requestValue(60, true);
  api.requestValue(60, true);
  expect(changes).toEqual([60, 60]);
});
it('Resizable handles synchronous controlled acceptance without a second value owner', async () => {
  const { root, api, changes, commits } = await resize({ value: 50 });
  root.addEventListener('valueChange', (e: any) =>
    setElementProps(root, { value: e.detail.value })
  );
  api.requestValue(60);
  api.requestValue(60);
  api.requestValue(50, true);
  expect(changes).toEqual([60, 50]);
  expect(commits).toEqual([50]);
  expect(api.value.get()).toBe(50);
});
it('Resizable handles deferred and late owner input and resets the proposal baseline', async () => {
  const { root, api, changes } = await resize({ value: 50 });
  api.requestValue(60);
  await Promise.resolve();
  setElementProps(root, { value: 60 });
  await flush();
  api.requestValue(60);
  api.requestValue(50, true);
  expect(changes).toEqual([60, 50]);
  expect(api.value.get()).toBe(60);
  setElementProps(root, { value: 50 });
  await flush();
  api.requestValue(60);
  expect(changes).toEqual([60, 50, 60]);
  expect(api.value.get()).toBe(50);
});
it('Resizable leaves the proposal cursor intact across unrelated owner props', async () => {
  const { root, api, changes } = await resize({ value: 50 });
  api.requestValue(60);
  setElementProps(root, { value: 50, direction: 'rtl' });
  await flush();
  api.requestValue(50, true);
  expect(changes).toEqual([60, 50]);
});
it('Resizable updates its cursor before synchronous request reentry', async () => {
  const { root, api, changes } = await resize({ value: 50 });
  let entered = false;
  root.addEventListener('valueChange', () => {
    if (!entered) {
      entered = true;
      api.requestValue(60);
      api.requestValue(50);
    }
  });
  api.requestValue(60);
  expect(changes).toEqual([60, 50]);
  expect(api.value.get()).toBe(50);
});
it('Resizable retains a newer reentrant proposal after an outer commit', async () => {
  const { root, api, changes, commits } = await resize({ value: 50 });
  root.addEventListener('valueChange', (e: any) => {
    if (e.detail.value === 60) api.requestValue(70);
  });
  api.requestValue(60, true);
  api.requestValue(70);
  expect(changes).toEqual([60, 70]);
  expect(commits).toEqual([60]);
});
it('Resizable resets on constraints, disabled/readOnly interruption, and controlled exit', async () => {
  const { root, api, changes, commits } = await resize({ value: 50 });
  api.requestValue(60);
  setElementProps(root, { value: 50, max: 55 });
  await flush();
  api.requestValue(60);
  expect(changes).toEqual([60, 55]);
  setElementProps(root, { value: 50, disabled: true });
  await flush();
  expect(api.requestValue(70, true)).toBe(false);
  setElementProps(root, { value: 50, readOnly: true });
  await flush();
  expect(api.requestValue(70, true)).toBe(false);
  expect(commits).toEqual([]);
  setElementProps(root, {});
  await flush();
  api.requestValue(60, true);
  expect(api.value.get()).toBe(60);
  expect(changes).toEqual([60, 55, 60]);
});
it('Resizable preserves collapse normalization and rejects nonfinite requests', async () => {
  const { api, changes, commits } = await resize({ value: 50, collapsible: true });
  api.requestValue(-10);
  api.requestValue(0);
  api.requestValue(50, true);
  expect(changes).toEqual([0, 50]);
  expect(commits).toEqual([50]);
  expect(api.requestValue(NaN, true)).toBe(false);
  expect(api.requestValue(Infinity)).toBe(false);
});
it('Resizable is safe if a synchronous owner listener removes its view', async () => {
  const { root, api } = await resize({ value: 50 });
  root.addEventListener('valueChange', () => root.remove());
  expect(() => api.requestValue(60, true)).not.toThrow();
  await flush();
  expect(() => api.requestValue(70)).toThrow(/terminal disposal/);
});
async function carousel(props = {}, local = {}, withSlides = true) {
  const root = node('carousel-root', props),
    viewport = node('carousel-viewport');
  const slides = [node('carousel-slide', { index: 0 }), node('carousel-slide', { index: 1 })];
  const prev = node('carousel-previous', local),
    next = node('carousel-next', local);
  if (withSlides) viewport.append(...slides);
  root.append(viewport, prev, next);
  document.body.append(root);
  await flush();
  return { root, viewport, slides, prev, next, changes: events(root, 'indexChange', 'index') };
}
it.each(['next', 'prev'] as const)(
  'Carousel %s merges initial local disabled and guards its own commit',
  async (direction) => {
    const { root, next, prev, changes } = await carousel(
      { defaultIndex: direction === 'next' ? 0 : 1 },
      { disabled: true }
    );
    const control = direction === 'next' ? next : prev,
      start = exposed(root).index.get();
    disabled(control, true);
    control.click();
    commit(control);
    await flush();
    expect(exposed(root).index.get()).toBe(start);
    expect(changes).toEqual([]);
  }
);
it.each(['next', 'prev'] as const)(
  'Carousel %s responds to dynamic local disabled/removal',
  async (direction) => {
    const { root, next, prev, changes } = await carousel({
      defaultIndex: direction === 'next' ? 0 : 1,
    });
    const control = direction === 'next' ? next : prev,
      start = exposed(root).index.get();
    setElementProps(control, { disabled: true });
    await flush();
    disabled(control, true);
    commit(control);
    control.click();
    await flush();
    expect(exposed(root).index.get()).toBe(start);
    expect(changes).toEqual([]);
    setElementProps(control, {});
    await flush();
    disabled(control, false);
    commit(control);
    await flush();
    expect(exposed(root).index.get()).toBe(1 - start);
    expect(changes).toEqual([1 - start]);
  }
);
it('Carousel preserves root and boundary disabled through local updates and loop transitions', async () => {
  const { root, next, prev, changes } = await carousel({ disabled: true });
  setElementProps(next, { disabled: false });
  await flush();
  disabled(next, true);
  commit(next);
  expect(changes).toEqual([]);
  setElementProps(root, {});
  await flush();
  disabled(prev, true);
  disabled(next, false);
  setElementProps(prev, { disabled: false });
  await flush();
  disabled(prev, true);
  setElementProps(root, { loop: true });
  await flush();
  disabled(prev, false);
  commit(prev);
  await flush();
  expect(exposed(root).index.get()).toBe(1);
  expect(changes).toEqual([1]);
});
it('Carousel root disable clears nested Button transient facts and rejects keyboard activation', async () => {
  const { root, next, changes } = await carousel();
  next.dispatchEvent(new Event('pointerenter'));
  next.dispatchEvent(new Event('pointerdown'));
  await flush();
  expect(exposed(next).pressed.get()).toBe(true);
  setElementProps(root, { disabled: true });
  await flush();
  disabled(next, true);
  expect(exposed(next).pressed.get()).toBe(false);
  expect(exposed(next).hovered.get()).toBe(false);
  exposed(next).focusSelf({ reason: 'keyboard' });
  next.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  next.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  await flush();
  expect(changes).toEqual([]);
});
async function tree(rootProps = {}, nodeProps = {}, toggleProps = {}) {
  const root = node('tree-root', rootProps),
    branch = node('tree-item', { nodeKey: 'parent', ...nodeProps });
  const child = node('tree-item', { nodeKey: 'child', parentKey: 'parent' }),
    toggle = node('tree-toggle', { nodeKey: 'parent', ...toggleProps });
  root.append(branch, toggle, child);
  document.body.append(root);
  await flush();
  return { root, branch, child, toggle, changes: events(root, 'expandedChange', 'expandedKeys') };
}
it.each(['root', 'node', 'local'] as const)(
  'TreeToggle merges initial %s disabled and suppresses its dispatch',
  async (kind) => {
    const { root, toggle, changes } = await tree(
      kind === 'root' ? { disabled: true } : {},
      kind === 'node' ? { disabled: true } : {},
      kind === 'local' ? { disabled: true } : {}
    );
    disabled(toggle, true);
    toggle.click();
    commit(toggle);
    await flush();
    expect(exposed(root).getExpandedKeys()).toEqual([]);
    expect(changes).toEqual([]);
  }
);
it.each(['root', 'node', 'local'] as const)(
  'TreeToggle synchronizes dynamic %s disabled and re-enable',
  async (kind) => {
    const { root, branch, toggle, changes } = await tree();
    const target = kind === 'root' ? root : kind === 'node' ? branch : toggle;
    setElementProps(target, { ...(kind === 'root' ? {} : { nodeKey: 'parent' }), disabled: true });
    await flush();
    disabled(toggle, true);
    commit(toggle);
    expect(changes).toEqual([]);
    setElementProps(target, kind === 'root' ? {} : { nodeKey: 'parent' });
    await flush();
    disabled(toggle, false);
    commit(toggle);
    await flush();
    expect(exposed(root).getExpandedKeys()).toEqual(['parent']);
  }
);
it('TreeToggle keeps readOnly expansion available and preserves local disabled under Root refresh', async () => {
  const { root, toggle, changes } = await tree({ readOnly: true });
  commit(toggle);
  await flush();
  expect(changes).toEqual([['parent']]);
  setElementProps(toggle, { nodeKey: 'parent', disabled: true });
  await flush();
  exposed(root).refresh();
  await flush();
  disabled(toggle, true);
  commit(toggle);
  expect(changes).toHaveLength(1);
});
it('TreeToggle updates target metadata without inventing leaf/missing focus rules', async () => {
  const { root, toggle, branch, child, changes } = await tree({}, { disabled: true });
  disabled(toggle, true);
  setElementProps(toggle, { nodeKey: 'absent' });
  await flush();
  commit(toggle);
  expect(changes).toEqual([]); // No disabled/tabstop oracle for absent/leaf targets.
  setElementProps(toggle, { nodeKey: 'child' });
  await flush();
  commit(toggle);
  expect(changes).toEqual([]);
  setElementProps(branch, { nodeKey: 'parent' });
  setElementProps(toggle, { nodeKey: 'parent' });
  await flush();
  disabled(toggle, false);
  child.remove();
  await flush();
  commit(toggle);
  expect(changes).toEqual([]);
  const replacement = node('tree-item', { nodeKey: 'new-child', parentKey: 'parent' });
  root.append(replacement);
  await flush();
  commit(toggle);
  expect(changes).toEqual([['parent']]);
});
it('TreeToggle rejects invalid graphs without asserting a new disabled focus policy', async () => {
  const { root, branch, toggle, changes } = await tree();
  setElementProps(branch, { nodeKey: 'parent', parentKey: 'child' });
  await flush();
  expect(exposed(root).invalid.get()).toBe(true);
  commit(toggle);
  expect(changes).toEqual([]);
});
it('TreeToggle does not inherit a different nested Root disabled state', async () => {
  const outer = await tree({ disabled: true });
  const inner = await tree();
  outer.root.append(inner.root);
  await flush();
  disabled(outer.toggle, true);
  disabled(inner.toggle, false);
  commit(inner.toggle);
  await flush();
  expect(inner.changes).toEqual([['parent']]);
  expect(outer.changes).toEqual([]);
});
it('Carousel rechecks local disabled changed synchronously by Button outward click', async () => {
  const { root, next, changes } = await carousel();
  next.addEventListener('click', (e: Event) => {
    if (e instanceof CustomEvent) setElementProps(next, { disabled: true });
  });
  commit(next);
  await flush();
  disabled(next, true);
  expect(exposed(root).index.get()).toBe(0);
  expect(changes).toEqual([]);
});
it('TreeToggle rechecks local disabled changed synchronously by Button outward click', async () => {
  const { root, toggle, changes } = await tree();
  toggle.addEventListener('click', (e: Event) => {
    if (e instanceof CustomEvent) setElementProps(toggle, { nodeKey: 'parent', disabled: true });
  });
  commit(toggle);
  await flush();
  disabled(toggle, true);
  expect(exposed(root).getExpandedKeys()).toEqual([]);
  expect(changes).toEqual([]);
});
it.each(['Enter', ' '] as const)(
  'Carousel keyboard %s has a positive route and respects dynamic disable',
  async (key) => {
    const { root, next, changes } = await carousel({ loop: true });
    exposed(next).focusSelf({ reason: 'keyboard' });
    await flush();
    expect(document.activeElement).toBe(next);
    const press = async () => {
      next.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      next.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      await flush();
    };
    await press();
    expect(changes).toEqual([1]);
    setElementProps(next, { disabled: true });
    await flush();
    await press();
    expect(changes).toEqual([1]);
    expect(exposed(root).index.get()).toBe(1);
  }
);
it.each(['Enter', ' '] as const)(
  'TreeToggle keyboard %s has a positive route and respects dynamic node disable',
  async (key) => {
    const { root, branch, toggle, changes } = await tree({ readOnly: true });
    exposed(toggle).focusSelf({ reason: 'keyboard' });
    await flush();
    expect(document.activeElement).toBe(toggle);
    const press = async () => {
      toggle.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      toggle.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      await flush();
    };
    await press();
    expect(changes).toEqual([['parent']]);
    setElementProps(branch, { nodeKey: 'parent', disabled: true });
    await flush();
    await press();
    expect(changes).toEqual([['parent']]);
    expect(exposed(root).getExpandedKeys()).toEqual(['parent']);
  }
);
