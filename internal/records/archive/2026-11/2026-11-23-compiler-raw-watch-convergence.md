# Generated native raw Props convergence

This repair follows the full compiler regression review of PR #1731 at `35a2769d718e7764c1654b88394f3e005d1e5315`. The previous raw-watcher test blanket-rejected Vue, Web Component and GPUI compilation. That assertion failed both on this candidate and on its main baseline `2479acecddf8f9801cdbee0c538ca08d7e79c9d4`: one test passed and one failed in each control. This was a stale admission expectation, not proof that the admitted native implementations satisfied the raw Props contract.

## Authority and repairs

Active `C-PROPS-0012-C/G/H/K/L` defines the callback snapshot, hydration skip, union-key `Object.is` diff, observer order and escape-hatch diagnostic. The replacement tests execute actual emitted React, Vue and Web Component owners through ordinary framework imports.

- Vue and Web Component no longer treat absent versus explicitly undefined as a raw-value change. Host snapshot/presence updates remain intact.
- Vue reuses the callback window's raw snapshot, so `run.props.getRaw()` and the callback's `next` argument have the same identity.
- Web Component dispatches raw-all, keyed raw, then resolved observers while retaining registration order and live cancellation within each group.
- Vue and Web Component produce the specific raw escape-hatch warning. An unrelated framework warning cannot satisfy this assertion.
- A Web Component raw event may synchronously dispose the owner. Each remaining observer now checks the terminal boundary before invocation, with the props window restored in `finally`, including when a warning throws.

The GPUI scalar `String(array)` subset diagnostic remains separate from raw registration admission. Empty-key rejection has an otherwise identical positive control. Vue2 raw observation remains explicitly deferred.

## Evidence

The new owner traces first reproduced the Vue/Web Component diff, identity, order and warning failures. Independent review then reproduced a raw event that synchronously disposed its Web Component owner: the subsequent resolved callback incorrectly threw `Logical owner is disposed`. The unchanged terminal trace passes with the guard: only the raw event runs, `setProps` has no trailing callback error, and a previously captured public method remains terminal.

The final focused run passed **50/50** across raw-watcher consumers, raw-member checks and checked cleanup-callable parsing. The consumer file contains **18** cases. Independent nested-update probing also observed the expected outer/inner callback windows and raw snapshot identity after returning from the nested update. `T-PROPS-0008` links the executed DOM consumer evidence.

An attempted complete compiler run in the constrained local executor was killed with SIGKILL before completion. It is an incomplete resource observation, not a passing full-suite result; final complete-suite evidence is recorded separately.

## Deliberately unresolved phase question

`C-CORE-SYNTAX-0007` and `D-AS-HOOK-DISPOSER-PHASE-0001` retain a draft direction for setup-only removal functions. Existing Props module and target implementations differ. This repair preserves React's current raw-cleanup phase guard and does not promote runtime cleanup semantics based on implementation majority. The new shared DOM traces cancel during setup; only React's existing runtime rejection is asserted. No prototype, compiler or module phase contract is silently redefined by this regression repair.
