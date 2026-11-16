import { isControlLabelRef, type ControlLabelActivationSource } from '@proto.ui/core';
import type { ControlLabelOptions, ControlLabelRef } from '@proto.ui/core';

export type ControlLabelView = Readonly<{
  /** Host-private identities; never author Props, State or Context values. */
  identity: object;
  scope: object;
}>;
export type ControlLabelParticipant = Readonly<{
  owner: object;
  kind: 'label' | 'target';
  ref: ControlLabelRef;
  /** Opaque source identity; the target host owns any local A11y translation. */
  semanticRef: object;
  view(): ControlLabelView | null;
  options(): ControlLabelOptions;
  name(label: object, view: ControlLabelView): { dispose(): void; isActive(): boolean } | null;
  activate(isCurrent: () => boolean, source: ControlLabelActivationSource): void;
  diagnostic(code: string | null): void;
}>;
export type ControlLabelBinding = Readonly<{
  refresh(): void;
  requestActivation(source?: ControlLabelActivationSource): void;
  dispose(): void;
}>;
type ControlLabelPairAuthority = Readonly<{
  version: 1;
  bind(participant: ControlLabelParticipant): ControlLabelBinding;
}>;

type Pair = {
  label: ControlLabelParticipant;
  target: ControlLabelParticipant;
  labelView: ControlLabelView;
  targetView: ControlLabelView;
  naming: boolean;
  activation: boolean;
  nameLease: { dispose(): void; isActive(): boolean } | null;
};
type Group = {
  participants: Map<object, ControlLabelParticipant>;
  revision: number;
  pair: Pair | null;
  refreshing: boolean;
  dirty: boolean;
};
const groups = new WeakMap<ControlLabelRef, Group>();

function current(group: Group, pair: Pair): boolean {
  if (group.pair !== pair) return false;
  const label = pair.label.view();
  const target = pair.target.view();
  return (
    group.pair === pair &&
    group.participants.get(pair.label.owner) === pair.label &&
    group.participants.get(pair.target.owner) === pair.target &&
    label?.identity === pair.labelView.identity &&
    target?.identity === pair.targetView.identity &&
    label?.scope === pair.labelView.scope &&
    target?.scope === pair.targetView.scope &&
    pair.label.options().activation === pair.activation &&
    pair.label.options().naming === pair.naming
  );
}

function withdraw(group: Group): void {
  const pair = group.pair;
  group.pair = null;
  pair?.nameLease?.dispose();
}

function refresh(group: Group): void {
  if (group.refreshing) {
    group.dirty = true;
    return;
  }
  group.refreshing = true;
  try {
    do {
      group.dirty = false;
      const revision = group.revision;
      const participants = [...group.participants.values()];
      const live = participants
        .map((participant) => ({ participant, view: participant.view() }))
        .filter(
          (entry): entry is { participant: ControlLabelParticipant; view: ControlLabelView } =>
            entry.view !== null
        );
      if (revision !== group.revision) {
        group.dirty = true;
        continue;
      }
      const labels = live.filter((entry) => entry.participant.kind === 'label');
      const targets = live.filter((entry) => entry.participant.kind === 'target');
      let code: string | null =
        labels.length > 1 || targets.length > 1
          ? 'duplicate-binding'
          : labels.length !== 1 || targets.length !== 1
            ? 'missing-binding'
            : labels[0]!.view.scope !== targets[0]!.view.scope
              ? 'foreign-tree-scope'
              : null;
      if (code) {
        withdraw(group);
      } else {
        const label = labels[0]!;
        const target = targets[0]!;
        const options = label.participant.options();
        const previous = group.pair;
        if (
          !previous ||
          !current(group, previous) ||
          previous.label !== label.participant ||
          previous.target !== target.participant ||
          (previous.naming && !previous.nameLease?.isActive())
        ) {
          withdraw(group);
          if (revision !== group.revision) {
            group.dirty = true;
            continue;
          }
          const pair: Pair = {
            label: label.participant,
            target: target.participant,
            labelView: label.view,
            targetView: target.view,
            naming: options.naming,
            activation: options.activation,
            nameLease: null,
          };
          group.pair = pair;
          try {
            if (options.naming)
              pair.nameLease = target.participant.name(label.participant.semanticRef, label.view);
          } catch (error) {
            if (group.pair === pair) withdraw(group);
            throw error;
          }
          if (!current(group, pair)) {
            withdraw(group);
            group.dirty = true;
            continue;
          }
        }
        if (group.pair?.naming && !group.pair.nameLease?.isActive()) code = 'name-conflict';
      }
      for (const participant of participants) participant.diagnostic(code);
    } while (group.dirty);
  } finally {
    group.refreshing = false;
  }
}

/** One lease per logical owner. An obsolete release never withdraws its successor. */
function bindParticipant(participant: ControlLabelParticipant): ControlLabelBinding {
  if (!isControlLabelRef(participant.ref))
    throw new TypeError('[ControlLabel] invalid opaque association reference');
  let group = groups.get(participant.ref);
  if (!group) {
    group = { participants: new Map(), revision: 0, pair: null, refreshing: false, dirty: false };
    groups.set(participant.ref, group);
  }
  const ownGroup = group;
  ownGroup.participants.set(participant.owner, participant);
  ownGroup.revision += 1;
  try {
    refresh(ownGroup);
  } catch (error) {
    if (ownGroup.participants.get(participant.owner) === participant) {
      ownGroup.participants.delete(participant.owner);
      ownGroup.revision += 1;
      try {
        refresh(ownGroup);
      } catch {
        /* Preserve the first binding failure. */
      }
    }
    throw error;
  }
  return {
    refresh() {
      if (ownGroup.participants.get(participant.owner) === participant) refresh(ownGroup);
    },
    requestActivation(source = 'pointer') {
      if (
        participant.kind !== 'label' ||
        ownGroup.participants.get(participant.owner) !== participant
      )
        return;
      refresh(ownGroup);
      const pair = ownGroup.pair;
      if (!pair || pair.label !== participant || !pair.activation || !current(ownGroup, pair))
        return;
      pair.target.activate(() => current(ownGroup, pair), source);
    },
    dispose() {
      if (ownGroup.participants.get(participant.owner) !== participant) return;
      ownGroup.participants.delete(participant.owner);
      ownGroup.revision += 1;
      refresh(ownGroup);
    },
  };
}

/** One same-realm domain includes runtime and separately emitted native graphs. */
export function bindControlLabel(participant: ControlLabelParticipant): ControlLabelBinding {
  const key = Symbol.for('@proto.ui/control-label/pairs/v1');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  if (descriptor) {
    const service = descriptor.value as ControlLabelPairAuthority | undefined;
    if (
      descriptor.get ||
      descriptor.set ||
      descriptor.configurable ||
      descriptor.writable ||
      !service ||
      !Object.isFrozen(service) ||
      service.version !== 1 ||
      typeof service.bind !== 'function'
    )
      throw new TypeError('[ControlLabel] incompatible same-realm pairing ABI; expected v1');
    return service.bind(participant);
  }
  const service: ControlLabelPairAuthority = Object.freeze({
    version: 1 as const,
    bind: bindParticipant,
  });
  Object.defineProperty(globalThis, key, { value: service });
  return service.bind(participant);
}
