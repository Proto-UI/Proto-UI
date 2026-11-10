import type {
  ContrastAuditSubject,
  readContrastAuditSubject,
} from './contrast-probe.browser';

interface TooltipPaintObservation {
  achieved: boolean;
  hovered: boolean;
  prototype: string | null;
  visibility: { visible: boolean; classification: string; limits: string[] };
}
interface Probe {
  readContrastAuditSubject: typeof readContrastAuditSubject;
  readContrastTargetObservation(element: Element): TooltipPaintObservation;
}
export interface TooltipHandoffPlan {
  recipeId: string;
  groupPath: string;
  pairs: { rootPath: string; triggerPath: string; contentPath: string; triggerText: string; contentText: string }[];
  openDelay: number;
  closeDelay: number;
  skipDelay: number;
  coldGuardMs: number;
  coldDeadlineMs: number;
  warmDeadlineMs: number;
}
export type TooltipHandoffPhase = 'cold' | 'warm';
interface ContentBinding {
  node: HTMLElement;
  id: string;
}
interface PairBinding {
  root: HTMLElement;
  trigger: HTMLElement;
  originalDescriptions: string[];
  content: ContentBinding | null;
}
interface PointerObservation {
  phase: TooltipHandoffPhase;
  status: 'armed' | 'observing' | 'achieved' | 'failed';
  nativePointerEnter: boolean;
  enteredAt: number | null;
  firstPaintMs: number | null;
  coldGuardObserved: boolean;
  samples: { elapsedMs: number; firstPainted: boolean; secondPainted: boolean; firstDescriptions: string[]; secondDescriptions: string[] }[];
  error: string | null;
  frame: number;
  inputDeadline: number;
  listener: (event: PointerEvent) => void;
}
export interface TooltipHandoffBinding {
  subject: ContrastAuditSubject;
  probe: Probe;
  plan: TooltipHandoffPlan;
  scope: HTMLElement;
  retained: HTMLElement;
  owner: string;
  generation: string;
  group: HTMLElement;
  pairs: PairBinding[];
  pointer: PointerObservation | null;
  lifetimeObserver: MutationObserver | null;
  lifetimeError: string | null;
  lifetimeNodes: { node: HTMLElement; attributes: Map<string, string | null> }[];
}

const selector = (part: string) =>
  `[data-pui-root][data-projection-prototype="brutalist-tooltip-${part}"]`;
