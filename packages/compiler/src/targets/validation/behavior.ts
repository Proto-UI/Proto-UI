import type {
  Behavior,
  Binding,
  Block,
  DataType,
  Edge,
  Instruction,
  SourceSpan,
  Terminator,
  ValueType,
} from '../component-ir.ts';
import { ComponentIRDiagnostic, reject, requireType } from './diagnostic.ts';
import { findCycle, type References } from './graph.ts';
import {
  checkBinding,
  id,
  list,
  location,
  member,
  resolve,
  shape,
  text,
  unique,
  variant,
} from './structure.ts';
import { expressions, type Declarations, type Uses } from './value.ts';

export interface BehaviorFacts extends Uses {
  readonly missing: ComponentIRDiagnostic | undefined;
}

const instructionFields = {
  let: ['kind', 'source', 'binding', 'value'],
  write: ['kind', 'source', 'target', 'value'],
  emit: ['kind', 'source', 'target', 'value'],
  invoke: ['kind', 'source', 'fn', 'args'],
} satisfies Record<Instruction['kind'], readonly string[]>;

const terminatorFields = {
  return: ['kind', 'source'],
  fail: ['kind', 'source', 'reason'],
  jump: ['kind', 'source', 'to'],
  branch: ['kind', 'source', 'condition', 'yes', 'no'],
  presence: ['kind', 'source', 'value', 'present', 'omitted'],
} satisfies Record<Terminator['kind'], readonly string[]>;

export function checkSignature(fn: Behavior, parent: SourceSpan, types: readonly DataType[]): void {
  const binding = member(fn, 'binding') as Binding;
  checkBinding(binding, parent, types);
  const source = binding.source;
  shape(fn, 'behavior', source, ['binding', 'phase', 'params', 'dependencies', 'entry', 'blocks']);
  if (fn.phase !== 'action' && fn.phase !== 'init' && fn.phase !== 'pure') {
    reject('ir-shape', source, 'Behavior phase must be init, pure or action.', [binding.id]);
  }
  list(fn.params, 'behavior parameters', source);
  for (const param of fn.params) {
    checkBinding(param, source, types);
  }
  list(fn.dependencies, 'behavior dependencies', source);
  list(fn.blocks, 'behavior blocks', source);
  id(fn.entry, 'behavior entry block', source);
}

function checkBlock(
  fn: Behavior,
  block: Block,
  blocks: ReadonlyMap<string, Block>,
  declarations: Declarations,
  params: ReadonlyMap<string, Binding>,
  uses: Uses,
  successors: References
): void {
  const owner = fn.binding.id;
  const blockBindings = [owner, block.id];
  const locals = new Map<string, Binding>();
  for (const param of block.params) locals.set(param.id, param);
  const values = expressions(fn, declarations, params, locals, uses);

  for (const instruction of block.instructions) {
    const at = location(instruction, 'instruction', fn.binding.source);
    variant(instruction, 'instruction', at, instructionFields, blockBindings);
    switch (instruction.kind) {
      case 'let': {
        const binding = instruction.binding;
        checkBinding(binding, at, declarations.types);
        if (locals.has(binding.id) || params.has(binding.id)) {
          reject(
            'duplicate-binding',
            binding.source,
            `Local ${JSON.stringify(binding.id)} is already bound in this block. Assign a fresh ID.`,
            [owner, block.id, binding.id]
          );
        }
        requireType(
          values.typeOf(instruction.value, at),
          binding.type,
          `Initializer of local ${JSON.stringify(binding.id)}`,
          at,
          [owner, binding.id]
        );
        locals.set(binding.id, binding);
        break;
      }
      case 'write':
      case 'emit': {
        let target: Binding;
        if (instruction.kind === 'write') {
          const slot = resolve(declarations.values, instruction.target, 'Write target', at, owner);
          if (slot.kind !== 'state') {
            reject(
              'illegal-effect',
              at,
              `Cannot write immutable ${slot.kind} ${JSON.stringify(instruction.target)}. Write an owned state field.`,
              [owner, instruction.target]
            );
          }
          target = slot.binding;
        } else {
          target = resolve(declarations.signals, instruction.target, 'Signal', at, owner);
        }
        requireType(
          values.typeOf(instruction.value, at),
          target.type,
          `${instruction.kind} to ${JSON.stringify(target.id)}`,
          at,
          [owner, target.id]
        );
        if (fn.phase !== 'action') {
          reject(
            'illegal-effect',
            at,
            `${fn.phase} behavior ${JSON.stringify(owner)} cannot ${instruction.kind} ${JSON.stringify(target.id)}. Move this ordered effect to an action.`,
            [owner, target.id]
          );
        }
        break;
      }
      case 'invoke': {
        const target = values.callee(instruction.fn, at);
        values.argumentsOf(instruction.args, target.params, 'Invocation of', instruction.fn, at);
        if (target.phase !== 'action') {
          reject(
            'invalid-phase',
            at,
            `An invoke instruction requires an action helper. Use a value call for ${JSON.stringify(instruction.fn)}.`,
            [owner, instruction.fn]
          );
        }
        if (fn.phase !== 'action') {
          reject(
            'illegal-effect',
            at,
            `${fn.phase} behavior ${JSON.stringify(owner)} cannot invoke action ${JSON.stringify(instruction.fn)}. Move the call to an action segment.`,
            [owner, instruction.fn]
          );
        }
        break;
      }
    }
  }

  const end = block.end;
  const at = end.source;
  variant(
    end,
    'terminator',
    at,
    terminatorFields,
    blockBindings,
    member(end, 'kind') === 'return' ? ['value'] : []
  );
  function edge(to: Edge, payload?: ValueType): void {
    shape(to, 'block edge', at, ['block', 'args'], [], blockBindings);
    const destination = resolve(blocks, to.block, 'Successor block', at, owner);
    values.argumentsOf(to.args, destination.params, 'Edge to', to.block, at, payload);
    successors.set(to.block, at);
  }
  switch (end.kind) {
    case 'return': {
      const type = end.value === undefined ? 'unit' : values.typeOf(end.value, at);
      requireType(type, fn.binding.type, `Return from ${JSON.stringify(owner)}`, at, [
        owner,
        block.id,
      ]);
      break;
    }
    case 'fail':
      text(end.reason, 'failure reason', at, blockBindings);
      break;
    case 'jump':
      edge(end.to);
      break;
    case 'branch':
      requireType(values.typeOf(end.condition, at), 'bool', 'Branch condition', at, [
        owner,
        block.id,
      ]);
      edge(end.yes);
      edge(end.no);
      break;
    case 'presence': {
      const payload = values.presencePayload(end.value, at);
      edge(end.present, payload);
      edge(end.omitted);
      break;
    }
  }
}

