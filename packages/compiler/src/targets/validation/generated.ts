import type {
  Behavior,
  Block,
  ComponentBody,
  ComponentIR,
  Edge,
  ElementView,
  SourceSpan,
  Value,
  ViewNode,
} from '../component-ir.ts';

/**
 * Stage 1 structural verification for generated compositions.
 *
 * The checks read the admitted IR only. They never rewrite the program. Every
 * conditional edge is treated as reachable and every invoked helper, started
 * task or extern call counts as a possible consequence, so the graph
 * over-approximates runtime influence: a control reported as dead cannot affect
 * any view region, public projection, Context provider, task, extern or public
 * event on any execution.
 */
export type GeneratedFindingKind =
  | 'dead-control'
  | 'unobserved-branch'
  | 'dead-store'
  | 'snapshot-read';

export interface GeneratedFinding {
  readonly kind: GeneratedFindingKind;
  readonly ruleId: `generated/${GeneratedFindingKind}`;
  readonly severity: 'error' | 'warning' | 'info';
  /** Component body that owns the finding. */
  readonly component: string;
  readonly source: SourceSpan;
  readonly message: string;
  /** Ordered steps of the counterexample or of the unobserved data path. */
  readonly witness: readonly string[];
}

export interface GeneratedVerification {
  readonly findings: readonly GeneratedFinding[];
  /** True when a control has no consequence on any path. */
  readonly rejected: boolean;
}

export class GeneratedVerificationError extends Error {
  readonly findings: readonly GeneratedFinding[];

  constructor(findings: readonly GeneratedFinding[]) {
    const first = findings.find((item) => item.severity === 'error') ?? findings[0];
    super(
      first ? `${first.ruleId}: ${first.message}` : 'Generated verification rejected the component.'
    );
    this.name = 'GeneratedVerificationError';
    this.findings = findings;
  }
}

interface ViewFacts {
  readonly regions: string[];
  readonly activations: ElementView[];
}

function collectView(node: ViewNode, facts: ViewFacts): void {
  if (node.kind === 'text') {
    facts.regions.push(node.value);
  } else if (node.kind === 'child') {
    facts.regions.push(node.key, ...node.props.map((prop) => prop.fn));
  } else {
    if (node.style) facts.regions.push(node.style);
    if (node.disabled) facts.regions.push(node.disabled);
    if (node.activate) facts.activations.push(node);
    for (const child of node.children) collectView(child, facts);
  }
}

function successors(block: Block): { label: string; edge: Edge; guard?: Value }[] {
  const end = block.end;
  switch (end.kind) {
    case 'jump':
      return [{ label: 'jump', edge: end.to }];
    case 'branch':
      return [
        { label: 'branch[true]', edge: end.yes, guard: end.condition },
        { label: 'branch[false]', edge: end.no, guard: end.condition },
      ];
    case 'presence':
      return [
        { label: 'presence[present]', edge: end.present, guard: end.value },
        { label: 'presence[omitted]', edge: end.omitted, guard: end.value },
      ];
    case 'match':
      return end.cases.map((arm) => ({
        label: `match[${arm.tag}]`,
        edge: arm.to,
        guard: end.value,
      }));
    default:
      return [];
  }
}

class BodyVerifier {
  readonly #body: ComponentBody;
  readonly #fns: ReadonlyMap<string, Behavior>;
  readonly #view: ViewFacts = { regions: [], activations: [] };
  /** Read by a view region, public projection or Context provider: visible to the user or host. */
  readonly #visible = new Set<string>();
  /** Visible values plus values read by effective actions and tasks. */
  readonly #observed = new Set<string>();
  readonly #effective = new Set<string>();
  readonly #mayAct = new Map<string, boolean>();

  constructor(body: ComponentBody) {
    this.#body = body;
    this.#fns = new Map(body.behaviors.map((fn) => [fn.binding.id, fn]));
    collectView(body.view, this.#view);
    this.#settle();
  }

  #name(id: string): string {
    return this.#fns.get(id)?.binding.name ?? id;
  }

