// packages/modules/rule/src/intent-builder.ts
import type { IntentBuilder, RuleIntent, RuleOp, StateIntentBuilder } from './types';
import { assertTwTokenV0, snapshotMaterialCandidate } from '@proto.ui/core';
import type { StyleHandle, OwnedStateHandle, BorrowedStateHandle } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';

export function createIntentBuilder<Props extends PropsBaseType = PropsBaseType>() {
  const ops: RuleOp<Props>[] = [];

  const builder: IntentBuilder<Props> = {
    feedback: {
      material: {
        use(candidate) {
          ops.push({
            kind: 'feedback.material.use',
            candidate: snapshotMaterialCandidate(candidate),
          });
        },
      },
      style: {
        to: (target) => ({
          use: (...handles: StyleHandle[]) => {
            if (!target || typeof target !== 'object')
              throw new Error('[rule] invalid decoration target');
            const copied = handles.map((h) => {
              if (!h || h.kind !== 'tw' || !Array.isArray(h.tokens))
                throw new Error('[rule] unsupported style handle');
              const tokens = [...h.tokens];
              for (const token of tokens) assertTwTokenV0(token, 'rule.feedback.style.to.use');
              return { kind: 'tw' as const, tokens };
            });
            ops.push({ kind: 'feedback.style.use', target, handles: copied });
          },
        }),
        use: (...handles: StyleHandle[]) => {
          for (const handle of handles) {
            if (!handle || handle.kind !== 'tw' || !Array.isArray(handle.tokens)) {
              throw new Error('[rule] unsupported style handle in v0');
            }
            for (const token of handle.tokens) assertTwTokenV0(token, 'rule.feedback.style.use');
          }
          ops.push({ kind: 'feedback.style.use', handles });
        },
      },
    },
    state: <T>(
      handle: OwnedStateHandle<T> | BorrowedStateHandle<T, Props>
    ): StateIntentBuilder<T> => ({
      be(value: T) {
        ops.push({
          kind: 'state.set',
          handle,
          value,
        });
      },
    }),
  };

  const exportIntent = (): RuleIntent<Props> => ({ kind: 'ops', ops: ops.slice() });

  return { builder, exportIntent };
}
