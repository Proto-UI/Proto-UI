import type { ContextKey, JsonObject } from '@proto.ui/types';
import {
  defineAsHook,
  delay,
  snapshotPresentationCompletionConfig,
  type PresentationCompletionConfig,
  type PresentationOwnerRef,
  type RunHandle,
} from '@proto.ui/core';
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

    const transitionState = def.state.enum<
      ['closed', 'preparing', 'entering', 'entered', 'leaving']
    >('transitionState', 'closed', {
      options: ['closed', 'preparing', 'entering', 'entered', 'leaving'],
    });
    const isPresent = def.state.bool('isPresent', false);
    const appearDefault = def.state.bool('transitionAppearDefault', false);
    const coldEntryPreparation = def.state.bool('transitionColdEntryPreparation', false);
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

    const presentation = def.feedback.presence.owner();
    let completion: PresentationCompletionConfig = 'timer';
    def.expose.method('getPresentationOwner', () => presentation.ref);
    def.expose.method('configurePresentation', (config: TransitionConfig) => {
      appearDefault.setDefault(appearDefault.get());
      const policy = snapshotPresentationCompletionConfig(config.completion ?? completion);
      const enter = config.enterDuration ?? enterDurationDefault.get();
      const leave = config.leaveDuration ?? leaveDurationDefault.get();
      if (![enter, leave].every((value) => Number.isFinite(value) && value >= 0))
        throw new Error('[asTransition] durations must be finite non-negative numbers.');
      if (policy !== 'timer' && (enter >= policy.timeoutMs || leave >= policy.timeoutMs))
        throw new Error('[asTransition] presentation duration must be shorter than timeoutMs.');
      completion = policy;
    });
    let currentRun: RunHandle<TransitionProps> | null = null;
    const getProps = () => currentRun?.props.get();

    const driver: TransitionMachineDriver = {
      getState: () => transitionState.get(),
      setState(state: TransitionState) {
        transitionState.set(state, `reason: asTransition => ${state}`);
        // A synchronous State watcher may dispose this owner before projection resumes.
        if (!currentRun) return;
        // State watchers may synchronously drive another transition. Project its final phase.
        const currentState = transitionState.get();
        isPresent.set(
          currentState !== 'closed',
          `reason: asTransition presence => ${currentState}`
        );
      },
      requiresColdPreparation: () => coldEntryPreparation.get(),
      getCompletion: () => completion,
      publishPresentation: (frame) =>
        currentRun?.feedback.presence.publish(presentation.writer, {
          ...frame,
          owner: presentation.ref,
        }),
      settlePresentation: (outcome) =>
        currentRun?.feedback.presence.settle(presentation.writer, outcome),
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
    presentation.onCompletionRequest((run, request) => {
      if (!currentRun) return;
      if (!run.feedback.presence.isCurrent(presentation.writer, request.receipt)) return;
      machine.completePresentation(
        request.receipt.attempt,
        () => !!currentRun && run.feedback.presence.isCurrent(presentation.writer, request.receipt)
      );
    });

    const controls: TransitionControls = {
      enter: () => machine.enter(),
      leave: () => machine.leave(),
      complete: () => machine.complete(),
      capturePreparation: () => {
        if (!currentRun)
          throw new Error('[asTransition] preparation capture requires a live runtime.');
        return machine.capturePreparation();
      },
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
    def.expose.method('capturePreparation', controls.capturePreparation);
    def.expose.value('controls', controls);
  },
  projectHandle(result) {
    const transitionState = requireProjectedHandle(
      result.getState?.('transitionState'),
      'transitionState'
    );
    const isPresent = requireProjectedHandle(result.getState?.('isPresent'), 'isPresent');
    const controls: TransitionControls = {
      capturePreparation: requireProjectedHandle(
        result.getMethod?.('capturePreparation') as (() => (() => void) | null) | undefined,
        'capturePreparation'
      ),
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

    const coldEntryPreparation = requireProjectedHandle(
      result.getState?.('transitionColdEntryPreparation'),
      'transitionColdEntryPreparation'
    );

    const configurePresentation = requireProjectedHandle(
      result.getMethod?.('configurePresentation') as
        | ((config: TransitionConfig) => void)
        | undefined,
      'configurePresentation'
    );
    const getPresentationOwner = requireProjectedHandle(
      result.getMethod?.('getPresentationOwner') as (() => PresentationOwnerRef) | undefined,
      'getPresentationOwner'
    );
    const configure = (config: TransitionConfig) => {
      // Validate the whole prospective policy before installing any defaults.
      configurePresentation(config);
      let configured = false;
      if (typeof config.coldEntryPreparation !== 'undefined') {
        coldEntryPreparation.setDefault(config.coldEntryPreparation);
        configured = true;
      }
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
    return {
      transitionState,
      isPresent,
      controls,
      configure,
      bindInitialOpen,
      presentationOwner: getPresentationOwner(),
    };
  },
});
