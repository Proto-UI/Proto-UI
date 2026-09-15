// packages/modules/rule/src/intent-builder.ts
import type { IntentBuilder, RuleIntent, RuleOp, StateIntentBuilder } from './types';
import { assertTwTokenV0 } from '@proto.ui/core';
import type { StyleHandle, OwnedStateHandle, BorrowedStateHandle } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';

export function createIntentBuilder<Props extends PropsBaseType = PropsBaseType>() {
  const ops: RuleOp<Props>[] = [];

  const builder: IntentBuilder<Props> = {
    feedback: {
      style: {
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
