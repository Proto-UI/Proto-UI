import { capUnavailable, illegalPhase, type Phase, type ViewOperation } from '@proto.ui/core';

export function createViewOperations(args: { prototypeName: string; getPhase(): Phase }) {
  let capture: (() => ViewOperation | null) | undefined;
  return {
    setCapture(source: () => ViewOperation | null) {
      capture = source;
    },
    capture(): ViewOperation | null {
      const phase = args.getPhase();
      if (phase !== 'callback') {
        throw illegalPhase('run.lifecycle.captureViewOperation', phase, {
          prototypeName: args.prototypeName,
        });
      }
      if (!capture) throw capUnavailable('lifecycle.view-operation');
      return capture();
    },
  };
}
