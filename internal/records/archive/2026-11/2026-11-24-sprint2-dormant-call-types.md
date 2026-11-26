# Sprint 2: dormant callable argument contradictions

## Integration finding

The full integration Compiler run found that an existing ControlLabel language counterexample had begun passing source admission:

```ts
const apply = (current: (...values: boolean[]) => boolean) => current([true]);
```

The ordinary reached-call checker already rejects the array argument. The change in outcome came from the combined dormant-body admission and newly supported rest callable signatures: this unused helper's signature was checked, but its body was wholly deferred. Removing the counterexample or turning the array into a Boolean would erase the original question.

## Bounded repair

The dormant declaration check now recognizes a type contradiction whose complete evidence is local: an unshadowed, explicitly typed callable parameter, a direct invocation, and entirely scalar/array literal arguments. It uses the shared ordinary callable argument check and reports only its concrete argument-type mismatch. It creates no executable IR, grants no capability and imposes no host grammar on an otherwise dormant body.

Unknown argument expressions, nested functions and conservatively detected lexical shadows remain deferred. The implementation does not claim general TypeScript body checking, rewrite original annotations or alter the separate historical IR10 input.

## Evidence

A 768 MB standalone probe restored the original `PUI1006: Callable argument 1 type mismatch.` result. Legal scalar and literal-spread calls still admit. A dormant host-global reference beside a legal call remains deferred, and nested or block-shadowed callable names do not produce false positives. A renamed ordinary Number callback with a String literal also reports the same concrete mismatch, demonstrating that this is not a Boolean-rest name special case. A legal host-containing control survives cold JSON IR validation.

Seven added dormant-source regression cases preserve those boundaries. The coordinated run passed **37/37 dormant-source cases and 73/73 ControlLabel lowering cases**, including the unchanged original array-argument counterexample. The bounded TypeScript check over all changed source and related test roots reported **0 diagnostics**. This remains a focused receipt rather than a full Compiler or historical-source acceptance claim.

The combined validation for this slice, checked NonNullable, Context snapshot order and mutable-array String conversion ran in two processes with `NODE_OPTIONS=--max-old-space-size=3072`, one worker and no file parallelism. The six files passed **229/229** cases with no failures or skips. Splitting the run avoided claiming that the earlier root whole-suite process, which was killed, had completed.
