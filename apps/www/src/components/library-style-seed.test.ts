import { expect, expectTypeOf, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import type {
  ProtoWebComponentProps,
  WebComponentAdapterConstructor,
} from '@proto.ui/adapter-web-component';
import { withLibraryStyleSeed } from './library-style-seed';

let next = 0;
function fixture(onConnect: (host: HTMLElement) => void = () => {}) {
  class Adapter extends HTMLElement {
    update() {}
    getExposes() {
      return {};
    }
    connectedCallback() {
      onConnect(this);
    }
  }
  const Enhanced = withLibraryStyleSeed(Adapter);
  const tag = `library-seed-control-${next++}`;
  customElements.define(tag, Enhanced);
  const host = document.createElement(tag);
  const connect = () =>
    Reflect.apply(Reflect.get(Enhanced.prototype, 'connectedCallback'), host, []);
  return { host, connect };
}
const tokens = (host: HTMLElement) =>
  (host.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);

it('preserves typed props and exposes without emitting a physical props carrier', () => {
  type SeedPrototype = Prototype<
    { tone: 'quiet' | 'strong'; count?: number },
    { readCount: () => number }
  >;
  class Adapter extends HTMLElement {
    declare readonly __protoUiProps?: ProtoWebComponentProps<SeedPrototype>;
    update() {}
    getExposes() {
      return { readCount: () => 2 };
    }
    connectedCallback() {}
  }
  const Enhanced = withLibraryStyleSeed<WebComponentAdapterConstructor<SeedPrototype>>(Adapter);
  expectTypeOf(Enhanced).toEqualTypeOf<WebComponentAdapterConstructor<SeedPrototype>>();
  expectTypeOf(Enhanced.prototype.__protoUiProps).toEqualTypeOf<
    ProtoWebComponentProps<SeedPrototype> | undefined
  >();
  expectTypeOf(Enhanced.prototype.getExposes).returns.toEqualTypeOf<{
    readCount: () => number;
  }>();
  expectTypeOf<
    NonNullable<InstanceType<typeof Enhanced>['__protoUiProps']>['tone']
  >().toEqualTypeOf<'quiet' | 'strong'>();
  const tag = `library-seed-control-${next++}`;
  customElements.define(tag, Enhanced);
  const host = new Enhanced();
  expect(host.getExposes().readCount()).toBe(2);
  expect(Object.hasOwn(host, '__protoUiProps')).toBe(false);
});

it('retires only explicitly owned server tokens before the first live connection', () => {
  const seen: string[][] = [];
  const f = fixture((host) => {
    seen.push(tokens(host));
    host.setAttribute('data-pui-style', [...tokens(host), 'transition-colors'].join(' '));
  });
  f.host.dataset.libraryStyleSeed = JSON.stringify(['transition-none', 'rounded-full']);
  f.host.setAttribute('data-pui-style', 'external transition-none rounded-full');
  f.host.className = 'consumer-class';
  f.host.style.color = 'red';
  f.connect();
  expect(seen).toEqual([['external']]);
  expect(tokens(f.host)).toEqual(['external', 'transition-colors']);
  expect(f.host.hasAttribute('data-library-style-seed')).toBe(false);
  expect(f.host.className).toBe('consumer-class');
  expect(f.host.style.color).toBe('red');
});

it('does not withdraw live tokens when the same physical element reconnects', () => {
  const seen: string[][] = [];
  const f = fixture((host) => seen.push(tokens(host)));
  f.host.dataset.libraryStyleSeed = JSON.stringify(['bg-background']);
  f.host.setAttribute('data-pui-style', 'bg-background external');
  f.connect();
  f.host.setAttribute('data-pui-style', 'bg-background external live-token');
  f.host.dataset.libraryStyleSeed = JSON.stringify(['bg-background']);
  f.connect();
  expect(seen).toEqual([['external'], ['bg-background', 'external', 'live-token']]);
  expect(tokens(f.host)).toEqual(['bg-background', 'external', 'live-token']);
});

it.each([undefined, 'invalid-json', 'null', '{}', '[2]', '["two tokens"]', '[""]'])(
  'preserves unowned tokens for an absent or invalid seed %s',
  (seed) => {
    const f = fixture();
    if (seed !== undefined) f.host.setAttribute('data-library-style-seed', seed);
    f.host.setAttribute('data-pui-style', 'external transition-none');
    f.connect();
    expect(tokens(f.host)).toEqual(['external', 'transition-none']);
    expect(f.host.getAttribute('data-library-style-seed')).toBe(seed ?? null);
  }
);

it('rolls back its contribution without losing additions made during a failed connection', () => {
  let fail = true;
  const f = fixture((host) => {
    if (fail) {
      host.setAttribute('data-pui-style', [...tokens(host), 'new-external'].join(' '));
      throw new Error('connection failed');
    }
    host.setAttribute('data-pui-style', [...tokens(host), 'transition-colors'].join(' '));
  });
  f.host.dataset.libraryStyleSeed = JSON.stringify(['transition-none']);
  f.host.setAttribute('data-pui-style', 'external transition-none');
  expect(f.connect).toThrow('connection failed');
  expect(tokens(f.host)).toEqual(['external', 'new-external', 'transition-none']);
  expect(f.host.dataset.libraryStyleSeed).toBe('["transition-none"]');
  fail = false;
  f.connect();
  expect(tokens(f.host)).toEqual(['external', 'new-external', 'transition-colors']);
  expect(f.host.hasAttribute('data-library-style-seed')).toBe(false);
});

it('does not restore an obsolete seed after a failing host replaces that seed', () => {
  const f = fixture((host) => {
    host.dataset.libraryStyleSeed = JSON.stringify(['new-seed']);
    host.setAttribute('data-pui-style', 'new-seed external');
    throw new Error('replaced seed');
  });
  f.host.dataset.libraryStyleSeed = JSON.stringify(['old-seed']);
  f.host.setAttribute('data-pui-style', 'old-seed external');
  expect(f.connect).toThrow('replaced seed');
  expect(tokens(f.host)).toEqual(['new-seed', 'external']);
  expect(f.host.dataset.libraryStyleSeed).toBe('["new-seed"]');
});

it('does not repeat seed withdrawal during synchronous connection reentry', () => {
  let calls = 0;
  const f = fixture((host) => {
    calls++;
    if (calls === 1) {
      host.setAttribute('data-pui-style', [...tokens(host), 'bg-background'].join(' '));
      f.connect();
    }
  });
  f.host.dataset.libraryStyleSeed = JSON.stringify(['bg-background']);
  f.host.setAttribute('data-pui-style', 'bg-background external');
  f.connect();
  expect(calls).toBe(2);
  expect(tokens(f.host)).toEqual(['external', 'bg-background']);
  expect(f.host.hasAttribute('data-library-style-seed')).toBe(false);
});