export function checkBehavior(fn: Behavior, declarations: Declarations): BehaviorFacts {
  const source = fn.binding.source;
  const owner = fn.binding.id;
  const params = new Map<string, Binding>();
  for (const param of fn.params) {
    if (params.has(param.id)) {
      reject(
        'duplicate-binding',
        param.source,
        'Two behavior parameters have the same ID. Give each parameter a distinct binding.',
        [owner, param.id]
      );
    }
    params.set(param.id, param);
  }
  const blocks = new Map<string, Block>();
  for (const block of fn.blocks) {
    shape(block, 'block', source, ['id', 'params', 'instructions', 'end']);
    const at = location(block.end, 'block terminator', source);
    id(block.id, 'block ID', at);
    if (blocks.has(block.id))
      reject(
        'duplicate-binding',
        at,
        `Block ${JSON.stringify(block.id)} is declared twice. Use a distinct block ID.`,
        [owner, block.id]
      );
    blocks.set(block.id, block);
    list(block.instructions, 'block instructions', at);
    list(block.params, 'block parameters', at);
    const seen = new Set<string>();
    for (const param of block.params) {
      checkBinding(param, at, declarations.types);
      if (params.has(param.id))
        reject(
          'duplicate-binding',
          param.source,
          'A block parameter repeats a behavior parameter ID. Give the new binding its own ID.',
          [owner, block.id, param.id]
        );
      unique(seen, param.id, 'Block parameter', param.source);
    }
  }
  const entry = resolve(blocks, fn.entry, 'Entry block', source, owner);
  if (entry.params.length) {
    reject(
      'wrong-arity',
      entry.params[0]!.source,
      'The entry block has no incoming arguments. Declare behavior parameters on the behavior.',
      [owner, entry.id]
    );
  }
  const uses: Uses = { reads: new Map(), calls: new Map() };
  const graph = new Map<string, References>();
  let missing: ComponentIRDiagnostic | undefined;
  // Check both arms of every branch. Dead blocks must still be well-formed, but
  // cannot cause a field read, a call, or a target requirement from this entry.
  const reachable = new Set([entry.id]);
  for (const key of reachable) {
    const block = blocks.get(key)!;
    const successors: References = new Map();
    checkBlock(fn, block, blocks, declarations, params, uses, successors);
    graph.set(key, successors);
    for (const next of successors.keys()) reachable.add(next);
    if (block.end.kind === 'fail' && fn.phase !== 'action' && !missing) {
      missing = new ComponentIRDiagnostic(
        'failing-value',
        block.end.source,
        `Lowering a propagated failure from a ${fn.phase} value requires a typed failing result on this target path.`,
        [owner, key]
      );
    }
  }
  for (const block of fn.blocks) {
    if (!reachable.has(block.id))
      checkBlock(
        fn,
        block,
        blocks,
        declarations,
        params,
        { reads: new Map(), calls: new Map() },
        new Map()
      );
  }
  const cycle = findCycle(graph);
  if (cycle && !missing) {
    missing = new ComponentIRDiagnostic(
      'cyclic-cfg',
      cycle.source,
      `Lowering the block cycle ${cycle.path.map((key) => JSON.stringify(key)).join(' -> ')} requires loop support in the native-source targets.`,
      [owner, ...cycle.path]
    );
  }
  return { ...uses, missing };
}
