import { definePrototype, type DefHandle } from '@proto.ui/core';

let nextId = 0;
const prefix = 'owner';

function allocateId(): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

// A function declaration creates no call or module-initialization effect.
export function unused(): void {
  throw new Error('Unreached authored function must never execute during compilation.');
}

export default definePrototype({
  name: 'module-lexical-values',
  setup(def) {
    const id = allocateId();
    def.expose.value('id', id);
    def.expose.method('allocate', () => allocateId());
    return (renderer) => renderer.el('output', id);
  },
});

function install(def: DefHandle<any>): void {
  let privateCount = 0;
  const count = def.state.numberDiscrete('count', 0);
  def.expose.state('count', count);
  def.expose.method('bump', (next: number) => {
    privateCount += next;
    count.set(privateCount);
  });
  def.expose.method('read', () => privateCount);
}

export const WithState = definePrototype({
  name: 'module-helper-owned-state',
  setup(def) {
    install(def);
  },
});
