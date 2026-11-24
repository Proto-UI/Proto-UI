import type {
  OwnerMatrixFixture,
  OwnerMatrixJourney,
  OwnerMatrixTarget,
} from './owner-hydration-matrix-fixture';

type Snapshot = { value: number };
type Exposes = { value: { get(): number }; contextSnapshot(): Snapshot };
type Handle = { getExposes(): Exposes };
type Audit = { active: number; mounted: number; retired: number; events: number; watched: number };
type NativeModules = Record<OwnerMatrixTarget, { provider: any; consumer: any }>;
type Frameworks = { React: any; Vue: any; Vue2: any };
type Session = {
  root(): Handle;
  child(): Handle;
  nested(): Handle;
  nestedChild(): Handle;
  audit: Audit;
  rejected: boolean;
  rejection: string | null;
  phaseLog: string[];
  failedState?: Exposes['value'];
  beforeFailure?: number;
  transport(): null | {
    closed: boolean;
    owners: number;
    pending: number;
    initial: number | null;
    commits: number | null;
    props: number | null;
    failure: unknown;
  };
  set(props: { seed?: number; visible?: boolean }): Promise<void>;
  settle(): Promise<void>;
  dispose(): Promise<void>;
  poke(): Promise<void>;
};

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function until(predicate: () => boolean, label: string, diagnose?: () => unknown) {
  const deadline = performance.now() + 5000;
  let last: unknown;
  do {
    try {
      if (predicate()) return;
    } catch (error) {
      last = error;
    }
    await frame();
  } while (performance.now() < deadline);
  throw new Error(
    `Owner browser readiness failed (${label}): ${String(last ?? 'condition remained false')} ${JSON.stringify(diagnose?.() ?? null)}`
  );
}
function refused(run: () => unknown) {
  try {
    run();
    return { refused: false, reason: null };
  } catch (error) {
    return { refused: true, reason: String(error) };
  }
}

