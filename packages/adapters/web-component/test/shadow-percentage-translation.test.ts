import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype, tw, type RunHandle } from '@proto.ui/core';
import { createRootStyleEffect, resolveRootStyleEntry } from '@proto.ui/core/internal';
import { CapsVault, type ModuleDeps } from '@proto.ui/module-base';
import {
  EXPOSE_STATE_EXTERNAL_HANDLE,
  type ExposeStateExternalHandle,
  type ExposeStatePort,
} from '@proto.ui/module-expose-state';
import type { StateEvent, StateSpec } from '@proto.ui/types';
import { ExposeStateWebModuleImpl } from '../../../modules/expose-state-web/src/impl';
import {
  HOST_ELEMENT_CAP,
  EXPOSE_STATE_WEB_MIRROR_TARGETS_CAP,
} from '../../../modules/expose-state-web/src/caps';
import { renderProtoShadowSplitStyleArtifact } from '../../../cli/src/services/proto-style-css';
import { AdaptToWebComponent } from '../src';
import { captureShadowPercentageSource } from '../src/shadow-percentage-source';
import { createShadowSplitEffectsPort } from '../src/shadow-split-effects';
import {
  rewriteSplitBaseDeclarations,
  rewriteSplitRuleDeclarations,
} from './shadow-split-test-utils';

const staticToken = 'translate-x-[calc(100%_-_4px)]';
const rtlStatic = [
  'translate-x-[-0.0625rem]',
  'translate-x-[calc(2px_-_100%)]',
  'translate-x-[calc(8px_-_100%)]',
  'translate-x-[calc(-100%_-_2px)]',
  'translate-x-[calc(4px_-_100%)]',
];
const remDynamic = [
  'translate-x-[calc(0.0625rem_+_(100%_+_2px_-_0.0625rem)*var(--pui-percentage)/100)]',
  'translate-x-[calc(-0.0625rem_-_(100%_+_2px_-_0.0625rem)*var(--pui-percentage)/100)]',
];
const dynamic = [
  'translate-x-[calc((100%_-_2px)*var(--pui-percentage)/100)]',
  'translate-x-[calc((100%_-_4px)*var(--pui-percentage)/100)]',
  'translate-x-[calc((100%_-_8px)*var(--pui-percentage)/100)]',
  'translate-x-[calc((2px_-_100%)*var(--pui-percentage)/100)]',
  'translate-x-[calc((4px_-_100%)*var(--pui-percentage)/100)]',
  'translate-x-[calc((8px_-_100%)*var(--pui-percentage)/100)]',
  'translate-x-[calc(1px_+_(100%_+_1px)*var(--pui-percentage)/100)]',
  'translate-x-[calc(-1px_-_(100%_+_1px)*var(--pui-percentage)/100)]',
  ...remDynamic,
];
const marker = '--pui-split-percentage-translation-recipe: v1;';
const effect = (tokens: string[]) =>
  createRootStyleEffect(tokens.map((token) => resolveRootStyleEntry(token, 'runtime')));

// A controlled external source tests the actual Web projection module's
// binding/lease lifetime. Full Adapter cases below use real authored State.
function source(
  id = 1,
  spec: StateSpec = { kind: 'number.range', min: 0, max: 100 },
  semantic = 'percentage'
) {
  let value: unknown = 25;
  const listeners = new Set<(event: StateEvent<unknown>) => void>();
  const handle: ExposeStateExternalHandle<unknown> & {
    __stateId: number;
    __stateSemantic: string;
  } = {
    [EXPOSE_STATE_EXTERNAL_HANDLE]: true,
    __stateId: id,
    __stateSemantic: semantic,
    spec,
    get: () => value,
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    unsubscribe(off) {
      off();
    },
  };
  return {
    handle,
    listeners,
    set(next: unknown) {
      const prev = value;
      value = next;
      for (const callback of [...listeners]) callback({ type: 'next', prev, next });
    },
  };
}

