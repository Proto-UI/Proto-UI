import { describe, expect, it } from 'vitest';
import { checkedCall, isTemplateChildType, valueAssignable } from '../src/value-types';
import type { ValueType } from '../src/ir';

const childConsumer: ValueType = {
  kind: 'callable',
  parameters: [{ name: 'child', type: 'template' }],
  returnType: 'template',
};

describe('ordinary template-child callable contract', () => {
  const children: ValueType[] = [
    'template',
    'string',
    'number',
    'null',
    'array',
    { kind: 'literal', value: 'text' },
    { kind: 'array', element: { kind: 'union', members: ['string', 'number', 'null'] } },
    { kind: 'value-union', members: ['template', 'string', 'null'] },
  ];
  it.each(children)('admits the same child domain at a typed callable: %j', (type) => {
    expect(isTemplateChildType(type)).toBe(true);
    expect(valueAssignable(type, 'template')).toBe(true);
    expect(checkedCall(childConsumer, [type])).toBe('template');
  });
  const nonChildren: ValueType[] = [
    'boolean',
    'unknown',
    'void',
    'run',
    'state:string',
    { kind: 'record', fields: [{ name: 'text', type: 'string' }] },
    { kind: 'callable', parameters: [], returnType: 'template' },
    { kind: 'object', fields: [{ name: 'state', type: 'state:string' }] },
    { kind: 'value-union', members: ['template', 'run'] },
    { kind: 'array', element: 'boolean' },
  ];
  it.each(nonChildren)('rejects non-child data and capability transport: %j', (type) => {
    expect(isTemplateChildType(type)).toBe(false);
    expect(valueAssignable(type, 'template')).toBe(false);
    expect(() => checkedCall(childConsumer, [type])).toThrow('Callable argument 1 type mismatch.');
  });
});
