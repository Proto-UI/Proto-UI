import { TEMPLATE_AUTHORING_CASES } from '@proto.ui/spec-fixtures/template/authoring';
import { asPrototypeRef } from '@proto.ui/core';
import { describe, expect, it } from 'vitest';
import { commitChildren, ERR_TEMPLATE_PROTOTYPE_REF_V0 } from '../../src/commit';

function caseTitle(specCase: string, fallback: string): string {
  return (
    TEMPLATE_AUTHORING_CASES.find((testCase) => testCase.specCase === specCase)?.title ?? fallback
  );
}

describe('contract: adapter-web-component / template adapter boundary fixture (v0)', () => {
  it(
    caseTitle(
      'T-TEMPLATE-0001-CASE-ROOT-CHILDREN',
      'template output materializes inside the host root'
    ),
    () => {
      const host = document.createElement('x-template-root-boundary');

      commitChildren(host, [
        { type: 'span', children: 'a' },
        { type: 'span', children: 'b' },
      ] as any);

      expect(host.outerHTML).toBe(
        '<x-template-root-boundary><span>a</span><span>b</span></x-template-root-boundary>'
      );
    }
  );

  it(
    caseTitle('T-TEMPLATE-0001-CASE-SLOT', 'slot is anonymous, singular, and parameterless'),
    () => {
      const host = document.createElement('div');
      const slot = { type: { kind: 'slot' }, children: null } as any;

      expect(() => commitChildren(host, [slot, slot] as any)).toThrow(/slot:multiple/);
      expect(() => commitChildren(host, { type: { kind: 'slot', name: 'named' } } as any)).toThrow(
        /slot:named/
      );
      expect(() =>
        commitChildren(host, { type: { kind: 'slot' }, children: ['x'] } as any)
      ).toThrow(/slot:children unsupported/);
      expect(() =>
        commitChildren(host, { type: { kind: 'slot' }, style: { kind: 'tw', tokens: [] } } as any)
      ).toThrow(/slot:style unsupported/);
    }
  );

  it(
    caseTitle(
      'T-TEMPLATE-0001-CASE-PROTOTYPE-REF',
      'PrototypeRef template type is rejected by adapters'
    ),
    () => {
      const proto = {
        name: 'x-template-ref-target',
        setup() {
          return () => null;
        },
      } as any;

      const host = document.createElement('div');
      const bad = {
        type: asPrototypeRef(proto),
        children: null,
      } as any;

      expect(() => commitChildren(host, bad)).toThrowError(ERR_TEMPLATE_PROTOTYPE_REF_V0);
    }
  );
});
