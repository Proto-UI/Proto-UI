import { FeedbackStyleRecorder, type StyleHandle } from '@proto.ui/core';

/**
 * Private logic model for #935. Not exported by the package and not activated
 * by Def, Rule, Template or any adapter. A callback is NOT proof of physical
 * ownership, accessibility exclusion or native no-reset support. #938's API
 * and view-lifetime activation questions remain unresolved.
 */
type Identity = object;
type Snapshot = Readonly<{ kind: 'tw'; tokens: readonly string[] }>;
type Sink = (value: Snapshot) => void;
type Contribution = { target: Identity; origin: 'setup' | 'rule'; handles: StyleHandle[] };
type Target = { sink?: Sink; published?: string; revision: number };

export class OwnedDecorationRegistryModel {
  private phase: 'declaring' | 'bound' | 'disposed' = 'declaring';
  private binding = false;
  private readonly targets = new Map<Identity, Target>();
  private readonly contributions = new Map<Identity, Contribution>();

  private isDisposed(): boolean {
    return this.phase === 'disposed';
  }
  private live(): void {
    if (this.phase === 'disposed') throw new Error('owned-decoration: disposed');
  }
  private declaring(): void {
    this.live();
    if (this.phase !== 'declaring') throw new Error('owned-decoration: declarations closed');
  }
  private target(identity: Identity): Target {
    this.live();
    const value = this.targets.get(identity);
    if (!value) throw new Error('owned-decoration: foreign or unknown target');
    return value;
  }
  private contribution(identity: Identity): Contribution {
    this.live();
    const value = this.contributions.get(identity);
    if (!value) throw new Error('owned-decoration: foreign or unknown contribution');
    return value;
  }

  declareTarget(): Identity {
    this.declaring();
    const identity = Object.freeze({});
    this.targets.set(identity, { revision: 0 });
    return identity;
  }

  /** Stable declaration order, not update arrival order, determines precedence. */
  declareContribution(target: Identity, origin: 'setup' | 'rule'): Identity {
    this.declaring();
    this.target(target);
    if (origin !== 'setup' && origin !== 'rule') throw new Error('owned-decoration: origin');
    const identity = Object.freeze({});
    this.contributions.set(identity, { target, origin, handles: [] });
    return identity;
  }

  replace(identity: Identity, ...handles: StyleHandle[]): void {
    const owner = this.contribution(identity);
    // Validate and snapshot the complete replacement before retiring old intent.
    const copied = handles.map((h) => {
      if (!h || h.kind !== 'tw' || !Array.isArray(h.tokens))
        throw new Error('owned-decoration: invalid style handle');
      return { kind: 'tw' as const, tokens: [...h.tokens] };
    });
    const validation = new FeedbackStyleRecorder();
    validation.use(...copied);
    // Caller-owned getters may have run while snapshotting. Recheck lifetime.
    this.contribution(identity);
    owner.handles = copied;
    if (this.phase === 'bound') this.publish(owner.target);
  }

  withdraw(identity: Identity): void {
    this.replace(identity);
  }

  snapshot(target: Identity): Snapshot {
    this.target(target);
    const recorder = new FeedbackStyleRecorder();
    // Match the existing setup baseline followed by declaration-ordered Rules.
    for (const origin of ['setup', 'rule'] as const)
      for (const item of this.contributions.values()) {
        if (item.target !== target || item.origin !== origin) continue;
        if (origin === 'setup') recorder.use(...item.handles);
        else recorder.useRuntime(...item.handles);
      }
    return Object.freeze({ kind: 'tw', tokens: Object.freeze(recorder.export().tokens) });
  }

  /**
   * Model binding only. Validate the entire required set before invoking ANY
   * callback. The future adapter must independently prove owned decorative leaves.
   * This model deliberately rejects structural rebinding and implicit rescope.
   */
  bindAll(bindings: readonly { target: Identity; sink: Sink }[]): void {
    this.declaring();
    if (this.binding) throw new Error('owned-decoration: reentrant binding');
    this.binding = true;
    try {
      const checked = new Map<Identity, Sink>();
      for (const binding of bindings) {
        // Snapshot each caller-owned field once before validation. Getters are
        // not trusted to be repeatable or to preserve this registry's lifetime.
        const target = binding.target;
        const sink = binding.sink;
        this.target(target);
        if (checked.has(target)) throw new Error('owned-decoration: duplicate binding');
        if (typeof sink !== 'function') throw new Error('owned-decoration: unsupported sink');
        checked.set(target, sink);
      }
      this.declaring();
      if (checked.size !== this.targets.size) throw new Error('owned-decoration: unbound target');
      for (const [identity, sink] of checked) this.targets.get(identity)!.sink = sink;
      this.phase = 'bound';
    } finally {
      this.binding = false;
    }
    this.flush();
  }

  private publish(identity: Identity): void {
    const target = this.target(identity);
    if (this.phase !== 'bound' || !target.sink) throw new Error('owned-decoration: unbound target');
    const value = this.snapshot(identity);
    const key = JSON.stringify(value.tokens);
    if (target.published === key) return;
    const previous = target.published;
    // Prevent same-value reentrant publication; roll back only this attempt on
    // failure. A later nested update or terminal disposal must not be overwritten.
    const revision = ++target.revision;
    target.published = key;
    try {
      target.sink(value);
    } catch (error) {
      if (!this.isDisposed() && target.revision === revision) target.published = previous;
      throw error;
    }
  }

  flush(): void {
    this.live();
    if (this.phase !== 'bound') throw new Error('owned-decoration: unbound target');
    for (const identity of this.targets.keys()) {
      if (this.isDisposed()) break;
      this.publish(identity);
    }
  }

  dispose(): void {
    if (this.phase === 'disposed') return;
    this.phase = 'disposed';
    this.targets.clear();
    this.contributions.clear();
  }
}
