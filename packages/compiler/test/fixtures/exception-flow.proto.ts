import { createContextKey, definePrototype } from '@proto.ui/core';

const Signal = createContextKey<{ value: number }>('exception-flow.signal');

export default definePrototype({
  name: 'generic-exception-flow',
  setup(def) {
    let trace = '';
    const original = { code: 'EXPECTED', detail: { value: 3 } };
    const list = [1, 2];
    const fail = () => {
      trace += 'body;';
      throw original;
    };

    def.context.provide(Signal, { value: 0 });
    def.context.subscribe(Signal, (_run, next) => {
      if (next.value === 1) throw 0;
      if (next.value === 2) throw false;
      if (next.value === 3) throw null;
      if (next.value === 4) throw undefined;
    });
    def.context.subscribe(Signal, () => {
      trace += 'later;';
    });
    def.context.subscribe(Signal, (_run, next) => {
      if (next.value === 1) throw 'secondary';
    });

    def.expose.method('resetTrace', () => {
      trace = '';
    });
    def.expose.method('readTrace', () => trace);
    def.expose.method('falsy', (tag: number) => {
      try {
        if (tag === 0) throw 0;
        if (tag === 1) throw false;
        if (tag === 2) throw null;
        if (tag === 3) throw undefined;
        throw '';
      } catch (error) {
        if (tag === 0) return error === 0;
        if (tag === 1) return error === false;
        if (tag === 2) return error === null;
        if (tag === 3) return error === undefined;
        return error === '';
      }
    });
    def.expose.method('sameRecord', () => {
      try {
        fail();
      } catch (error) {
        return error === original;
      }
      return false;
    });
    def.expose.method('uncaughtFalsy', (tag: number) => {
      try {
        if (tag === 0) throw 0;
        if (tag === 1) throw false;
        if (tag === 2) throw null;
        if (tag === 3) throw undefined;
        throw '';
      } finally {
        trace += 'unhandled-final;';
      }
    });
    def.expose.method('sameArray', () => {
      try {
        throw list;
      } catch (error) {
        // The original array is thrown; this view must not grant IR data authority.
        const values = error as readonly number[];
        return error === list && values.length === 2 && values[0] === 1;
      }
    });
    def.expose.method('codeDiscrimination', () => {
      try {
        try {
          throw original;
        } catch (first) {
          // Compatibility control: the compiler must keep this caught view opaque.
          const projected = first as { code?: string };
          if (projected?.code === 'OTHER') return false;
          throw first;
        }
      } catch (second) {
        // The unchanged record reaches this catch after the nonmatching branch.
        const diagnostic = second as { code?: string };
        return second === original && diagnostic.code === 'EXPECTED';
      }
    });
    def.expose.method('rethrowRecord', () => {
      try {
        try {
          fail();
        } catch (first) {
          trace += 'inner;';
          throw first;
        } finally {
          trace += 'inner-final;';
        }
      } catch (second) {
        trace += 'outer;';
        return second === original;
      } finally {
        trace += 'outer-final;';
      }
      return false;
    });
    def.expose.method('returnAfterCleanup', () => {
      try {
        trace += 'try;';
        return 'before';
      } finally {
        trace += 'finally;';
      }
    });
    def.expose.method('returnTraceBeforeFinally', () => {
      try {
        return trace;
      } finally {
        trace += 'after;';
      }
    });
    def.expose.method('finalReturn', () => {
      try {
        trace += 'try;';
        throw original;
      } finally {
        trace += 'finally;';
        return 'override';
      }
    });
    def.expose.method('finalThrow', () => {
      try {
        try {
          return 'discarded';
        } finally {
          throw false;
        }
      } catch (error) {
        return error === false;
      }
    });
    def.expose.method('replaceThrow', () => {
      try {
        try {
          throw original;
        } finally {
          throw undefined;
        }
      } catch (error) {
        return error === undefined;
      }
    });
    def.expose.method('caughtScope', () => {
      try {
        throw original;
      } catch (error) {
        // Capture the original caught value through an erased source view.
        const captured = error as { code?: string };
        const readCaught = () => captured.code === 'EXPECTED';
        return readCaught();
      }
    });
    def.expose.method('propertyError', () => {
      try {
        try {
          throw null;
        } catch (first) {
          // Deliberate fault: reading a property of the caught null must throw.
          const nullish = first as { code?: string };
          const value = nullish.code;
          return value === 'unreachable';
        }
      } catch (second) {
        // Both native JavaScript and the GPUI property operation produce TypeError.
        const diagnostic = second as { name?: string };
        return diagnostic.name === 'TypeError';
      }
    });
    def.expose.method('stringUnits', () => {
      try {
        throw '😀a';
      } catch (error) {
        // The view stays opaque in IR; native reads must retain UTF-16 code units.
        const text = error as string;
        return text.length === 3 && text[0] === text[0] && text[0] !== text[1] && text[2] === 'a';
      }
    });
    def.expose.method('bareCatch', () => {
      try {
        throw false;
      } catch {
        trace += 'catch;';
        return true;
      } finally {
        trace += 'finally;';
      }
    });
    return (renderer) => renderer.el('output', 'exceptions');
  },
});

export const FinallyRenderer = definePrototype({
  name: 'generic-finally-renderer',
  setup() {
    return (renderer) => {
      try {
        return renderer.el('p', 'discarded');
      } finally {
        return renderer.el('output', 'visible');
      }
    };
  },
});