function fixture(
  options: {
    source?: ReturnType<typeof source>;
    second?: ReturnType<typeof source>;
    bind?: boolean;
    oldProvider?: boolean;
    css?: (css: string) => string;
  } = {}
) {
  const state = options.source ?? source();
  const record: Record<string, unknown> = { percentage: state.handle };
  if (options.second) record.other = options.second.handle;
  const exposeState: ExposeStatePort = {
    get: (key) => record[key],
    getAll: () => ({ ...record }),
  };
  const deps: ModuleDeps = {
    requirePort<T>(name: string): T {
      if (name !== 'expose-state') throw new Error(`Unexpected dependency ${name}`);
      return exposeState as T;
    },
    requireFacade() {
      throw new Error('No facade dependency');
    },
    tryFacade: () => undefined,
    tryPort: () => undefined,
  };
  const caps = new CapsVault();
  const web = new ExposeStateWebModuleImpl(caps, deps);
  web.onMountPhase('mounting', 1);
  const host = document.createElement('x-percentage-recipe');
  const surface = document.createElement('div');
  host.attachShadow({ mode: 'open' }).append(surface);
  surface.setAttribute('data-pui-style', 'consumer');
  let ownerCurrent = true;
  const capture = () =>
    captureShadowPercentageSource({
      host,
      exposeState,
      exposeStateWeb: options.oldProvider
        ? { ...web.port, isCurrentCssVarProjection: undefined }
        : web.port,
      isOwnerCurrent: () => ownerCurrent,
    });
  const bind = (target = host, mirror: HTMLElement | null = null) =>
    caps.attach([
      [HOST_ELEMENT_CAP, target],
      [EXPOSE_STATE_WEB_MIRROR_TARGETS_CAP, () => [mirror]],
    ]);
  if (options.bind !== false) bind();
  const generated = renderProtoShadowSplitStyleArtifact([
    'block',
    'bg-black',
    staticToken,
    ...rtlStatic,
    ...dynamic,
  ]);
  const artifact = {
    ...generated,
    cssText: options.css ? options.css(generated.cssText) : generated.cssText,
  };
  const effects = createShadowSplitEffectsPort({
    host,
    surface,
    artifact,
    prototypeName: 'percentage-recipe-test',
    capturePercentageSource: capture,
  });
  effects.queueStyle(effect(['block', 'bg-black']));
  effects.flushNow!();
  return {
    host,
    surface,
    state,
    record,
    web,
    caps,
    effects,
    artifact,
    capture,
    bind,
    retireOwner() {
      ownerCurrent = false;
    },
    snapshot: () => [host.outerHTML, surface.outerHTML],
    dispose() {
      effects.dispose();
      web.dispose();
      host.remove();
    },
  };
}