/** Native consumers only. All Proto ownership/State/Context behavior is emitted source. */
export function createOwnerBrowserMatrix(frameworks: Frameworks, modules: NativeModules) {
  let cleanup: (() => Promise<unknown>) | undefined;
  let sequence = 0;
  async function mount(
    target: OwnerMatrixTarget,
    journey: OwnerMatrixJourney,
    fixture: OwnerMatrixFixture,
    host: HTMLElement,
    seed: number,
    correct: boolean
  ): Promise<Session> {
    const { React, Vue, Vue2 } = frameworks;
    const { provider, consumer } = modules[target];
    const Provider = provider.default ?? provider.OwnerProvider,
      Consumer = consumer.default ?? consumer.OwnerConsumer;
    const phaseLog: string[] = [];
    let failedState: Exposes['value'] | undefined, beforeFailure: number | undefined;
    const phase = (name: string) => (value: string) => {
      phaseLog.push(`${name}:${value}`);
      if (journey === 'failure' && !correct && name === 'child' && value === 'created') {
        failedState = root().getExposes().value;
        beforeFailure = failedState.get();
        throw false;
      }
    };
    const audit: Audit = { active: 0, mounted: 0, retired: 0, events: 0, watched: 0 };
    const event = `owner-matrix-probe-${++sequence}`;
    const listener = () => {
      audit.events += 1;
    };
    let rejected = false,
      rejection: string | null = null;
    let current = { seed, visible: true, commitEffects: journey === 'commit' };
    let root: () => Handle, child: () => Handle, nested: () => Handle, nestedChild: () => Handle;
    let transport: Session['transport'] = () => null;
    let set: Session['set'],
      settle: Session['settle'],
      dispose: Session['dispose'],
      poke: Session['poke'];
    if (target === 'react') {
      const h = React.createElement;
      const childRef = React.createRef(),
        nestedRef = React.createRef(),
        nestedChildRef = React.createRef();
      function NativeProbe() {
        React.useEffect(() => {
          audit.active++;
          audit.mounted++;
          audit.watched++;
          window.addEventListener(event, listener);
          return () => {
            audit.active--;
            audit.retired++;
            window.removeEventListener(event, listener);
          };
        }, []);
        return h('button', null, correct ? 'server' : 'client');
      }
      const children = () =>
        journey === 'rejection'
          ? h(React.Suspense, { fallback: null }, h(NativeProbe))
          : h(
              'article',
              { 'data-native-wrapper': '' },
              h(Consumer, { ref: childRef, onPhase: phase('child') }),
              h(
                Provider,
                { ref: nestedRef, seed: 11, onPhase: phase('nested') },
                h(Consumer, { ref: nestedChildRef, onPhase: phase('nested-child') })
              )
            );
      const props = () => ({ ...current, children: children(), onPhase: phase('root') });
      const app = provider.hydrateGeneratedRoot(host, props(), fixture.carrier, {
        onRecoverableError(error: unknown) {
          rejection = String(error);
        },
      });
      settle = async () => {
        await frame();
        await frame();
      };
      root = () => app.getHandle();
      child = () => childRef.current;
      nested = () => nestedRef.current;
      nestedChild = () => nestedChildRef.current;
      set = async (next) => {
        current = { ...current, ...next };
        app.render(props());
        await settle();
      };
      dispose = async () => {
        app.unmount();
        await settle();
      };
      poke = async () => {
        window.dispatchEvent(new Event(event));
        await settle();
      };
      if (!correct && journey === 'rejection') {
        await until(
          () => app.diagnostics.length > 0 && audit.retired === audit.mounted && audit.mounted > 0,
          'React rejected native retirement'
        );
        rejected = refused(() => app.getHandle()).refused;
      } else await until(() => !!app.getHandle(), 'React accepted owner');
    } else if (target === 'vue') {
      const h = Vue.h,
        rootRef = Vue.shallowRef(),
        childRef = Vue.shallowRef(),
        nestedRef = Vue.shallowRef(),
        nestedChildRef = Vue.shallowRef();
      const input = Vue.shallowReactive({ ...current, ref: rootRef, onPhase: phase('root') });
      const signal = Vue.ref(0);
      const NativeProbe = Vue.defineComponent({
        setup() {
          audit.active++;
          Vue.watchEffect(() => {
            signal.value;
            audit.watched++;
          });
          Vue.onScopeDispose(() => {
            audit.active--;
          });
          Vue.onMounted(() => {
            audit.mounted++;
            window.addEventListener(event, listener);
          });
          Vue.onUnmounted(() => {
            audit.retired++;
            window.removeEventListener(event, listener);
          });
          return () => h('button', correct ? 'server' : 'client');
        },
      });
      const slots = {
        default: () =>
          journey === 'rejection'
            ? [h(NativeProbe)]
            : [
                h('article', { 'data-native-wrapper': '' }, [
                  h(Consumer, { ref: childRef, onPhase: phase('child') }),
                  h(
                    Provider,
                    { ref: nestedRef, seed: 11, onPhase: phase('nested') },
                    {
                      default: () => [
                        h(Consumer, { ref: nestedChildRef, onPhase: phase('nested-child') }),
                      ],
                    }
                  ),
                ]),
              ],
      };
      let app: any;
      try {
        app = provider.hydrate(host, fixture.carrier, {
          props: input,
          slots,
          configureApp(value: any) {
            app = value;
            value.config.errorHandler = (error: unknown) => {
              rejection ??= String(error);
            };
          },
        });
      } catch (error) {
        rejected = true;
        rejection = String(error);
      }
      settle = async () => {
        await Vue.nextTick();
        await Vue.nextTick();
        await frame();
      };
      root = () => rootRef.value;
      child = () => childRef.value;
      nested = () => nestedRef.value;
      nestedChild = () => nestedChildRef.value;
      set = async (next) => {
        Object.assign(input, next);
        await settle();
      };
      dispose = async () => {
        app.unmount();
        await settle();
      };
      poke = async () => {
        signal.value++;
        window.dispatchEvent(new Event(event));
        await settle();
      };
      // Observe the actual shared generated session only for failure/retirement
      // diagnostics. No owner state, scheduler or native renderer is simulated.
      const session = app?._context?.provides?.[Symbol.for('ProtoUI.Vue.SSR.Session.v1')];
      transport = () =>
        session
          ? {
              closed: session.closed,
              owners: session.owners.size,
              pending: session.pending.size,
              initial: session.initialOwners?.size ?? null,
              commits: session.initialCommits?.size ?? null,
              props: session.deferredProps?.size ?? null,
              failure: session.failure?.value ?? null,
            }
          : null;
      await settle();
      if (!rejected)
        await until(
          () => {
            if (session?.closed && session.failure) {
              rejected = true;
              rejection = String(session.failure.value);
              return true;
            }
            return rootRef.value?.getExposes().value.get() !== undefined;
          },
          'Vue accepted or retired owner',
          () => ({
            phases: [...phaseLog],
            root: !!rootRef.value,
            child: !!childRef.value,
            nested: !!nestedRef.value,
            nestedChild: !!nestedChildRef.value,
            rejection,
            failure: String(session?.failure?.value),
            html: host.innerHTML,
          })
        );
    } else {
      const signal = Vue2.observable({ value: 0 });
      const refs: { child?: Handle; nested?: Handle; nestedChild?: Handle } = {};
      const NativeProbe = {
        created(this: any) {
          audit.active++;
          this.$watch(
            () => signal.value,
            () => {
              audit.watched++;
            },
            { immediate: true }
          );
        },
        mounted() {
          audit.mounted++;
          window.addEventListener(event, listener);
        },
        destroyed() {
          audit.active--;
          audit.retired++;
          window.removeEventListener(event, listener);
        },
        render(h: any) {
          return h('button', correct ? 'server' : 'client');
        },
      };
      const capture = (name: 'child' | 'nested' | 'nestedChild') => ({
        insert(vnode: any) {
          refs[name] = vnode.componentInstance;
        },
      });
      const children = (h: any) =>
        journey === 'rejection'
          ? [h(NativeProbe)]
          : [
              h('article', { attrs: { 'data-native-wrapper': '' } }, [
                h(Consumer, { hook: capture('child'), on: { phase: phase('child') } }),
                h(
                  Provider,
                  { hook: capture('nested'), props: { seed: 11 }, on: { phase: phase('nested') } },
                  [
                    h(Consumer, {
                      hook: capture('nestedChild'),
                      on: { phase: phase('nested-child') },
                    }),
                  ]
                ),
              ]),
            ];
      let app: any;
      try {
        app = await provider.hydrate({
          Vue: Vue2,
          target: host.firstChild,
          carrier: fixture.carrier,
          props: current,
          children,
          on: { phase: phase('root') },
        });
      } catch (error) {
        rejected = true;
        rejection = String(error);
      }
      settle = async () => {
        await Vue2.nextTick();
        await Vue2.nextTick();
        await frame();
      };
      root = () => app.instance;
      child = () => refs.child!;
      nested = () => refs.nested!;
      nestedChild = () => refs.nestedChild!;
      set = async (next) => {
        current = { ...current, ...next };
        app.setProps(current);
        await settle();
      };
      dispose = async () => {
        app?.dispose();
        await settle();
      };
      poke = async () => {
        signal.value++;
        window.dispatchEvent(new Event(event));
        await settle();
      };
      await settle();
    }
    return {
      root,
      child,
      nested,
      nestedChild,
      audit,
      rejected,
      rejection,
      phaseLog,
      failedState,
      beforeFailure,
      transport,
      set,
      settle,
      dispose,
      poke,
    };
  }

  async function run(
    target: OwnerMatrixTarget,
    journey: OwnerMatrixJourney,
    fixture: OwnerMatrixFixture
  ) {
    if (cleanup) await cleanup();
    cleanup = undefined;
    const host = document.getElementById('owner-matrix-host')!;
    if (!host?.firstChild) throw new Error('The actual server-rendered fixture was not supplied.');
    const originalNode = host.firstChild;
    const first = await mount(
      target,
      journey,
      fixture,
      host,
      journey === 'absent' || journey === 'failure' ? 9 : 3,
      journey === 'ownership' || journey === 'absent' || journey === 'commit'
    );
    cleanup = () => first.dispose();
    const observed: Record<string, unknown> = {
      target,
      journey,
      framework:
        frameworks[target === 'react' ? 'React' : target === 'vue' ? 'Vue' : 'Vue2'].version,
    };
    if (journey === 'commit') {
      await until(
        () =>
          !first.rejected &&
          first.child()?.getExposes().value.get() === 8 &&
          [...host.querySelectorAll('output')].map((node) => node.textContent).join(',') ===
            '8,8,11,11',
        'Context update from actual mounted and updated callbacks',
        () => ({
          phases: first.phaseLog,
          transport: first.transport(),
          rejection: first.rejection,
          html: host.innerHTML,
        })
      );
      const exposes = [first.root(), first.child(), first.nested(), first.nestedChild()].map(
        (handle) => handle.getExposes()
      );
      const context = exposes[0].contextSnapshot();
      const phases = [...first.phaseLog];
      observed.commit = {
        rejected: first.rejected,
        sameDom: host.firstChild === originalNode,
        values: exposes.map((value) => value.value.get()),
        sharedContext: context === exposes[1].contextSnapshot(),
        distinctContext: context !== exposes[2].contextSnapshot(),
        distinctStates: new Set(exposes.map((value) => value.value)).size === 4,
        allCreatedBeforeCommit:
          Math.max(...phases.map((phase, index) => (phase.endsWith(':created') ? index : -1))) <
          phases.findIndex((phase) => phase.endsWith(':mounted')),
        phases,
        transport: first.transport(),
      };
      await first.set({ seed: 9 });
      await until(
        () =>
          first.child().getExposes().value.get() === 9 &&
          host.querySelector('output')?.textContent === '9',
        'ordinary current Props after accepted initial graph'
      );
      observed.updated = {
        values: exposes.map((value) => value.value.get()),
        sameState: exposes.every(
          (value, index) =>
            value.value ===
            [first.root(), first.child(), first.nested(), first.nestedChild()][index].getExposes()
              .value
        ),
        sharedContext: exposes[0].contextSnapshot() === exposes[1].contextSnapshot(),
      };
      cleanup = async () => {
        await first.dispose();
        return {
          states: exposes.map((value) => refused(() => value.value.get())),
          callbacks: exposes.map((value) => refused(value.contextSnapshot)),
          phases: [...first.phaseLog],
          transport: first.transport(),
        };
      };
      return observed;
    }
    if (journey === 'absent' || journey === 'failure') {
      if (journey === 'failure') {
        observed.failed = {
          rejected: first.rejected,
          rejection: first.rejection,
          initialRootValue: first.beforeFailure,
          state: refused(() => first.failedState!.get()),
          transport: first.transport(),
          phases: [...first.phaseLog],
        };
        host.innerHTML = fixture.html;
      }
      const selected =
        journey === 'failure' ? await mount(target, journey, fixture, host, 9, true) : first;
      cleanup = () => selected.dispose();
      await until(
        () =>
          [selected.root(), selected.child(), selected.nested(), selected.nestedChild()].every(
            (handle) => handle?.getExposes().value.get() !== undefined
          ) &&
          selected.child().getExposes().value.get() === 9 &&
          host.querySelector('output')?.textContent === '9',
        'explicit current input after absent or failed initialization',
        () => ({
          phases: [...selected.phaseLog],
          transport: selected.transport(),
          failure: String(selected.transport()?.failure),
          html: host.innerHTML,
        })
      );
      const exposes = [
        selected.root(),
        selected.child(),
        selected.nested(),
        selected.nestedChild(),
      ].map((handle) => handle.getExposes());
      const context = exposes[0].contextSnapshot(),
        nestedContext = exposes[2].contextSnapshot();
      observed.fresh = {
        rejected: selected.rejected,
        values: exposes.map((value) => value.value.get()),
        ownContext: context === exposes[1].contextSnapshot(),
        nestedContext: nestedContext === exposes[3].contextSnapshot(),
        distinctContexts: context !== nestedContext,
        distinctStates: new Set(exposes.map((value) => value.value)).size === 4,
        newState: journey === 'failure' ? exposes[0].value !== first.failedState : true,
        phases: [...selected.phaseLog],
        transport: selected.transport(),
      };
      cleanup = async () => {
        await selected.dispose();
        return {
          states: exposes.map((value) => refused(() => value.value.get())),
          callbacks: exposes.map((value) => refused(value.contextSnapshot)),
          phases: [...selected.phaseLog],
          transport: selected.transport(),
          oldState: first.failedState ? refused(() => first.failedState!.get()) : null,
        };
      };
      return observed;
    }
    if (journey === 'rejection') {
      observed.rejected = first.rejected;
      observed.rejection = first.rejection;
      observed.retiredAudit = { ...first.audit };
      const before = first.audit.watched;
      await first.poke();
      observed.oldWorkIgnored = first.audit.events === 0 && first.audit.watched === before;
      observed.rejectedPhases = [...first.phaseLog];
      host.innerHTML = fixture.html;
      const freshNode = host.firstChild;
      const fresh = await mount(target, journey, fixture, host, 9, true);
      cleanup = async () => {
        await fresh.dispose();
        return {
          audit: { ...fresh.audit },
          phases: [...fresh.phaseLog],
          rejectedAudit: { ...first.audit },
        };
      };
      await until(
        () =>
          fresh.root().getExposes().value.get() === 9 &&
          host.querySelector('output')?.textContent === '9',
        'fresh current controlling Props and paint'
      );
      observed.fresh = {
        sameDom: host.firstChild === freshNode,
        value: fresh.root().getExposes().value.get(),
        context: fresh.root().getExposes().contextSnapshot().value,
        output: host.querySelector('output')?.textContent,
        button: host.querySelector('button')?.textContent,
        audit: { ...fresh.audit },
        phases: [...fresh.phaseLog],
      };
      return observed;
    }
    await until(
      () =>
        [first.root(), first.child(), first.nested(), first.nestedChild()].every(
          (handle) => handle?.getExposes().value.get() !== undefined
        ),
      'all actual Context consumers'
    );
    const root = first.root().getExposes(),
      child = first.child().getExposes(),
      nested = first.nested().getExposes(),
      nestedChild = first.nestedChild().getExposes();
    const rootState = root.value,
      childState = child.value,
      initialContext = root.contextSnapshot(),
      nestedContext = nested.contextSnapshot();
    observed.initial = {
      sameDom: host.firstChild === originalNode,
      values: [root.value.get(), child.value.get(), nested.value.get(), nestedChild.value.get()],
      ownContext: initialContext === child.contextSnapshot(),
      nestedContext: nestedContext === nestedChild.contextSnapshot(),
      distinctContexts: initialContext !== nestedContext,
      distinctStates:
        new Set([root.value, child.value, nested.value, nestedChild.value]).size === 4,
    };
    await first.set({ seed: 7 });
    await until(() => first.child().getExposes().value.get() === 7, 'controlled Context update');
    const changedContext = root.contextSnapshot();
    observed.updated = {
      values: [root.value.get(), child.value.get(), nested.value.get(), nestedChild.value.get()],
      sameState: root.value === rootState && first.child().getExposes().value === childState,
      sharedContext: changedContext === child.contextSnapshot(),
      newContextValue: changedContext !== initialContext,
      nestedUnaffected: nested.contextSnapshot() === nestedContext,
    };
    const oldCallback = child.contextSnapshot;
    let release!: () => void;
    const late = new Promise<void>((resolve) => {
      release = resolve;
    }).then(() => refused(oldCallback));
    await first.set({ visible: false });
    await until(
      () => refused(() => childState.get()).refused,
      'removed native child terminal cleanup'
    );
    observed.hidden = {
      outputCount: host.querySelectorAll('output').length,
      sameRootState: first.root().getExposes().value === rootState,
      sameRootContext: root.contextSnapshot() === changedContext,
      childRetired: refused(() => childState.get()),
      rootValue: rootState.get(),
    };
    await first.set({ visible: true });
    await until(
      () =>
        first.child().getExposes().value !== childState &&
        first.child().getExposes().value.get() === 7 &&
        [first.nested(), first.nestedChild()].every(
          (handle) => handle?.getExposes().value.get() === 11
        ),
      'new child in rebuilt Context graph'
    );
    release();
    observed.lateCallback = await late;
    observed.rebound = {
      sameRootState: first.root().getExposes().value === rootState,
      sameRootContext: root.contextSnapshot() === changedContext,
      newChildState: first.child().getExposes().value !== childState,
      childContext: first.child().getExposes().contextSnapshot() === changedContext,
      newNestedContext: first.nested().getExposes().contextSnapshot() !== nestedContext,
      values: [
        rootState.get(),
        first.child().getExposes().value.get(),
        first.nestedChild().getExposes().value.get(),
      ],
      rootCreated: first.phaseLog.filter((item) => item === 'root:created').length,
    };
    await first.dispose();
    observed.terminal = {
      state: refused(() => rootState.get()),
      callback: refused(root.contextSnapshot),
      phases: [...first.phaseLog],
    };
    host.innerHTML = fixture.html;
    const freshNode = host.firstChild;
    const fresh = await mount(target, journey, fixture, host, 9, true);
    cleanup = async () => {
      const exposes = [fresh.root(), fresh.child(), fresh.nested(), fresh.nestedChild()].map(
        (handle) => handle.getExposes()
      );
      await fresh.dispose();
      return {
        states: exposes.map((item) => refused(() => item.value.get())),
        callbacks: exposes.map((item) => refused(item.contextSnapshot)),
        phases: [...fresh.phaseLog],
      };
    };
    await until(
      () =>
        fresh.child().getExposes().value.get() === 9 &&
        [fresh.nested(), fresh.nestedChild()].every(
          (handle) => handle?.getExposes().value.get() === 11
        ),
      'fresh owner current input'
    );
    observed.fresh = {
      sameDom: host.firstChild === freshNode,
      newState: fresh.root().getExposes().value !== rootState,
      newContext: fresh.root().getExposes().contextSnapshot() !== changedContext,
      sharedContext:
        fresh.root().getExposes().contextSnapshot() ===
        fresh.child().getExposes().contextSnapshot(),
      values: [
        fresh.root().getExposes().value.get(),
        fresh.child().getExposes().value.get(),
        fresh.nestedChild().getExposes().value.get(),
      ],
      oldStateStillRetired: refused(() => rootState.get()),
      phases: [...fresh.phaseLog],
    };
    return observed;
  }
  return {
    run,
    async dispose() {
      const current = cleanup;
      cleanup = undefined;
      return current?.();
    },
  };
}
