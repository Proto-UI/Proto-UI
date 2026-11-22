import { expect } from 'vitest';

type State<T> = { get(): T };
export type TransitionOracleAPI = {
  transitionState: State<string>;
  isPresent: State<boolean>;
  sameHandle: boolean;
  controls: {
    enter(): void;
    leave(): void;
    complete(): void;
    capturePreparation(): (() => void) | null;
  };
  readTrace(): string;
  interruptNext(): void;
};
export type TransitionOracleOwner = {
  api: TransitionOracleAPI;
  act<T>(action: () => T): Promise<T>;
  advance(milliseconds: number): Promise<void>;
  dispose(): Promise<void>;
};

export const transitionJourneys = [
  {
    name: 'retires a cold preparation before reopen and ignores its old release',
    async run(owner: TransitionOracleOwner) {
      const { api } = owner;
      expect(api.sameHandle).toBe(true);
      expect(api.transitionState.get()).toBe('closed');
      await owner.act(() => api.controls.enter());
      expect(api.transitionState.get()).toBe('preparing');
      expect(api.isPresent.get()).toBe(true);
      const oldRelease = await owner.act(() => api.controls.capturePreparation());
      expect(oldRelease).not.toBeNull();
      await owner.act(() => api.controls.complete());
      expect(api.transitionState.get()).toBe('preparing');
      await owner.act(() => api.controls.leave());
      expect(api.transitionState.get()).toBe('closed');
      expect(api.isPresent.get()).toBe(false);
      await owner.act(() => api.controls.enter());
      const release = await owner.act(() => api.controls.capturePreparation());
      expect(release).not.toBe(oldRelease);
      await owner.act(() => oldRelease!());
      await owner.advance(50);
      expect(api.transitionState.get()).toBe('preparing');
      await owner.act(() => release!());
      expect(api.transitionState.get()).toBe('entering');
      await owner.act(() => release!());
      await owner.advance(4);
      expect(api.transitionState.get()).toBe('entering');
      await owner.advance(1);
      expect(api.transitionState.get()).toBe('entered');
      expect(api.readTrace()).toBe('preparing,closed,preparing,entering,entered,');
    },
  },
  {
    name: 'preserves a reentrant leave and does not arm the obsolete enter completion',
    async run(owner: TransitionOracleOwner) {
      const { api } = owner;
      await owner.act(() => api.interruptNext());
      await owner.act(() => api.controls.enter());
      const release = await owner.act(() => api.controls.capturePreparation());
      await owner.act(() => release!());
      expect(api.transitionState.get()).toBe('leaving');
      expect(api.isPresent.get()).toBe(true);
      await owner.advance(5);
      expect(api.transitionState.get()).toBe('leaving');
      await owner.advance(2);
      expect(api.transitionState.get()).toBe('closed');
      expect(api.isPresent.get()).toBe(false);
      expect(api.readTrace()).toBe('preparing,entering,leaving,closed,');
    },
  },
  {
    name: 'retires scheduled completion and public capabilities on terminal disposal',
    async run(owner: TransitionOracleOwner) {
      const { api } = owner;
      await owner.act(() => api.controls.enter());
      const release = await owner.act(() => api.controls.capturePreparation());
      await owner.act(() => release!());
      expect(api.transitionState.get()).toBe('entering');
      await owner.dispose();
      await owner.advance(50);
      expect(() => api.transitionState.get()).toThrow(/dispos|alive|terminal/i);
      expect(() => api.controls.enter()).toThrow(/dispos|alive|terminal/i);
    },
  },
];