const flush = async () => {
  for (let turn = 0; turn < 12; turn++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('draft finite percentage translation recipe and current owner proof', () => {
  it.each(dynamic)('projects %s only once through the current owner source', (token) => {
    const f = fixture();
    try {
      for (const percentage of [0, 25, 50, 75, 100]) {
        f.state.set(percentage);
        f.effects.queueStyle(effect(['block', 'bg-black', token]));
        f.effects.flushNow!();
        expect(f.host.getAttribute('data-pui-split-root-style')).toContain(token);
        expect(f.surface.getAttribute('data-pui-style')).toBe('consumer block bg-black');
        expect(f.host.style.getPropertyValue('--pui-percentage')).toBe(String(percentage));
        expect(f.capture()?.isCurrent()).toBe(true);
        expect(f.state.listeners.size).toBe(1);
      }
      f.effects.queueStyle(effect(['block']));
      f.effects.flushNow!();
      expect(f.host.getAttribute('data-pui-split-root-style')).toBe('block');
    } finally {
      f.dispose();
    }
    expect(f.state.listeners.size).toBe(0);
    expect(f.surface.getAttribute('data-pui-style')).toBe('consumer');
  });

  it.each([staticToken, ...rtlStatic])(
    'keeps %s static without a percentage source or Web binding',
    (token) => {
      const f = fixture({ bind: false });
      try {
        delete f.record.percentage;
        for (const value of ['', '0', '50', '100', 'invalid']) {
          f.host.style.setProperty('--pui-percentage', value);
          f.effects.queueStyle(effect(['block', token]));
          f.effects.flushNow!();
          expect(f.host.getAttribute('data-pui-split-root-style')).toBe(`block ${token}`);
          expect(f.surface.getAttribute('data-pui-style')).toBe('consumer block');
        }
      } finally {
        f.dispose();
      }
    }
  );

  it.each([...rtlStatic, ...remDynamic])(
    'rejects a re-receipted wrong operand for the exact RTL/rem token %s',
    (token) => {
      const selector = `:host([data-pui-split-root-style~="${token}"])`;
      const f = fixture({
        css: (css) =>
          rewriteSplitRuleDeclarations(css, selector, (declarations) =>
            declarations.replace(/--pui-translate-x:[^;]+;/, '--pui-translate-x: 999px;')
          ),
      });
      try {
        const before = f.snapshot();
        expect(() => f.effects.queueStyle(effect([token]))).toThrow(/missing token/);
        f.effects.flushNow!();
        expect(f.snapshot()).toEqual(before);
      } finally {
        f.dispose();
      }
    }
  );

  it.each(
    remDynamic.flatMap((token) =>
      [
        'absent',
        'wrong-range',
        'revoked',
        'retired-owner',
        'replaced-handle',
        'foreign-priority',
      ].map((fault) => ({ token, fault }))
    )
  )('keeps the current-owner proof for $token after $fault', ({ token, fault }) => {
    const f = fixture({
      source:
        fault === 'wrong-range' ? source(1, { kind: 'number.range', min: 0, max: 1 }) : undefined,
    });
    try {
      const before = f.snapshot();
      if (fault === 'absent') delete f.record.percentage;
      if (fault === 'absent' || fault === 'wrong-range') {
        expect(() => f.effects.queueStyle(effect([token]))).toThrow(/percentage owner source/);
      } else {
        f.effects.queueStyle(effect([token]));
        if (fault === 'revoked') f.caps.resetAttached();
        if (fault === 'retired-owner') f.retireOwner();
        if (fault === 'replaced-handle') f.record.percentage = source().handle;
        if (fault === 'foreign-priority')
          f.host.style.setProperty('--pui-percentage', '25', 'important');
        const beforeFlush = f.snapshot();
        expect(() => f.effects.flushNow!()).toThrow(/percentage source not current/);
        expect(f.snapshot()).toEqual(beforeFlush);
        return;
      }
      expect(f.snapshot()).toEqual(before);
    } finally {
      f.dispose();
    }
  });

  it('admits a captured declaration only after its actual Web projection activates', () => {
    const f = fixture({ bind: false });
    try {
      expect(f.capture()).not.toBeNull();
      f.effects.queueStyle(effect([dynamic[0]!]));
      const before = f.snapshot();
      expect(() => f.effects.flushNow!()).toThrow(/percentage source not current/);
      expect(f.snapshot()).toEqual(before);
      f.bind();
      f.effects.queueStyle(effect([dynamic[0]!]));
      f.effects.flushNow!();
      expect(f.host.getAttribute('data-pui-split-root-style')).toBe(dynamic[0]);
    } finally {
      f.dispose();
    }
  });

  it('does not treat an older provider candidate map as an actual projection witness', () => {
    const f = fixture({ oldProvider: true });
    try {
      expect(f.web.port.isActive()).toBe(true);
      expect(f.host.style.getPropertyValue('--pui-percentage')).toBe('25');
      f.effects.queueStyle(effect([dynamic[0]!]));
      const before = f.snapshot();
      expect(() => f.effects.flushNow!()).toThrow(/percentage source not current/);
      expect(f.snapshot()).toEqual(before);
    } finally {
      f.dispose();
    }
  });

  it('rejects a neighboring expression atomically even with a valid current source', () => {
    const f = fixture();
    try {
      expect(f.capture()?.isCurrent()).toBe(true);
      const before = f.snapshot();
      expect(() =>
        f.effects.queueStyle(effect(['translate-x-[calc((100%_-_3px)*var(--pui-percentage)/100)]']))
      ).toThrow(/unresolved-role/);
      f.effects.flushNow!();
      expect(f.snapshot()).toEqual(before);
    } finally {
      f.dispose();
    }
  });

  it.each(['old-companion', 'wrong-operand', 'wrong-transform', 'missing-host-rule'])(
    'rejects %s before either target changes',
    (fault) => {
      const token = dynamic[0]!;
      const selector = `:host([data-pui-split-root-style~="${token}"])`;
      const f = fixture({
        css(css) {
          if (fault === 'old-companion')
            return rewriteSplitBaseDeclarations(css, (declarations) =>
              declarations.replace(marker, '')
            );
          if (fault === 'missing-host-rule') {
            const start = css.indexOf(`${selector} {`);
            const end = css.indexOf('}', start);
            expect(start).toBeGreaterThan(-1);
            return css.slice(0, start) + css.slice(end + 1);
          }
          return rewriteSplitRuleDeclarations(css, selector, (declarations) =>
            fault === 'wrong-operand'
              ? declarations.replace('100% - 2px', '100% - 3px')
              : declarations.replaceAll(
                  'scale(var(--pui-scale-x, 1)',
                  'scale(var(--pui-scale-x, 2)'
                )
          );
        },
      });
      try {
        const before = f.snapshot();
        expect(() => f.effects.queueStyle(effect([token]))).toThrow(
          fault === 'old-companion' ? /percentage translation recipe/ : /missing token/
        );
        f.effects.flushNow!();
        expect(f.snapshot()).toEqual(before);
      } finally {
        f.dispose();
      }
    }
  );

  it.each(['absent', 'inherited-only', 'same-name-only', 'wrong-range', 'wrong-semantic'])(
    'rejects %s as a percentage source',
    (fault) => {
      const f = fixture({
        source:
          fault === 'wrong-range'
            ? source(1, { kind: 'number.range', min: 0, max: 1 })
            : fault === 'wrong-semantic'
              ? source(1, undefined, 'other')
              : source(),
        bind: false,
      });
      try {
        if (fault === 'absent' || fault === 'inherited-only' || fault === 'same-name-only')
          delete f.record.percentage;
        if (fault === 'same-name-only') f.host.style.setProperty('--pui-percentage', '25');
        if (fault === 'inherited-only') {
          const parent = document.createElement('div');
          parent.style.setProperty('--pui-percentage', '25');
          parent.append(f.host);
          document.body.append(parent);
        }
        const before = f.snapshot();
        expect(() => f.effects.queueStyle(effect([dynamic[0]!]))).toThrow(
          /percentage owner source/
        );
        expect(f.snapshot()).toEqual(before);
      } finally {
        f.dispose();
      }
    }
  );

  it.each(['rebound-target', 'revoked', 'retired-owner', 'replaced-handle', 'foreign-priority'])(
    'rejects a queued effect after %s while preserving the old admitted projection',
    (fault) => {
      const f = fixture();
      try {
        f.effects.queueStyle(effect([dynamic[0]!]));
        if (fault === 'rebound-target') f.bind(document.createElement('div'));
        if (fault === 'revoked') f.caps.resetAttached();
        if (fault === 'retired-owner') f.retireOwner();
        if (fault === 'replaced-handle') f.record.percentage = source().handle;
        if (fault === 'foreign-priority')
          f.host.style.setProperty('--pui-percentage', '25', 'important');
        const before = f.snapshot();
        expect(() => f.effects.flushNow!()).toThrow(/percentage source not current/);
        expect(f.snapshot()).toEqual(before);
        f.effects.flushNow!();
        expect(f.snapshot()).toEqual(before);
      } finally {
        f.dispose();
      }
    }
  );

  it('rejects mapped collisions and a same-valued mirror as canonical target proof', () => {
    const collision = fixture({ second: source(2) });
    try {
      collision.effects.queueStyle(effect([dynamic[0]!]));
      const before = collision.snapshot();
      expect(() => collision.effects.flushNow!()).toThrow(/percentage source not current/);
      expect(collision.snapshot()).toEqual(before);
    } finally {
      collision.dispose();
    }
    const f = fixture();
    try {
      const other = document.createElement('div');
      f.bind(other, f.host);
      expect(f.host.style.getPropertyValue('--pui-percentage')).toBe('25');
      expect(f.web.port.isCurrentCssVarProjection(f.state.handle, other, '--pui-percentage')).toBe(
        true
      );
      expect(f.capture()?.isCurrent()).toBe(false);
    } finally {
      f.dispose();
    }
  });

  it.each([NaN, Infinity, -1, 101])('rejects out-of-domain live progress %s', (value) => {
    const f = fixture();
    try {
      f.state.set(value);
      f.effects.queueStyle(effect([dynamic[0]!]));
      const before = f.snapshot();
      expect(() => f.effects.flushNow!()).toThrow(/percentage source not current/);
      expect(f.snapshot()).toEqual(before);
    } finally {
      f.dispose();
    }
  });
});

let serial = 0;
it('uses actual independent authored State through public WC mount, updates and retained remount', async () => {
  let setups = 0;
  const token = dynamic[0]!;
  const proto = definePrototype({
    name: `percentage-state-public-${++serial}`,
    setup(def) {
      setups++;
      const percentage = def.state.numberRange('percentage', 0, { min: 0, max: 100 });
      let run!: RunHandle<Record<string, unknown>>;
      def.lifecycle.onCreated((current) => {
        run = current;
      });
      def.expose.state('percentage', percentage);
      def.expose.method('move', (next: number) => percentage.set(next));
      def.expose.method('present', (next: boolean) => run.lifecycle.setPresent(next));
      def.feedback.style.use(tw(`block size-4 ${token}`));
      return (r) => r.slot();
    },
  });
  const C = AdaptToWebComponent(proto, {
    shadow: {
      mode: 'open',
      presentation: 'split',
      styleArtifact: renderProtoShadowSplitStyleArtifact(['block', 'size-4', token]),
    },
    schedule: (task) => task(),
  });
  const parent = new C();
  const child = new C();
  const caller = document.createElement('span');
  caller.textContent = 'caller';
  child.append(caller);
  parent.append(child);
  document.body.append(parent);
  await flush();
  type Controls = {
    move(value: number): void;
    present(value: boolean): void;
    percentage: { get(): number };
  };
  const outer = parent.getExposes() as Controls;
  const inner = child.getExposes() as Controls;
  outer.move(75);
  for (const value of [0, 25, 50, 75, 100]) {
    inner.move(value);
    expect(inner.percentage.get()).toBe(value);
    expect(child.style.getPropertyValue('--pui-percentage')).toBe(String(value));
    expect(parent.style.getPropertyValue('--pui-percentage')).toBe('75');
    expect(child.getAttribute('data-pui-split-root-style')).toContain(token);
    expect(
      child.shadowRoot!.querySelector('[part="surface"]')!.getAttribute('data-pui-style')
    ).not.toContain(token);
  }
  inner.present(false);
  await flush();
  expect(child.hasAttribute('data-pui-split-root-style')).toBe(false);
  inner.move(50);
  inner.present(true);
  await flush();
  expect(child.style.getPropertyValue('--pui-percentage')).toBe('50');
  expect(child.getAttribute('data-pui-split-root-style')).toContain(token);
  expect(child.shadowRoot!.querySelector('slot')!.assignedNodes()).toContain(caller);
  expect(child.firstChild).toBe(caller);
  expect(setups).toBe(2);
  parent.remove();
  await flush();
  expect(child.shadowRoot!.childNodes).toHaveLength(0);
});
