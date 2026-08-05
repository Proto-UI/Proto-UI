// packages/core/test/contract/prototype.module-declarations.v0.contract.test.ts
import { describe, expect, it } from 'vitest';
import {
  declareModule,
  defineAsHook,
  definePrototype,
  getModuleDeclaration,
  moduleDeclaration,
} from '../../src';
import type { ModuleDeclarationToken, PrototypeModuleDeclaration } from '../../src';

/**
 * Static module declaration substrate (Task 0 prerequisite). Core substrate
 * only — business-neutral; no component protocol semantics here.
 *
 * Backs C-CORE-SYNTAX-0003-compatible Prototype.modules metadata: declarations
 * are authored once on the prototype and reused by adapters through an
 * immutable lookup. definePrototype freezes the surface and rejects duplicate
 * token IDs deterministically (fail-fast).
 */
describe('contract: core / prototype static module declarations (v0)', () => {
  it('creates a typed token from a string id and stores the id on the token', () => {
    const token = moduleDeclaration<{ hostElement: string }>('M-CORE-DECL-TEST');
    expect(token.id).toBe('M-CORE-DECL-TEST');
    // token identity is unique even for equal ids; ids compare equal.
    const other = moduleDeclaration('M-CORE-DECL-TEST');
    expect(other).not.toBe(token);
    expect(other.id).toBe(token.id);
  });

  it('declareModule produces a PrototypeModuleDeclaration bound to the token', () => {
    type Cfg = { control: 'input' | 'textarea' };
    const token: ModuleDeclarationToken<Cfg> = moduleDeclaration('M-CORE-DECL-BOUND');
    const declaration: PrototypeModuleDeclaration<Cfg> = declareModule(token, {
      control: 'input',
    });
    expect(declaration.id).toBe('M-CORE-DECL-BOUND');
    expect(declaration.config).toEqual({ control: 'input' });
  });

  it('rejects declareModule when the token is not a ModuleDeclarationToken', () => {
    expect(() =>
      declareModule({ id: 'pretend' } as unknown as ModuleDeclarationToken<unknown>, {})
    ).toThrow(/module declaration|ModuleDeclarationToken/);
  });

  it('definePrototype throws on duplicate token ids (fail-fast)', () => {
    const tokenA = moduleDeclaration('M-CORE-DECL-DUP');
    const tokenB = moduleDeclaration('M-CORE-DECL-DUP');
    expect(() =>
      definePrototype({
        name: 'x-core-decl-dup',
        setup() {},
        modules: [declareModule(tokenA, { v: 1 }), declareModule(tokenB, { v: 2 })],
      })
    ).toThrow(/duplicate|module declaration/);
  });

  it('definePrototype freezes the declarations view and preserves the first winning declaration', () => {
    const tokenWin = moduleDeclaration('M-CORE-DECL-FIRST');
    const proto = definePrototype({
      name: 'x-core-decl-first',
      setup() {},
      modules: [declareModule(tokenWin, { v: 'keep' })],
    });
    expect(proto.modules).toHaveLength(1);
    expect(Object.isFrozen(proto.modules)).toBe(true);
    expect(proto.modules?.[0]?.id).toBe('M-CORE-DECL-FIRST');
  });

  it('getModuleDeclaration returns the matching typed declaration and undefined for an absent token', () => {
    type Cfg = { k: string };
    const token: ModuleDeclarationToken<Cfg> = moduleDeclaration('M-CORE-DECL-LOOKUP');
    const otherToken = moduleDeclaration('M-CORE-DECL-ABSENT');
    const proto = definePrototype({
      name: 'x-core-decl-lookup',
      setup() {},
      modules: [declareModule(token, { k: 'v' })],
    });
    const found = getModuleDeclaration(proto, token);
    expect(found).toBeDefined();
    expect(found?.id).toBe('M-CORE-DECL-LOOKUP');
    expect(found?.config.k).toBe('v');
    expect(getModuleDeclaration(proto, otherToken)).toBeUndefined();
  });

  it('getModuleDeclaration returns undefined on a prototype with no modules', () => {
    const token = moduleDeclaration('M-CORE-DECL-NO-MODS');
    const proto = definePrototype({
      name: 'x-core-decl-no-mods',
      setup() {},
    });
    expect(getModuleDeclaration(proto, token)).toBeUndefined();
  });

  it('freezes each declaration and its config surface (shallow)', () => {
    type Cfg = { a: number };
    const token: ModuleDeclarationToken<Cfg> = moduleDeclaration('M-CORE-DECL-FROZEN');
    const proto = definePrototype({
      name: 'x-core-decl-frozen',
      setup() {},
      modules: [declareModule(token, { a: 1 })],
    });
    const decl = getModuleDeclaration(proto, token);
    expect(Object.isFrozen(decl)).toBe(true);
    expect(Object.isFrozen(decl?.config)).toBe(true);
  });

  it('lets authored asHooks publish frozen static module requirements for caller definitions', () => {
    const token = moduleDeclaration<{ kind: 'plain-text' }>('M-CORE-DECL-AS-HOOK');
    const asTextEditing = defineAsHook({
      name: 'as-text-editing',
      modules: [declareModule(token, { kind: 'plain-text' })],
      setup() {},
    });
    const proto = definePrototype({
      name: 'x-core-decl-as-hook',
      modules: asTextEditing.modules,
      setup() {},
    });

    expect(Object.isFrozen(asTextEditing.modules)).toBe(true);
    expect(asTextEditing.definition.modules).toBe(asTextEditing.modules);
    expect(getModuleDeclaration(proto, token)?.config).toEqual({ kind: 'plain-text' });
  });

  it('rejects duplicate module requirement ids on authored asHooks', () => {
    const first = moduleDeclaration('M-CORE-DECL-AS-HOOK-DUP');
    const second = moduleDeclaration('M-CORE-DECL-AS-HOOK-DUP');
    expect(() =>
      defineAsHook({
        name: 'as-duplicate-static-requirement',
        modules: [declareModule(first, {}), declareModule(second, {})],
        setup() {},
      })
    ).toThrow(/AsHook.*duplicate module declaration/);
  });
});
