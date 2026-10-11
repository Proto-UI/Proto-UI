# Calendar navigation loader closure, 2026-10-10

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## Observed failure and scope

The official representative-feature run [38054606588](https://github.com/Proto-UI/Proto-UI/actions/runs/38054606588) on published `fabf2d2b2e971060243e3843df7dde91d27e4440` reported Calendar not reaching readiness because the previewer could not load `lucide-chevron-left-icon`. The owner supplied that exact failure; no successful Calendar screenshot is claimed here.

The current five-family Calendar demo declares both `lucide-chevron-left-icon` and `lucide-chevron-right-icon`. Their real Lucide prototypes and public names already exist, but the website's manual prototype loader registry listed only the down chevron. The earlier Dropdown recipe closure repair did not cover these two navigation dependencies.

This bounded source repair adds only two static import/registration entries in `prototype-modules.ts`, pointing to the existing left/right Lucide exports. It changes no Prototype definition, event/state owner, Compiler, CLI interpretation, icon generator, or host capability.

## Executed regression and fixture correction

On the combined pre-repair tree `c6e8c65dd71df8339972b06a3c52e5c80a250bab`, the existing `finf-registration.test.ts` Calendar filter failed all five family cases with the same missing-left-loader error. The original 80-file combined run had already completed: 1,015 tests, 1,007 passed and eight retained Form/CheckboxGroup selector failures. That result remains bound to the pre-repair tree.

After the two loader entries, the five Calendar closure cases and two added tests verifying registry object identity against the actual Lucide exports pass. The full registration suite initially reported 142 passed and five failed. Those five failures were a separate test-fixture assumption: CLI entries named `*-dropdown-composition` or `*-dropdown` do not imply an identically named demo. The existing integration manifest already maps their package subpaths to the real `*-dropdown-menu` recipes.

The test now consumes that existing manifest relation and verifies the loaded demo's exact source path. It introduces no second hand-maintained ID table, aliases, fake demos, or skipped cases. All original per-demo dependency and per-atom real-loader assertions remain. This fixture correction is not a product behavior repair. Both initial failures remain in the external integration evidence packet.

The full registration suite passes 147 tests after that correction. The final combined tree will receive a fresh union regression and official type/resource checks; their exact tree, commands, logs and outcomes belong in the integration handoff rather than being inferred from these focused results.

## Remaining evidence

This is a website static-loader closure repair, not complete Calendar acceptance. Browser readiness and the same-state Calendar screenshots still need a new actual published source run. Existing selector coverage, visual fidelity, native/Compiler composition and other original delivery gates remain open. No delivery checkbox, lifecycle state or 5-done/63-doing score is changed.