  #deps(id: string): readonly string[] {
    return this.#fns.get(id)?.dependencies ?? [];
  }

  /** Sinks are view regions, public projections and Context providers; effective behaviors extend them. */
  #settle(): void {
    const sinks = [
      ...this.#view.regions,
      ...this.#body.projections.map((item) => item.fn),
      ...this.#body.provides.map((item) => item.fn),
    ];
    for (const fn of sinks) for (const id of this.#deps(fn)) this.#visible.add(id);
    for (const id of this.#visible) this.#observed.add(id);
    // Values are observed when they flow into an observable effect: a write to an
    // observed state, an emitted payload, extern or task arguments, or a condition
    // of an effective behavior. Iterate to a fixpoint over the finite IR.
    let changed = true;
    const observe = (value: Value, fn: Behavior) => {
      const sources = new Set<string>();
      this.#valueSources(value, fn, sources, new Set());
      for (const id of sources) {
        if (!this.#observed.has(id)) {
          this.#observed.add(id);
          changed = true;
        }
      }
    };
    while (changed) {
      changed = false;
      for (const fn of this.#body.behaviors) {
        if (fn.phase !== 'action' && fn.phase !== 'task') continue;
        let acts = false;
        for (const block of fn.blocks) {
          for (const instruction of block.instructions) {
            switch (instruction.kind) {
              case 'write':
                if (this.#observed.has(instruction.target)) {
                  acts = true;
                  observe(instruction.value, fn);
                }
                break;
              case 'emit':
                acts = true;
                observe(instruction.value, fn);
                break;
              case 'start':
              case 'invoke': {
                const target = instruction.kind === 'start' ? instruction.task : instruction.fn;
                if (this.#effective.has(target)) {
                  acts = true;
                  for (const arg of instruction.args) observe(arg, fn);
                }
                break;
              }
              case 'cancel':
                if (this.#effective.has(instruction.task)) acts = true;
                break;
              default:
                break;
            }
          }
          if (block.end.kind === 'await') {
            acts = true;
            for (const arg of block.end.args) observe(arg, fn);
          } else if (block.end.kind === 'fail') {
            acts = true;
          }
        }
        if (!acts) continue;
        for (const block of fn.blocks) {
          for (const next of successors(block)) if (next.guard) observe(next.guard, fn);
        }
        if (!this.#effective.has(fn.binding.id)) {
          this.#effective.add(fn.binding.id);
          changed = true;
        }
      }
    }
  }

  /** A block acts when it performs any effect that can reach an observer. */
  #blockActs(block: Block): boolean {
    const end = block.end.kind;
    if (end === 'await' || end === 'fail') return true;
    return block.instructions.some((instruction) => {
      switch (instruction.kind) {
        case 'emit':
          return true;
        case 'write':
          return this.#observed.has(instruction.target);
        case 'start':
        case 'cancel':
          return this.#effective.has(instruction.task);
        case 'invoke':
          return this.#effective.has(instruction.fn);
        default:
          return false;
      }
    });
  }

  /** Whether some path of an action helper acts; used for invoke instructions on control paths. */
  #helperMayAct(id: string): boolean {
    const known = this.#mayAct.get(id);
    if (known !== undefined) return known;
    const fn = this.#fns.get(id);
    const result = fn ? fn.blocks.some((block) => this.#blockActs(block)) : true;
    this.#mayAct.set(id, result);
    return result;
  }

  #actsOnPath(block: Block): boolean {
    if (this.#blockActs(block)) return true;
    return block.instructions.some(
      (instruction) => instruction.kind === 'invoke' && this.#helperMayAct(instruction.fn)
    );
  }

  #guardObservable(guard: Value | undefined, fn: Behavior): boolean {
    if (!guard) return false;
    const sources = new Set<string>();
    this.#valueSources(guard, fn, sources, new Set());
    return sources.size > 0 && [...sources].every((id) => this.#visible.has(id));
  }

  #valueSources(value: Value, fn: Behavior, into: Set<string>, seen: Set<string>): void {
    switch (value.kind) {
      case 'prop':
      case 'state':
      case 'capture':
      case 'context':
        into.add(value.id);
        return;
      case 'local': {
        if (seen.has(value.id)) return;
        seen.add(value.id);
        for (const block of fn.blocks) {
          for (const instruction of block.instructions) {
            if (instruction.kind === 'let' && instruction.binding.id === value.id) {
              this.#valueSources(instruction.value, fn, into, seen);
            }
          }
          block.params.forEach((param, index) => {
            if (param.id !== value.id) return;
            for (const source of fn.blocks) {
              for (const next of successors(source)) {
                if (next.edge.block === block.id && next.edge.args[index]) {
                  this.#valueSources(next.edge.args[index]!, fn, into, seen);
                }
              }
              if (source.end.kind === 'await' && source.end.resume.block === block.id)
                into.add(`await:${source.end.extern}`);
            }
          });
        }
        return;
      }
      case 'call':
        for (const id of this.#deps(value.fn)) into.add(id);
        for (const arg of value.args) this.#valueSources(arg, fn, into, seen);
        return;
      case 'widen-text':
      case 'tag':
      case 'has-value':
      case 'not':
        this.#valueSources(value.value, fn, into, seen);
        return;
      case 'member':
        this.#valueSources(value.value, fn, into, seen);
        return;
      case 'tagged':
        this.#valueSources(value.payload, fn, into, seen);
        return;
      case 'record':
        for (const field of value.fields) this.#valueSources(field.value, fn, into, seen);
        return;
      case 'binary':
        this.#valueSources(value.left, fn, into, seen);
        this.#valueSources(value.right, fn, into, seen);
        return;
      default:
        return;
    }
  }

  /** Path facts over the acyclic CFG of one action. */
  #control(fn: Behavior): { some: boolean; witness: string[] | undefined } {
    const blocks = new Map(fn.blocks.map((block) => [block.id, block]));
    const some = new Map<string, boolean>();
    const free = new Map<string, string[] | null>();
    const mayAct = (id: string): boolean => {
      const cached = some.get(id);
      if (cached !== undefined) return cached;
      const block = blocks.get(id)!;
      const result =
        this.#actsOnPath(block) || successors(block).some((next) => mayAct(next.edge.block));
      some.set(id, result);
      return result;
    };
    const step = (block: Block, label: string, to: string) =>
      `${this.#name(fn.binding.id)}:${block.id} ${label} -> ${to}`;
    const toEnd = (id: string): string[] => {
      const block = blocks.get(id)!;
      const next = successors(block)[0];
      return next
        ? [step(block, next.label, next.edge.block), ...toEnd(next.edge.block)]
        : [`${this.#name(fn.binding.id)}:${block.id} ${block.end.kind} without consequence`];
    };
    // The decision that makes a path consequence-free is the edge into a region where
    // no path can act. A visible condition at that decision explains the no-op.
    const unexplained = (id: string): string[] | null => {
      if (free.has(id)) return free.get(id)!;
      const block = blocks.get(id)!;
      let result: string[] | null = null;
      if (!this.#actsOnPath(block)) {
        const nexts = successors(block);
        if (nexts.length === 0) result = toEnd(id);
        for (const next of nexts) {
          if (result) break;
          if (mayAct(next.edge.block)) {
            const rest = unexplained(next.edge.block);
            if (rest) result = [step(block, next.label, next.edge.block), ...rest];
          } else if (!this.#guardObservable(next.guard, fn)) {
            result = [step(block, next.label, next.edge.block), ...toEnd(next.edge.block)];
          }
        }
      }
      free.set(id, result);
      return result;
    };
    return { some: mayAct(fn.entry), witness: unexplained(fn.entry) ?? undefined };
  }

  findings(): GeneratedFinding[] {
    const body = this.#body;
    const found: GeneratedFinding[] = [];
    for (const element of this.#view.activations) {
      const fn = this.#fns.get(element.activate!);
      if (!fn) continue;
      const { some, witness } = this.#control(fn);
      const head = `${element.tag} activates ${JSON.stringify(fn.binding.name)}`;
      if (!some) {
        found.push({
          kind: 'dead-control',
          ruleId: 'generated/dead-control',
          severity: 'error',
          component: body.id,
          source: element.source,
          message: `The ${element.tag} activates ${JSON.stringify(fn.binding.name)}, which has no observable consequence on any path: no displayed or published state change, task, extern call, failure or public event.`,
          witness: [head, ...(witness ?? [])],
        });
      } else if (witness) {
        found.push({
          kind: 'unobserved-branch',
          ruleId: 'generated/unobserved-branch',
          severity: 'warning',
          component: body.id,
          source: element.source,
          message: `A path of ${JSON.stringify(fn.binding.name)} ends without an observable consequence, and no observable condition explains it.`,
          witness: [head, ...witness],
        });
      }
    }
    const written = new Map<string, string[]>();
    for (const fn of body.behaviors) {
      for (const block of fn.blocks) {
        for (const instruction of block.instructions) {
          if (instruction.kind !== 'write') continue;
          const writers = written.get(instruction.target) ?? [];
          if (!writers.includes(fn.binding.id)) writers.push(fn.binding.id);
          written.set(instruction.target, writers);
        }
      }
    }
    for (const field of body.fields) {
      if (field.kind !== 'state') continue;
      const writers = written.get(field.binding.id);
      if (!writers || this.#observed.has(field.binding.id)) continue;
      found.push({
        kind: 'dead-store',
        ruleId: 'generated/dead-store',
        severity: 'warning',
        component: body.id,
        source: field.binding.source,
        message: `State ${JSON.stringify(field.binding.name)} is written but no view region, projection, Context provider or effective action/task reads it.`,
        witness: writers.map((id) => `${this.#name(id)} writes ${field.binding.name}`),
      });
    }
    const viewReads = new Set(this.#view.regions.flatMap((fn) => this.#deps(fn)));
    const mutable = (id: string): boolean =>
      body.props.some((prop) => prop.id === id) ||
      body.consumes.some((read) => read.binding.id === id) ||
      written.has(id);
    for (const field of body.fields) {
      if (!viewReads.has(field.binding.id)) continue;
      if (field.kind === 'state' && written.has(field.binding.id)) continue;
      const sources = this.#deps(field.init).filter(mutable);
      if (!sources.length) continue;
      found.push({
        kind: 'snapshot-read',
        ruleId: 'generated/snapshot-read',
        severity: 'info',
        component: body.id,
        source: field.binding.source,
        message: `The view reads ${JSON.stringify(field.binding.name)}, which is fixed at creation from changing input; it will not follow later changes. Use a derivation to follow them.`,
        witness: sources.map((id) => `${field.binding.name} initialized from ${id}`),
      });
    }
    return found;
  }
}

/** Read-only verification of an admitted unit; it never changes the IR. */
export function verifyGenerated(ir: ComponentIR): GeneratedVerification {
  const findings = [ir, ...ir.components].flatMap((body) => new BodyVerifier(body).findings());
  return { findings, rejected: findings.some((item) => item.severity === 'error') };
}
