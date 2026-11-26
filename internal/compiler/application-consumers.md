# Application scenarios for the new compiler

This is an implementation planning projection of
[C-COMPILER-FOUNDATION-0001](../../spec/contracts/C-COMPILER-FOUNDATION-0001.yaml).
It identifies useful application behavior, not current adoption or passing
evidence. Existing producer scripts, generated artifacts and tests are not
correctness or compatibility oracles for the new compiler.

| Consumer | Useful independent scenarios | Target |
| --- | --- | --- |
| [Shenko](https://github.com/cyjin-yl/shenko) | Status props update rendered text and appearance; controlled selections remain requests until their owner accepts; conversation children retain identity; nested Context follows logical ancestry; owned tasks cannot update retired views. | React |
| [Verdant](https://github.com/OpenGreendam/verdant) | Typed state, continuous gesture previews, final commits and native text/selection/scroll; cleanup ends stale input and tasks. | GPUI |

Verdant’s typed pressed/selected state drives appearance without another interaction owner. Continuous gesture previews and final commits preserve their declared action boundaries. Text, selection and scroll remain native host operations; cleanup ends stale input and async work.

## Migration and retained targets

Start from the behavior the application needs and independent component
definitions. Migrate its relevant `.proto.ts` declarations and callbacks into
the new language, then compile and execute an ordinary application consumer.
Track unsupported language or backend work directly; do not rewrite application
behavior merely to fit a compiler special case.

The foundation PR performs no application pin update or author-API migration.
It removes obsolete compiler-specific producer instructions and inventories.
Their historical content remains in
[the preceding repository revision](https://github.com/Proto-UI/Proto-UI/tree/67fd94f58372cf35fa929f24ef731416b5817e31/internal/compiler),
without asserting that those instructions still work or constrain the new
implementation. Vue 2, Vue 3 and Web Components remain required final targets
even though these two applications motivate the first delivery paths.
