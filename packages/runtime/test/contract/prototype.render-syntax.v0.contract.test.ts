import { PROTOTYPE_RENDER_SYNTAX_CASES } from '@proto.ui/spec-fixtures/core/prototype-render-syntax';
import { createAnatomyFamily, createContextKey, type Prototype } from '@proto.ui/core';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { describe, expect, it } from 'vitest';
import { createRuntimeInstance, executeWithHost, type RuntimeHost } from '../../src';

function caseTitle(specCase: string, fallback: string): string {
  return (
    PROTOTYPE_RENDER_SYNTAX_CASES.find((testCase) => testCase.specCase === specCase)?.title ??
    fallback
  );
}

describe('contract: runtime / prototype render syntax (v0)', () => {
  it(caseTitle('T-CORE-SYNTAX-0001-CASE-SETUP-DEF', 'setup receives the definition handle'), () => {
    let seenDef: any;

    const proto: Prototype = {
      name: 'x-runtime-setup-def',
      setup(def) {
        seenDef = def;
        return () => null;
      },
    };

    createRuntimeInstance(proto);

    expect(typeof seenDef.lifecycle?.onCreated).toBe('function');
    expect(typeof seenDef.props?.define).toBe('function');
    expect(typeof seenDef.update).toBe('undefined');
  });

  it(
    caseTitle(
      'T-CORE-SYNTAX-0001-CASE-SETUP-RETURN-RENDER',
      'setup-returned function becomes render'
    ),
    () => {
      const proto: Prototype = {
        name: 'x-runtime-return-render',
        setup() {
          return (renderer) => renderer.el('div', 'from-render');
        },
      };

      const instance = createRuntimeInstance(proto);

      expect(instance.renderOnce()).toEqual({
        type: 'div',
        style: undefined,
        children: 'from-render',
      });
    }
  );

  it(
    caseTitle(
      'T-CORE-SYNTAX-0001-CASE-SETUP-VOID-DEFAULT',
      'void setup return uses default slot render'
    ),
    () => {
      const proto: Prototype = {
        name: 'x-runtime-default-slot',
        setup() {},
      };

      const instance = createRuntimeInstance(proto);

      expect(instance.renderOnce()).toEqual([
        { type: { kind: 'slot' }, style: undefined, children: null },
      ]);
    }
  );

  it(
    caseTitle(
      'T-CORE-SYNTAX-0001-CASE-SETUP-RETURN-INVALID',
      'setup rejects non-render non-void returns'
    ),
    () => {
      const proto: Prototype = {
        name: 'x-runtime-invalid-setup-return',
        setup() {
          return 1 as any;
        },
      };

      expect(() => createRuntimeInstance(proto)).toThrow();
    }
  );

  it(
    caseTitle(
      'T-CORE-SYNTAX-0001-CASE-RENDER-HANDLE',
      'render receives renderer handle and returns TemplateChildren'
    ),
    () => {
      let seenRenderer: any;

      const proto: Prototype = {
        name: 'x-runtime-renderer-handle',
        setup() {
          return (renderer) => {
            seenRenderer = renderer;
            return [renderer.el('span', 'a'), renderer.el('span', 'b')];
          };
        },
      };

      const instance = createRuntimeInstance(proto);

      expect(instance.renderOnce()).toEqual([
        { type: 'span', style: undefined, children: 'a' },
        { type: 'span', style: undefined, children: 'b' },
      ]);
      expect(typeof seenRenderer.el).toBe('function');
      expect(typeof seenRenderer.slot).toBe('function');
      expect(typeof seenRenderer.r.slot).toBe('function');
      expect(typeof seenRenderer.svg.root).toBe('function');
    }
  );

  it(
    caseTitle(
      'T-CORE-SYNTAX-0001-CASE-RENDER-READ',
      'renderer read exposes current runtime input without write entries'
    ),
    () => {
      const commits: unknown[] = [];
      const REQUIRED_KEY = createContextKey<{ value: string }>('render-read-required-context');
      const OPTIONAL_KEY = createContextKey<{ value: string }>('render-read-optional-context');
      const family = createAnatomyFamily('render-read-anatomy', {
        roles: {
          root: { cardinality: { min: 1, max: 1 } },
        },
      });
      const target = { id: 'render-read-target' };
      const host: RuntimeHost<{ label: string }> = {
        prototypeName: 'x-runtime-render-read',
        getRawProps() {
          return { label: 'from-host' };
        },
        commit(children, signal) {
          commits.push(children);
          signal?.done();
        },
        onRuntimeReady(wiring) {
          wiring.attach('context', [
            [CONTEXT_INSTANCE_TOKEN_CAP, target],
            [CONTEXT_PARENT_CAP, () => null],
          ]);
          wiring.attach('anatomy', [
            [ANATOMY_INSTANCE_TOKEN_CAP, target],
            [ANATOMY_PARENT_CAP, () => null],
            [ANATOMY_GET_PROTO_CAP, () => proto],
            [ANATOMY_ROOT_TARGET_CAP, () => target],
          ]);
        },
        schedule(task) {
          task();
        },
      };

      const proto: Prototype<{ label: string }> = {
        name: 'x-runtime-render-read',
        setup(def) {
          def.props.define({ label: { type: 'string', default: 'fallback' } });
          def.context.provide(REQUIRED_KEY, { value: 'from-context' });
          def.context.provide(OPTIONAL_KEY, { value: 'from-optional-context' });
          def.context.subscribe(REQUIRED_KEY);
          def.context.trySubscribe(OPTIONAL_KEY);
          def.anatomy.claim(family, { role: 'root' });

          return (renderer: any) => {
            expect(typeof renderer.read.props.get).toBe('function');
            expect(typeof renderer.read.props.getRaw).toBe('function');
            expect(typeof renderer.read.props.isProvided).toBe('function');
            expect(typeof renderer.read.context.read).toBe('function');
            expect(typeof renderer.read.context.tryRead).toBe('function');
            expect(typeof renderer.read.context.update).toBe('undefined');
            expect(typeof renderer.read.context.tryUpdate).toBe('undefined');
            expect(typeof renderer.read.anatomy.has).toBe('function');
            expect(typeof renderer.read.anatomy.partsOf).toBe('function');
            expect(typeof renderer.update).toBe('undefined');

            expect(renderer.read.props.get()).toEqual({ label: 'from-host' });
            expect(renderer.read.props.isProvided('label')).toBe(true);
            expect(renderer.read.context.read(REQUIRED_KEY)).toEqual({ value: 'from-context' });
            expect(renderer.read.context.tryRead(OPTIONAL_KEY)).toEqual({
              value: 'from-optional-context',
            });
            expect(renderer.read.anatomy.has(family, 'root')).toBe(true);
            expect(renderer.read.anatomy.partsOf(family, 'root')).toHaveLength(1);

            return renderer.el(
              'div',
              `${renderer.read.props.get().label}:${renderer.read.context.read(REQUIRED_KEY).value}:${
                renderer.read.anatomy.partsOf(family, 'root').length
              }`
            );
          };
        },
      };

      executeWithHost(proto, host);

      expect(commits).toEqual([
        { type: 'div', style: undefined, children: 'from-host:from-context:1' },
      ]);
    }
  );
});
