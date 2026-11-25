// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';
import { loadSupport, supportClosure, typecheckSupport } from './native-support-evidence';
import { compilePrototype } from '../src/compile';

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});

it('typechecks the emitted Overlay dependency closure', () => {
  expect(typecheckSupport(supportClosure(['overlay']).files)).toBe('');
}, 30_000);

function layers() {
  const { plan, files } = supportClosure(['overlay']);
  const create = loadSupport(files)(plan.interactionPath).createNativeInteraction as any;
  return (passive: boolean) => {
    const root = document.createElement('div');
    root.tabIndex = 0;
    document.body.append(root);
    const interaction = create({
      ensureSetup() {},
      ensureRuntime() {},
      ensureEvent() {},
      isAlive: () => true,
      isReady: () => true,
      isSetupComplete: () => true,
      invoke: (callback: () => unknown) => callback(),
      getRoot: () => root,
      getRun: () => ({}),
      getResolvedProps: () => ({}),
      identity: {},
      getLogicalParent: () => null,
      declarations: [],
      registerGenericObservedState() {},
      createOwnedState(_name: string, initial: unknown) {
        let value = initial;
        return {
          get: () => value,
          set(next: unknown) {
            value = next;
          },
          setDefault(next: unknown) {
            value = next;
          },
        };
      },
      registerExpose() {},
    });
    const overlay = interaction.asOverlay();
    overlay.configure({
      defaultOpen: true,
      ...(passive ? { boundaryStack: false } : {}),
      portal: passive,
      modal: false,
      entry: 'manual',
      restore: 'none',
      closeOnOutsidePress: !passive,
      closeOnFocusOutside: !passive,
      closeOnEscape: !passive,
    });
    interaction.mount();
    cleanups.push(() => {
      interaction.dispose();
      root.remove();
    });
    return { overlay, interaction, root };
  };
}

describe.each(['pointer', 'focus', 'escape'] as const)('generated Overlay support: %s', (input) => {
  it('keeps passive presentation transparent to the already-open dismissible owner', () => {
    const create = layers();
    const active = create(false);
    active.root.focus();
    const passive = create(true);
    expect(document.activeElement).toBe(active.root);
    const outside = document.createElement('button');
    document.body.append(outside);
    if (input === 'pointer')
      outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    else if (input === 'focus') outside.focus();
    else active.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(active.overlay.isOpen()).toBe(false);
    expect(passive.overlay.isOpen()).toBe(true);
    if (input === 'focus') expect(document.activeElement).toBe(outside);
  });
});

it('reconciles compiled participation configuration, reopen and view reentry without promoting repeats', () => {
  const create = layers();
  const earlier = create(false);
  const later = create(false);
  earlier.overlay.configure({ boundaryStack: true });
  earlier.overlay.openOverlay();
  earlier.interaction.unmount();
  earlier.interaction.mount();
  const outside = document.createElement('button');
  document.body.append(outside);
  const press = () => {
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    outside.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  };
  press();
  expect(later.overlay.isOpen()).toBe(false);
  expect(earlier.overlay.isOpen()).toBe(true);
  later.overlay.openOverlay();
  later.overlay.configure({ boundaryStack: false, closeOnOutsidePress: false });
  later.overlay.close();
  later.overlay.openOverlay();
  later.interaction.unmount();
  later.interaction.mount();
  press();
  expect(earlier.overlay.isOpen()).toBe(false);
  expect(later.overlay.isOpen()).toBe(true);
});

it('retains a new compiled logical activation during synchronous controlled reopen', () => {
  const create = layers();
  const earlier = create(false);
  const later = create(false);
  const unwatch = earlier.overlay.open.subscribe((event: { next: boolean }) => {
    if (!event.next) earlier.overlay.openOverlay();
  });
  earlier.overlay.close();
  unwatch();
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  expect(earlier.overlay.isOpen()).toBe(false);
  expect(later.overlay.isOpen()).toBe(true);
});

const source = `import {definePrototype} from '@proto.ui/core';
import {asOverlay,asAccessible} from '@proto.ui/hooks';
export default definePrototype({name:'ordinary-passive-layer',setup(def){
 def.props.define({text:{type:'string',default:'initial'}});
 const layer=asOverlay();
 layer.configure({defaultOpen:true,portal:true,boundaryStack:false,modal:false,entry:'manual',restore:'none',closeOnOutsidePress:false,closeOnFocusOutside:false,closeOnEscape:false});
 asAccessible().name('passive-native-portal');
 def.props.watch(['text'],run=>run.update());
 def.expose.method('isOpen',()=>layer.isOpen());
 def.expose.method('show',()=>layer.openOverlay());
 def.expose.method('hide',()=>layer.close());
 return r=>r.el('section',[r.read.props.get().text,r.slot()]);
}});`;

it('keeps unsupported native targets from silently ignoring Boundary stack participation', () => {
  const result = compilePrototype(source, { profile: 'gpui-source-v1' });
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'PUI4003',
        message: 'Overlay boundaryStack configuration is not lowered by gpui-source-v1.',
      })
    );
});

describe.each(nativeOwnerProfiles)('ordinary generated passive portal: %s', (profile) => {
  it('projects outside its native owner and retains updates, close/reopen and cleanup', async () => {
    const owner = await mountNativeOwner(source, profile);
    cleanups.push(owner.dispose);
    const root = () =>
      document.querySelector('[aria-label="passive-native-portal"]') as HTMLElement | null;
    const projection = () => root()?.closest('[data-pui-portal-mount]') ?? root();
    expect(projection()?.parentElement).toBe(document.body);
    expect(owner.host.contains(root())).toBe(false);
    const api = owner.handle.getExposes();
    expect(api.isOpen()).toBe(true);
    await owner.setProps({ text: 'updated' });
    expect((root()?.shadowRoot ?? root())?.textContent).toContain('updated');
    await owner.act(() => api.hide());
    expect(api.isOpen()).toBe(false);
    expect(root()).toBeNull();
    await owner.act(() => api.show());
    expect(projection()?.parentElement).toBe(document.body);
    const liveRoot = root()!;
    const liveProjection = projection()!;
    await owner.dispose();
    expect(liveRoot.isConnected).toBe(false);
    expect(liveProjection.isConnected).toBe(false);
  }, 30_000);
});

it('reclaims a generated WC portal when its original native subtree is removed', async () => {
  const owner = await mountNativeOwner(source, 'web-component-source-v1');
  cleanups.push(owner.dispose);
  const root = document.querySelector('[aria-label="passive-native-portal"]') as HTMLElement;
  expect(root?.parentElement).toBe(document.body);
  const ownerIdentity = (owner.handle as unknown as { logicalOwner: symbol }).logicalOwner;
  const nextParent = document.createElement('article');
  document.body.append(nextParent);
  nextParent.append(owner.host);
  await owner.flush();
  expect(root.parentElement).toBe(document.body);
  expect((owner.handle as unknown as { logicalOwner: symbol }).logicalOwner).toBe(ownerIdentity);
  expect(owner.handle.getExposes().isOpen()).toBe(true);
  owner.host.remove();
  await expect.poll(() => root.isConnected).toBe(false);
}, 30_000);
