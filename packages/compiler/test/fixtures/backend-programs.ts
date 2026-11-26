import type {
  Behavior,
  Binding,
  Block,
  ComponentIR,
  ElementView,
  Instruction,
  SourceSpan,
  Terminator,
  Value,
  ValueType,
} from '../../src/targets/component-ir.ts';

// These cases enter at checked IR. Positions identify this fixture, not a
// purported frontend translation of an author module.
const source: SourceSpan = {
  file: 'packages/compiler/test/fixtures/backend-programs.ts',
  start: 0,
  end: 0,
};
const bind = (id: string, type: ValueType, name = id): Binding => ({ id, name, type, source });
const text = (value: string): Value => ({ kind: 'text', value });
const number = (bits: string): Value => ({ kind: 'number', bits });
const ref = (kind: 'prop' | 'state' | 'capture' | 'local', id: string): Value => ({ kind, id });
const call = (fn: string, ...args: Value[]): Value => ({ kind: 'call', fn, args });
const binary = (op: 'add' | 'multiply' | 'concat' | 'equal', left: Value, right: Value): Value => ({
  kind: 'binary',
  op,
  left,
  right,
});
const ret = (value?: Value): Terminator =>
  value === undefined ? { kind: 'return', source } : { kind: 'return', source, value };
const block = (
  id: string,
  end: Terminator,
  instructions: Instruction[] = [],
  params: Binding[] = []
): Block => ({ id, end, instructions, params });
const branch = (condition: Value, yes: string, no: string): Terminator => ({
  kind: 'branch',
  condition,
  yes: { block: yes, args: [] },
  no: { block: no, args: [] },
  source,
});
const behavior = (
  id: string,
  type: ValueType,
  phase: Behavior['phase'],
  dependencies: string[],
  blocks: Block[],
  params: Binding[] = []
): Behavior => ({
  binding: bind(id, type),
  phase,
  dependencies,
  blocks,
  params,
  entry: blocks[0].id,
});
const read = (
  id: string,
  type: ValueType,
  deps: string[],
  value: Value,
  phase: Behavior['phase'] = 'pure'
): Behavior => behavior(id, type, phase, deps, [block('entry', ret(value))]);

function textView(tag: ElementView['tag'], value: string): ElementView {
  return { kind: 'element', tag, source, children: [{ kind: 'text', value, source }] };
}

/** Residual branch on current props, plus a pure helper with a parameter. */
export function readonlyBadge(): ComponentIR {
  return {
    version: 5,
    id: 'delivery-badge',
    externs: [],
    created: [],
    tasks: [],
    keys: [],
    consumes: [],
    provides: [],
    components: [],
    types: [],
    name: 'DeliveryBadge',
    source,
    props: [bind('connected', 'bool'), bind('caption', 'text')],
    fields: [],
    signals: [],
    actions: [],
    projections: [{ name: 'available', fn: 'availableValue' }],
    behaviors: [
      read('availableValue', 'bool', ['connected'], ref('prop', 'connected')),
      behavior(
        'suffix',
        'text',
        'pure',
        [],
        [block('entry', ret(binary('concat', ref('local', 'labelArg'), text(' ✓'))))],
        [bind('labelArg', 'text')]
      ),
      behavior(
        'badgeLabel',
        'text',
        'pure',
        ['connected', 'caption'],
        [
          block('entry', branch(call('availableValue'), 'online', 'offline')),
          block('online', {
            kind: 'jump',
            to: { block: 'done', args: [call('suffix', ref('prop', 'caption'))] },
            source,
          }),
          block('offline', {
            kind: 'jump',
            to: { block: 'done', args: [text('Offline')] },
            source,
          }),
          block('done', ret(ref('local', 'resultArg')), [], [bind('resultArg', 'text')]),
        ]
      ),
    ],
    view: textView('span', 'badgeLabel'),
  };
}

/** A source-independent lowering fixture for the compiler's A/B/C controlled
 * selection trace. Its text domain is distinct from Base Toggle's bool active. */