const tokens = (element: Element) =>
  (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
function fail(reason: string): never {
  throw new Error(`Tooltip handoff: ${reason}.`);
}
const normalize = (value: string | null) => (value ?? '').replace(/\s+/g, ' ').trim();
const assertLease = (binding: TooltipHandoffBinding, element: HTMLElement) => {
  if (
    !element.isConnected ||
    element.dataset.projectionOwner !== binding.owner ||
    element.dataset.projectionGeneration !== binding.generation
  )
    fail('foreign, ended or replaced projection lease');
};

function noteTooltipLifetimeMutations(binding: TooltipHandoffBinding, records: MutationRecord[]): void {
  for (const record of records) {
    if (binding.lifetimeError !== null) return;
    if (record.type === 'childList' && [...record.removedNodes].some((removed) =>
      binding.lifetimeNodes.some(({ node }) => removed === node || removed.contains(node))
    )) {
      binding.lifetimeError = 'original Group/Root/Trigger view retired';
    } else if (record.type === 'attributes' && record.attributeName) {
      const original = binding.lifetimeNodes.find(({ node }) => node === record.target);
      if (!original) continue;
      const expected = original.attributes.get(record.attributeName);
      if (record.oldValue !== expected || original.node.getAttribute(record.attributeName) !== expected)
        binding.lifetimeError = `original physical lease changed ${record.attributeName}`;
    }
  }
}

// The Group is an adjacent semantic protocol, not a Tooltip Anatomy part.
// Pin its published physical boundary separately from both Root/Trigger pairs.
export function bindTooltipWarmHandoff(
  subject: ContrastAuditSubject,
  plan: TooltipHandoffPlan,
  probe: Probe
): TooltipHandoffBinding {
  const boundary = probe.readContrastAuditSubject(subject);
  if (
    !boundary.observation.achieved || !boundary.scope || !boundary.retained ||
    !boundary.owner || !boundary.generation || plan.pairs.length !== 2 ||
    subject.expected.recipeId !== plan.recipeId || subject.expected.family !== 'tooltip'
  )
    fail('selected authored Tooltip subject is not current');
  const groups = [...boundary.retained.querySelectorAll<HTMLElement>(selector('group'))];
  if (groups.length !== 1) fail('missing or ambiguous shared Group');
  const group = groups[0];
  const roots = [...group.querySelectorAll<HTMLElement>(selector('root'))];
  if (roots.length !== 2) fail('missing or ambiguous authored sibling Roots');
  const pairs = roots.map((root, index) => {
    if (root.closest(selector('group')) !== group) fail('Root escaped its authored Group');
    const triggers = [...root.querySelectorAll<HTMLElement>(selector('trigger'))].filter(
      (trigger) => trigger.closest(selector('root')) === root
    );
    if (triggers.length !== 1) fail('missing or ambiguous authored Trigger');
    const trigger = triggers[0];
    if (normalize(trigger.textContent) !== normalize(plan.pairs[index].triggerText))
      fail('physical Trigger differs from the authored sibling');
    return { root, trigger, originalDescriptions: tokens(trigger), content: null };
  });
  const binding: TooltipHandoffBinding = {
    subject, probe, plan, scope: boundary.scope, retained: boundary.retained,
    owner: boundary.owner, generation: boundary.generation, group, pairs, pointer: null,
    lifetimeObserver: null, lifetimeError: null, lifetimeNodes: [],
  };
  const initial = readTooltipHandoffSnapshot(binding);
  if (initial.pairs.some((pair) => !pair.closed) || initial.paintedContents !== 0 || initial.unclassifiedContents !== 0)
    fail('cold baseline is already open; no reset is allowed');
  if (pairs.some((pair) => pair.trigger.matches(':hover') || document.activeElement === pair.trigger))
    fail('cold baseline already has pointer or focus intent');
  const attributes = [
    'data-previewer-id', 'data-projection-owner', 'data-projection-generation',
    'data-projection-prototype', 'data-pui-root',
  ];
  binding.lifetimeNodes = [subject.previewer, binding.scope, binding.retained, group,
    ...pairs.flatMap(({ root, trigger }) => [root, trigger])].map((node) => ({
      node, attributes: new Map(attributes.map((name) => [name, node.getAttribute(name)])),
    }));
  binding.lifetimeObserver = new MutationObserver((records) => noteTooltipLifetimeMutations(binding, records));
  binding.lifetimeObserver.observe(document.documentElement, {
    subtree: true, childList: true, attributes: true, attributeOldValue: true,
    attributeFilter: attributes,
  });
  return binding;
}

export function readTooltipHandoffSnapshot(binding: TooltipHandoffBinding) {
  if (binding.lifetimeObserver)
    noteTooltipLifetimeMutations(binding, binding.lifetimeObserver.takeRecords());
  if (binding.lifetimeError !== null) fail(binding.lifetimeError);
  const { probe, subject, group, plan } = binding;
  const boundary = probe.readContrastAuditSubject(subject);
  if (
    !boundary.observation.achieved || boundary.scope !== binding.scope ||
    boundary.retained !== binding.retained || boundary.owner !== binding.owner ||
    boundary.generation !== binding.generation
  )
    fail('selected subject or lifetime changed');
  const groups = [...binding.retained.querySelectorAll<HTMLElement>(selector('group'))];
  if (groups.length !== 1 || groups[0] !== group) fail('missing or replaced shared Group');
  assertLease(binding, group);
  const roots = [...group.querySelectorAll<HTMLElement>(selector('root'))];
  if (roots.length !== 2 || roots.some((root, index) => root !== binding.pairs[index].root))
    fail('replaced or reordered authored Root');
  const currentContents = [...document.querySelectorAll<HTMLElement>(selector('content'))].filter(
    (content) => content.dataset.projectionOwner === binding.owner &&
      content.dataset.projectionGeneration === binding.generation
  );
  const pairs = binding.pairs.map((pair, index) => {
    assertLease(binding, pair.root);
    assertLease(binding, pair.trigger);
    const triggers = [...pair.root.querySelectorAll<HTMLElement>(selector('trigger'))];
    if (
      pair.root.closest(selector('group')) !== group || triggers.length !== 1 ||
      triggers[0] !== pair.trigger || pair.trigger.closest(selector('root')) !== pair.root
    )
      fail('foreign or replaced physical Trigger/Root pair');
    const descriptions = tokens(pair.trigger);
    if (pair.originalDescriptions.some((id) => !descriptions.includes(id)))
      fail('handoff removed a pre-existing description token');
    const ownedDescriptions = descriptions.filter((id) => !pair.originalDescriptions.includes(id));
    if (ownedDescriptions.length > 1) fail('ambiguous owned description relation');
    if (ownedDescriptions.length === 1) {
      const id = ownedDescriptions[0];
      const matches = [...document.querySelectorAll<HTMLElement>('[id]')].filter((node) => node.id === id);
      if (matches.length !== 1) fail('missing, duplicate or replaced Content IDREF target');
      const node = matches[0];
      assertLease(binding, node);
      if (!node.matches(selector('content')) || node.getAttribute('role') !== 'tooltip')
        fail('description resolves to foreign Content');
      if (normalize(node.textContent) !== normalize(plan.pairs[index].contentText))
        fail('description borrowed the sibling or a foreign Content');
      if (!pair.content) pair.content = { node, id };
      if (pair.content.node !== node || pair.content.id !== id)
        fail('materialized Content identity was replaced');
    }
    let paint: TooltipPaintObservation | null = null;
    if (pair.content) {
      const { node, id } = pair.content;
      const sameId = [...document.querySelectorAll<HTMLElement>('[id]')].filter((candidate) => candidate.id === id);
      if (sameId.some((candidate) => candidate !== node)) fail('retired Content replaced under the same ID');
      if (node.isConnected) {
        assertLease(binding, node);
        paint = probe.readContrastTargetObservation(node);
      }
    }
    return {
      rootPath: plan.pairs[index].rootPath,
      triggerPath: plan.pairs[index].triggerPath,
      contentPath: plan.pairs[index].contentPath,
      samePhysicalRoot: roots[index] === pair.root,
      samePhysicalTrigger: triggers[0] === pair.trigger,
      descriptions,
      originalDescriptions: pair.originalDescriptions,
      contentId: pair.content?.id ?? null,
      contentConnected: pair.content?.node.isConnected ?? false,
      open: ownedDescriptions.length === 1,
      closed: ownedDescriptions.length === 0 && (!pair.content?.node.isConnected || paint?.visibility.classification === 'exempt-not-visible'),
      painted: paint?.achieved === true,
      trigger: probe.readContrastTargetObservation(pair.trigger),
      content: paint,
    };
  });
  if (binding.pairs[0].content?.node === binding.pairs[1].content?.node && binding.pairs[0].content)
    fail('sibling Roots borrowed one Content');
  let paintedContents = 0;
  let unclassifiedContents = 0;
  for (const node of currentContents) {
    const paint = probe.readContrastTargetObservation(node);
    if (paint.achieved) {
      paintedContents++;
      if (!binding.pairs.some((pair) => pair.content?.node === node))
        fail('painted Content has no bound authored description owner');
    } else if (paint.visibility.classification !== 'exempt-not-visible') {
      unclassifiedContents++;
    }
  }
  return {
    owner: binding.owner,
    generation: binding.generation,
    groupPath: plan.groupPath,
    samePhysicalGroup: groups[0] === group,
    pairs,
    paintedContents,
    unclassifiedContents,
    boundary: 'Published physical Group and two Root/Trigger leases; private controller identity is not certified.',
  };
}

export function readTooltipWarmHandoff(binding: TooltipHandoffBinding, phase: TooltipHandoffPhase) {
  const snapshot = readTooltipHandoffSnapshot(binding);
  const pointer = binding.pointer;
  const index = phase === 'cold' ? 0 : 1;
  const active = snapshot.pairs[index];
  const closed = snapshot.pairs[1 - index];
  const achieved = pointer?.phase === phase && pointer.status === 'achieved' &&
    pointer.nativePointerEnter && active.open && active.painted && active.trigger.achieved &&
    active.trigger.hovered && closed.closed && snapshot.paintedContents === 1 && snapshot.unclassifiedContents === 0;
  return {
    achieved: !!achieved,
    phase,
    ...snapshot,
    timing: pointer ? {
      nativePointerEnter: pointer.nativePointerEnter,
      enteredAt: pointer.enteredAt,
      firstPaintMs: pointer.firstPaintMs,
      coldGuardObserved: pointer.coldGuardObserved,
      deadlineMs: phase === 'cold' ? binding.plan.coldDeadlineMs : binding.plan.warmDeadlineMs,
      authoredOpenDelayMs: binding.plan.openDelay,
      authoredCloseDelayMs: binding.plan.closeDelay,
      authoredSkipDelayMs: binding.plan.skipDelay,
      semanticWarmDelayMs: 0,
      status: pointer.status,
      error: pointer.error,
      samples: pointer.samples,
    } : null,
  };
}

export function armTooltipHandoffPointer(binding: TooltipHandoffBinding, phase: TooltipHandoffPhase): void {
  if (binding.pointer && binding.pointer.status !== 'achieved')
    fail('an earlier pointer observation is unfinished or failed');
  const before = readTooltipHandoffSnapshot(binding);
  if (phase === 'cold' && (binding.pointer || before.pairs.some((pair) => !pair.closed)))
    fail('cold opening requires the original untouched baseline');
  if (phase === 'warm' && (
    binding.pointer?.phase !== 'cold' || !before.pairs[0].open || !before.pairs[0].painted ||
    !before.pairs[1].closed
  ))
    fail('warm handoff requires the same still-active first Content');
  const trigger = binding.pairs[phase === 'cold' ? 0 : 1].trigger;
  const pointer: PointerObservation = {
    phase, status: 'armed', nativePointerEnter: false, enteredAt: null,
    firstPaintMs: null, coldGuardObserved: false, samples: [], error: null,
    frame: 0, inputDeadline: 0, listener: () => {},
  };
  const stop = (error: string | null) => {
    pointer.status = error === null ? 'achieved' : 'failed';
    pointer.error = error;
    cancelAnimationFrame(pointer.frame);
    clearTimeout(pointer.inputDeadline);
    trigger.removeEventListener('pointerenter', pointer.listener, true);
  };
  const sample = () => {
    try {
      const elapsedMs = performance.now() - pointer.enteredAt!;
      const snapshot = readTooltipHandoffSnapshot(binding);
      const [first, second] = snapshot.pairs;
      pointer.samples.push({
        elapsedMs, firstPainted: first.painted, secondPainted: second.painted,
        firstDescriptions: first.descriptions, secondDescriptions: second.descriptions,
      });
      if (phase === 'cold') {
        if (!second.closed) return stop('sibling opened during cold first intent');
        if (first.open && elapsedMs < binding.plan.openDelay)
          return stop('cold openDelay was bypassed');
        if (elapsedMs >= binding.plan.coldGuardMs && first.closed)
          pointer.coldGuardObserved = true;
        if (first.open && first.painted) {
          pointer.firstPaintMs = elapsedMs;
          if (!pointer.coldGuardObserved || elapsedMs < binding.plan.openDelay)
            return stop('cold openDelay was bypassed');
          if (elapsedMs > binding.plan.coldDeadlineMs) return stop('cold opening deadline exceeded');
          return stop(null);
        }
        if (elapsedMs >= binding.plan.coldDeadlineMs) return stop('cold opening deadline exceeded');
      } else {
        if (second.open && second.painted && !first.closed)
          return stop('first Content retained during warm sibling handoff');
        if (second.open && second.painted && first.closed) {
          pointer.firstPaintMs = elapsedMs;
          if (elapsedMs >= binding.plan.warmDeadlineMs) return stop('warm handoff took the cold-delay path');
          if (snapshot.paintedContents !== 1 || snapshot.unclassifiedContents !== 0)
            return stop('warm handoff has an extra or unclassified Content');
          return stop(null);
        }
        if (elapsedMs >= binding.plan.warmDeadlineMs) return stop('warm handoff took the cold-delay path');
      }
      pointer.frame = requestAnimationFrame(sample);
    } catch (error) {
      stop(error instanceof Error ? error.message : String(error));
    }
  };
  pointer.listener = (event) => {
    if (!event.isTrusted) return stop('pointer enter was not native');
    pointer.nativePointerEnter = true;
    pointer.enteredAt = performance.now();
    pointer.status = 'observing';
    clearTimeout(pointer.inputDeadline);
    trigger.removeEventListener('pointerenter', pointer.listener, true);
    pointer.frame = requestAnimationFrame(sample);
  };
  binding.pointer = pointer;
  trigger.addEventListener('pointerenter', pointer.listener, true);
  pointer.inputDeadline = window.setTimeout(() => stop('native pointer enter was not observed'), 2000);
}

export function readTooltipHandoffPointerResult(binding: TooltipHandoffBinding) {
  const pointer = binding.pointer;
  if (!pointer || pointer.status === 'armed' || pointer.status === 'observing') return null;
  if (pointer.status === 'failed') fail(pointer.error ?? 'pointer observation failed');
  return readTooltipWarmHandoff(binding, pointer.phase);
}

// Failure diagnostics deliberately report the ended/foreign coordinates too.
// They never re-admit the subject, satisfy a target or repair input/state.
export function readTooltipHandoffDiagnostics(binding: TooltipHandoffBinding) {
  const pointer = binding.pointer;
  return {
    expectedLease: { owner: binding.owner, generation: binding.generation },
    currentScope: {
      connected: binding.scope.isConnected,
      owner: binding.scope.dataset.projectionOwner ?? null,
      generation: binding.scope.dataset.projectionGeneration ?? null,
    },
    groupConnected: binding.group.isConnected,
    lifetimeError: binding.lifetimeError,
    pairs: binding.pairs.map((pair, index) => ({
      rootPath: binding.plan.pairs[index].rootPath,
      rootConnected: pair.root.isConnected,
      triggerConnected: pair.trigger.isConnected,
      descriptions: tokens(pair.trigger),
      contentId: pair.content?.id ?? null,
      contentConnected: pair.content?.node.isConnected ?? false,
    })),
    pointer: pointer ? {
      phase: pointer.phase,
      status: pointer.status,
      nativePointerEnter: pointer.nativePointerEnter,
      enteredAt: pointer.enteredAt,
      firstPaintMs: pointer.firstPaintMs,
      coldGuardObserved: pointer.coldGuardObserved,
      error: pointer.error,
      samples: pointer.samples,
    } : null,
    disposition: 'Failure diagnostics only; no PNG/facts match or achieved target.',
  };
}

export function disposeTooltipHandoff(binding: TooltipHandoffBinding): void {
  binding.lifetimeObserver?.disconnect();
  const pointer = binding.pointer;
  if (!pointer) return;
  cancelAnimationFrame(pointer.frame);
  clearTimeout(pointer.inputDeadline);
  binding.pairs[pointer.phase === 'cold' ? 0 : 1].trigger.removeEventListener('pointerenter', pointer.listener, true);
}
