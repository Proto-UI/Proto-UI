import type { ContextKey, JsonObject } from '@proto.ui/types';
import { defineAsHook, delay, type RunHandle } from '@proto.ui/core';
import { createTransitionMachine, type TransitionMachineDriver } from './machine';
import type {
  TransitionAsHookContract,
  TransitionConfig,
  TransitionControls,
  TransitionExposes,
  TransitionHandles,
  TransitionInterrupt,
  TransitionInitialOpenBinding,
  TransitionProps,
  TransitionState,
} from './types';

function requireProjectedHandle<T>(value: T | undefined, name: string): T {
  if (typeof value === 'undefined') {
    throw new Error(`[asTransition] missing captured handle: ${name}.`);
  }
  return value;
}

/**
 * Installs perceptual transition governance once per prototype setup chain.
 * Repeated calls return the exact same projected handle object.
 */
export const asTransition = defineAsHook<
  TransitionProps,
  TransitionExposes,
  TransitionAsHookContract,
  TransitionHandles
>({
  name: 'asTransition',
  setup(def) {
    def.props.define({
      open: { type: 'boolean', empty: 'fallback' },
      defaultOpen: { type: 'boolean', empty: 'fallback' },
      appear: { type: 'boolean', empty: 'fallback' },
      enterDuration: { type: 'number', empty: 'fallback' },
      leaveDuration: { type: 'number', empty: 'fallback' },
      interrupt: {
        type: 'enum',
        empty: 'fallback',
        options: ['reverse', 'wait', 'immediate'],
      },
    });
    def.props.setDefaults({
      defaultOpen: false,
      appear: false,
      enterDuration: 300,
      leaveDuration: 200,
      interrupt: 'reverse',
    });

    def.expose.event('beforeEnter', { payload: 'void' });
    def.expose.event('afterEnter', { payload: 'void' });
    def.expose.event('beforeLeave', { payload: 'void' });
    def.expose.event('afterLeave', { payload: 'void' });

    const transitionState = def.state.enum<['closed', 'entering', 'entered', 'leaving']>(
      'transitionState',
      'closed',
      { options: ['closed', 'entering', 'entered', 'leaving'] }
    );
    const isPresent = def.state.bool('isPresent', false);
    const appearDefault = def.state.bool('transitionAppearDefault', false);
    const enterDurationDefault = def.state.numberDiscrete('transitionEnterDurationDefault', 300);
    const leaveDurationDefault = def.state.numberDiscrete('transitionLeaveDurationDefault', 200);
    const interruptDefault = def.state.enum<['reverse', 'wait', 'immediate']>(
      'transitionInterruptDefault',
      'reverse',
      { options: ['reverse', 'wait', 'immediate'] }
    );

    let initialOpenSource: Readonly<{ context: ContextKey<JsonObject>; field: string }> | null =
      null;
    const bindInitialOpen: TransitionInitialOpenBinding = (source) => {
      // Match configure's setup-only default guard, before even an idempotent return.
      appearDefault.setDefault(appearDefault.get());
      if (
        !source ||
        typeof source.field !== 'string' ||
        !source.field ||
        !source.context ||
        source.context.__brand !== 'ContextKey'
      ) {
        throw new Error(
          '[asTransition] initial open source requires a ContextKey and direct field.'
        );
      }
      if (initialOpenSource) {
        if (
          initialOpenSource.context === source.context &&
          initialOpenSource.field === source.field
        )
          return;
        throw new Error('[asTransition] initial open source is already bound.');
      }
      initialOpenSource = Object.freeze({ context: source.context, field: source.field });
    };
    def.expose.method('bindInitialOpen', bindInitialOpen);

    let currentRun: RunHandle<TransitionProps> | null = null;
    const getProps = () => currentRun?.props.get();

    const driver: TransitionMachineDriver = {
      getState: () => transitionState.get(),
      setState(state: TransitionState) {
        transitionState.set(state, `reason: asTransition => ${state}`);
        isPresent.set(state !== 'closed', `reason: asTransition presence => ${state}`);
      },
      getInterrupt: () =>
        currentRun?.props.isProvided('interrupt')
          ? ((getProps()?.interrupt as TransitionInterrupt | undefined) ?? interruptDefault.get())
          : interruptDefault.get(),
      getDuration: (state) => {
        // A zero-duration fallback preserves phase/event scheduling while removing
        // non-essential sustained motion waits for reduced-motion users.
        // P-BASE-TRANSITION-REDUCED-MOTION
        if (currentRun?.meta?.get('reducedMotion') === 'reduce') return 0;
        return state === 'entering'
          ? currentRun?.props.isProvided('enterDuration')
            ? (getProps()?.enterDuration ?? enterDurationDefault.get())
            : enterDurationDefault.get()
          : currentRun?.props.isProvided('leaveDuration')
            ? (getProps()?.leaveDuration ?? leaveDurationDefault.get())
            : leaveDurationDefault.get();
      },
      schedule: (durationMs, callback) => delay(durationMs, callback),
      setViewPresent(present) {
        if (!currentRun) {
          throw new Error('[asTransition] runtime lifecycle handle is not available.');
        }
        currentRun.lifecycle.setPresent(present);
      },
      emit(event) {
        currentRun?.expose.emit(event);
      },
    };
    const machine = createTransitionMachine(driver);

    const controls: TransitionControls = {
      enter: () => machine.enter(),
      leave: () => machine.leave(),
      complete: () => machine.complete(),
    };

    def.lifecycle.onCreated((run) => {
      currentRun = run;
      const props = run.props.get();
      const controlled = run.props.isProvided('open');
      let open = controlled ? !!props.open : !!props.defaultOpen;
      if (!controlled && !run.props.isProvided('defaultOpen') && initialOpenSource) {
        const value = run.context.read(initialOpenSource.context);
        const initialOpen = value[initialOpenSource.field];
        if (!Object.hasOwn(value, initialOpenSource.field) || typeof initialOpen !== 'boolean') {
          throw new Error('[asTransition] initial open context field must be a required boolean.');
        }
        open = initialOpen;
      }
      const appear = run.props.isProvided('appear') ? !!props.appear : appearDefault.get();
      machine.initialize(open, appear);
    });

    def.lifecycle.onMounted((run) => {
      currentRun = run;
      machine.mounted();
    });

    def.lifecycle.onUnmounted((run) => {
      currentRun = run;
      machine.unmounted();
    });

    def.lifecycle.onBeforeDispose(() => {
      machine.dispose();
      currentRun = null;
    });

    def.props.watch(['open', 'interrupt', 'enterDuration', 'leaveDuration'], (run, next) => {
      currentRun = run;
      if (!run.props.isProvided('open')) return;
      machine.setTarget(!!next.open);
    });

    def.expose.state('transitionState', transitionState);
    def.expose.state('isPresent', isPresent);
    def.expose.method('enter', controls.enter);
    def.expose.method('leave', controls.leave);
    def.expose.method('complete', controls.complete);
    def.expose.value('controls', controls);
  },
  projectHandle(result) {
    const transitionState = requireProjectedHandle(
      result.getState?.('transitionState'),
      'transitionState'
    );
    const isPresent = requireProjectedHandle(result.getState?.('isPresent'), 'isPresent');
    const controls: TransitionControls = {
      enter: requireProjectedHandle(
        result.getMethod?.('enter') as (() => void) | undefined,
        'enter'
      ),
      leave: requireProjectedHandle(
        result.getMethod?.('leave') as (() => void) | undefined,
        'leave'
      ),
      complete: requireProjectedHandle(
        result.getMethod?.('complete') as (() => void) | undefined,
        'complete'
      ),
    };

    const appearDefault = requireProjectedHandle(
      result.getState?.('transitionAppearDefault'),
      'transitionAppearDefault'
    );
    const enterDurationDefault = requireProjectedHandle(
      result.getState?.('transitionEnterDurationDefault'),
      'transitionEnterDurationDefault'
    );
    const leaveDurationDefault = requireProjectedHandle(
      result.getState?.('transitionLeaveDurationDefault'),
      'transitionLeaveDurationDefault'
    );
    const interruptDefault = requireProjectedHandle(
      result.getState?.('transitionInterruptDefault'),
      'transitionInterruptDefault'
    );

    const configure = (config: TransitionConfig) => {
      let configured = false;
      if (typeof config.appear !== 'undefined') {
        appearDefault.setDefault(config.appear);
        configured = true;
      }
      if (typeof config.enterDuration !== 'undefined') {
        if (!Number.isFinite(config.enterDuration) || config.enterDuration < 0) {
          throw new Error('[asTransition] enterDuration must be a finite non-negative number.');
        }
        enterDurationDefault.setDefault(config.enterDuration);
        configured = true;
      }
      if (typeof config.leaveDuration !== 'undefined') {
        if (!Number.isFinite(config.leaveDuration) || config.leaveDuration < 0) {
          throw new Error('[asTransition] leaveDuration must be a finite non-negative number.');
        }
        leaveDurationDefault.setDefault(config.leaveDuration);
        configured = true;
      }
      if (typeof config.interrupt !== 'undefined') {
        interruptDefault.setDefault(config.interrupt);
        configured = true;
      }
      // Keep even an empty call setup-only.
      if (!configured) appearDefault.setDefault(appearDefault.get());
    };

    const bindInitialOpen = requireProjectedHandle(
      result.getMethod?.('bindInitialOpen') as TransitionInitialOpenBinding | undefined,
      'bindInitialOpen'
    );
    return { transitionState, isPresent, controls, configure, bindInitialOpen };
  },
});