export function controlledSelection(): ComponentIR {
  const mode = 'controlled';
  const owner = 'accepted';
  const local = 'chosen';
  const attempts = 'editCount';
  const prefix = 'capturedPrefix';
  const actualDeps = [mode, owner, local];
  const actionDeps = [mode, owner, local, 'candidate', 'disabled', attempts];
  const effect = (kind: 'write' | 'emit', target: string, value: Value): Instruction => ({
    kind,
    target,
    value,
    source,
  });
  return {
    version: 5,
    id: 'selection-control',
    externs: [],
    created: [],
    tasks: [],
    keys: [],
    consumes: [],
    provides: [],
    components: [],
    types: [],
    name: 'SelectionControl',
    source,
    props: [
      bind(mode, 'bool'),
      bind(owner, 'text'),
      bind('candidate', 'text'),
      bind('initial', 'text'),
      bind('disabled', 'bool'),
      bind('prefix', 'text'),
    ],
    fields: [
      { kind: 'state', binding: bind(local, 'text'), init: 'initialChoice' },
      { kind: 'state', binding: bind(attempts, 'number'), init: 'zero' },
      { kind: 'capture', binding: bind(prefix, 'text'), init: 'initialPrefix' },
    ],
    signals: [bind('requested', 'text')],
    projections: [
      { name: 'selection', fn: 'actual' },
      { name: 'attempts', fn: 'count' },
    ],
    actions: [
      { name: 'choose', fn: 'activate' },
      { name: 'discard', fn: 'rejectSegment' },
    ],
    behaviors: [
      read('initialChoice', 'text', ['initial'], ref('prop', 'initial'), 'init'),
      read('zero', 'number', [], number('0000000000000000'), 'init'),
      read('initialPrefix', 'text', ['prefix'], ref('prop', 'prefix'), 'init'),
      read('locked', 'bool', ['disabled'], ref('prop', 'disabled')),
      read('count', 'number', [attempts], ref('state', attempts)),
      behavior('actual', 'text', 'pure', actualDeps, [
        block('entry', branch(ref('prop', mode), 'external', 'internal')),
        block('external', ret(ref('prop', owner))),
        block('internal', ret(ref('state', local))),
      ]),
      behavior(
        'decorate',
        'text',
        'pure',
        [prefix],
        [
          block(
            'entry',
            ret(binary('concat', ref('capture', prefix), ref('local', 'selectionArg')))
          ),
        ],
        [bind('selectionArg', 'text')]
      ),
      read('label', 'text', [prefix, ...actualDeps], call('decorate', call('actual'))),
      behavior(
        'update',
        'unit',
        'action',
        [mode, attempts],
        [
          block('entry', branch(ref('prop', mode), 'notify', 'assign'), [
            effect('write', attempts, binary('add', call('count'), number('3ff0000000000000'))),
          ]),
          block('assign', { kind: 'jump', to: { block: 'notify', args: [] }, source }, [
            effect('write', local, ref('local', 'nextArg')),
          ]),
          block('notify', ret(), [effect('emit', 'requested', ref('local', 'nextArg'))]),
        ],
        [bind('nextArg', 'text')]
      ),
      behavior('activate', 'unit', 'action', actionDeps, [
        block('entry', branch(call('locked'), 'skip', 'apply')),
        block('skip', ret()),
        block('apply', ret(), [
          { kind: 'invoke', fn: 'update', args: [ref('prop', 'candidate')], source },
        ]),
      ]),
      behavior(
        'rejectSegment',
        'unit',
        'action',
        [attempts],
        [
          block('entry', { kind: 'fail', reason: 'selection-refused', source }, [
            effect('write', local, text('unpublished')),
            effect('write', attempts, number('4022000000000000')),
            effect('emit', 'requested', text('unpublished')),
          ]),
        ]
      ),
    ],
    view: { ...textView('button', 'label'), disabled: 'locked', activate: 'activate' },
  };
}

/** Exercises failures during a read and in actions that request a task start or cancellation. */
export function resumedFailure(): ComponentIR {
  const expected: Value = { kind: 'context', id: 'expected' };
  const write = (target: string, value: Value): Instruction => ({ kind: 'write', target, value, source });
  return {
    version: 5,
    id: 'failure-reader',
    name: 'FailureReader',
    source,
    components: [],
    types: [],
    props: [],
    provides: [],
    signals: [],
    created: [],
    keys: [{ binding: bind('documentKey', 'text'), debugName: 'expected document', exportName: 'EXPECTED_DOCUMENT' }],
    consumes: [{ key: 'documentKey', binding: bind('expected', 'text') }],
    externs: [{
      binding: bind('readDocument', 'text'),
      name: 'fixture.load-keyed-item',
      params: [bind('fileId', 'text')],
      effect: 'after-state-commit',
      lifetime: 'task',
      async: true,
      targets: ['react', 'gpui'],
    }],
    fields: [
      { kind: 'state', binding: bind('stage', 'text'), init: 'idle' },
      { kind: 'state', binding: bind('accepted', 'number'), init: 'zero' },
    ],
    projections: [
      { name: 'stage', fn: 'label' },
      { name: 'accepted', fn: 'count' },
      { name: 'expected', fn: 'currentDocument' },
    ],
    actions: [
      { name: 'begin', fn: 'begin' },
      { name: 'cancelAndFail', fn: 'cancelAndFail' },
      { name: 'startAndFail', fn: 'startAndFail' },
    ],
    tasks: [{ fn: 'readItem', policy: 'serial', source }],
    behaviors: [
      read('idle', 'text', [], text('idle'), 'init'),
      read('zero', 'number', [], number('0000000000000000'), 'init'),
      read('label', 'text', ['stage'], ref('state', 'stage')),
      read('count', 'number', ['accepted'], ref('state', 'accepted')),
      read('currentDocument', 'text', ['expected'], expected),
      behavior('begin', 'unit', 'action', [], [
        block('entry', ret(), [{ kind: 'start', task: 'readItem', args: [ref('local', 'document')], source }]),
      ], [bind('document', 'text')]),
      behavior('cancelAndFail', 'unit', 'action', [], [
        block('entry', { kind: 'fail', reason: 'cancel-refused', source }, [
          { kind: 'cancel', task: 'readItem', source },
        ]),
      ]),
      behavior('startAndFail', 'unit', 'action', [], [
        block('entry', { kind: 'fail', reason: 'start-refused', source }, [
          { kind: 'start', task: 'readItem', args: [ref('local', 'requestedId')], source },
        ]),
      ], [bind('requestedId', 'text')]),
      behavior('readItem', 'unit', 'task', ['expected', 'stage', 'accepted'], [
        block('entry', {
          kind: 'await', extern: 'readDocument', args: [ref('local', 'id')], resume: { block: 'resume', args: [] }, source,
        }, [write('stage', binary('concat', text('checking@'), expected))]),
        block('resume', branch(binary('equal', call('label'), expected), 'accept', 'reject'), [
          write('stage', ref('local', 'body')),
          write('accepted', binary('add', call('count'), number('3ff0000000000000'))),
        ], [bind('body', 'text')]),
        block('accept', ret()),
        block('reject', { kind: 'fail', reason: 'document-changed', source }),
      ], [bind('id', 'text')]),
    ],
    view: textView('span', 'label'),
  };
}
