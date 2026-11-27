import assert from 'node:assert/strict';
import { authoredPairSource } from './authoring-source.mjs';

// The author producer normally forwards later references as block arguments.
// In this direct IR the caller's label is first read in the final block.
export function directPair() {
  const source = { file: 'packages/compiler/test/fixtures/direct-pair.mjs', start: 0, end: 0 };
  const authored = authoredPairSource();
  assert.equal(authored.status, 'produced', JSON.stringify(authored.diagnostics));
  const component = authored.component;
  const task = component.behaviors.find(fn => fn.binding.id === component.tasks[0].fn);
  const [firstId, label] = task.params;
  const local = id => ({ kind: 'local', id });
  const binding = id => ({ id, name: id, type: 'text', source });
  const wait = (arg, next) => ({
    kind: 'await', extern: component.externs[0].binding.id, args: [arg], resume: { block: next, args: [] }, source,
  });
  task.entry = 'first';
  task.blocks = [
    { id: 'first', params: [], instructions: [], end: wait(local(firstId.id), 'second') },
    { id: 'second', params: [binding('firstResult')], instructions: [], end: wait({ kind: 'text', value: 'B' }, 'resumed') },
    {
      id: 'resumed', params: [binding('secondResult')], instructions: [],
      end: { kind: 'jump', to: { block: 'publish', args: [local('secondResult')] }, source },
    },
    {
      id: 'publish', params: [binding('result')],
      instructions: [{
        kind: 'write', target: component.fields[0].binding.id, source,
        value: { kind: 'binary', op: 'concat', left: local(label.id), right: local('result') },
      }],
      end: { kind: 'return', source },
    },
  ];
  return { status: 'produced', inputKind: 'direct-ir', component };
}
