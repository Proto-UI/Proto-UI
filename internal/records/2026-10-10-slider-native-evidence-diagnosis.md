# Slider official native failure diagnosis

Source commit: `2a67cb6173020c487591724538ca56e03f14a1ea`. Source tree: `af287fdbda0bc5ab21e7a0ed59f328e51f5d7e86`. Official run38069021246 / job114262450492 / artifact11676448517. Original archive SHA256: `cafd03c1ff05f07f7ab66f99edb5b0d8ebb7017bfda127ac667ef211c93362c8`. Official evidence: the run/job artifact `finf-features-slider-2a67cb6173020c487591724538ca56e03f14a1ea-38069021246-1` contains14 SHA-checked PNGs and terminal JSON. The job console retains the four failing assertions. Original results remain4/4 failed. No native browser was launched for this local diagnosis; only current authorized project source and installed locked dependencies were executed in isolated tests.

## 1. React/Vue2 pointer facts are lost while paint commit is pending

Official failures: React line155 waits for hovered after its first successful corner; Vue2 line157 waits for pressed before any corner is recorded. Their1-second polling timeouts identify missing facts, not a reason to increase the timeout.

Deterministic local real-framework control (reproducer below; raw logs remain in the source-bound review packet):8 tests,6 pass/2 fail. For both React and Vue2, pure Base hover→pointerdown passes. Shadcn hover→pointerdown before the framework acknowledges the paint commit fails at pressed; the same Shadcn sequence after an actual framework commit acknowledgement passes. The initial4-case probe and2red/2green log are also retained. Waiting for acknowledgement here is a diagnostic positive control only, not a proposed change to the official test or an acceptable user-input workaround.

Source chain:

- `packages/prototypes/shadcn/src/slider/paint.ts`: borrowed hovered/pressed/focus state watch explicitly calls ordinary `run.update()` to render the passive paint.
- `packages/adapters/react/src/runtime/session.ts` and `packages/adapters/vue2/src/runtime/session.ts`: every commit immediately calls `eventGate.disable()` before delegating to the framework.
- `packages/adapters/base/src/events/web-event-router.ts`: pointerenter/down handlers return immediately when the gate is disabled.
- React `adapt.ts` layout acknowledgement and Vue2 `finishPendingCommit()` subsequently reenable the gate.
- Track AxisInput uses its own existing native Move lease, while Thumb's semantic pointerOrigin depends on that gated router; this admits a Root/Track session while the Thumb pointer fact was dropped.

Ownership: shared Adapter/Event/lifecycle definition and realization, not a Slider business-rule exception. `C-LIFECYCLE-0002/0003` are draft, not stable guarantees; they distinguish requested update from host commit completion; a changed State attribute is not proof of framework commit readiness. The older adapter-react v0 prose uses CP8 for event disable, while the canonical lifecycle now uses structured events and CP8 is an outdated compatibility label. Ordinary-update input continuity requires owner review against the current definitions. There is no established public passive-child state style channel avoiding structural commit in this implementation. Do not invent delayed/resent pointer input, another input owner, or prototype DOM listeners. Local tests establish this loss window; official pointer event traces were not captured, so they do not prove the complete causal timing of every individual CI failure.

## 2. Forced-colors reveals a real28px root contour

Official WC/Vue fail at line189 after `forcedColors: active`: expected root outline style none, got solid. The whole-page failed screenshots actually show square contours on every28px hit owner, including disabled/readOnly/RTL controls, plus the focused12px paint contour. This is a visible bug, not solely a too-strict style-string assertion. Ordinary-light focus receipts show the root has2px solid transparent, which cannot establish its forced-colors visibility.

Source: `packages/cli/src/services/proto-style-css.ts:213` lowers `outline-none` to2px solid transparent and2px offset. Shadcn Thumb/FieldThumb currently author that token on the28px input root. Forced colors can remap the transparent color to a visible system color. The12px paint independently consumes `forced-colors-focus-outline` only with focusVisible.

Ownership: generic portable style/host-surface semantics. No existing public true-outline-style-none/zero token was found in the current generic token renderer. The split-host projector has a special root-boundary suppression, but Slider's ordinary Template must not claim that split machinery or introduce another owner merely to use it. Removing the token alone could reinstate a UA focus contour on the28px owner; weakening the test to permit any solid outline would hide the screenshot defect. A bounded shared style definition/implementation needs to express suppression at the non-painted focus boundary while retaining the actual12px visible high-contrast focus affordance. No Compiler/CLI change or handwritten Web CSS was made here.

## 3. Passive rail translates twice in framework light DOM

Official rects: Track y378.5,height12. WC rail y382.5,height4 (centered); React/Vue/Vue2 rail y380.5,height4 (2px upward offset). This must not be reported as equal geometry merely because all heights equal4.

Source: framework `template.ts` emits the same Proto author tokens both in class/className and data-pui-style. Tailwind4.2.2 in the existing docs lowers `-translate-y-1/2` to the independent CSS `translate` property. Proto lowers it to `transform: translate(...)`. These are separate composing CSS properties, so both apply to the same4px passive child, producing an extra -2px. The WC shadow carrier is isolated from document Tailwind utilities. The source-bound review packet retains both compiler outputs; the independent reviewer separately reproduced the same result using the same already-installed versions.

Ownership: generic Template style carrier/Adapter host-style projection. Original prototype tokens are legal. Replacing a particular Slider transform with an unrelated offset just to escape this bug would not close the shared realization gap. Do not modify Compiler/CLI or take over the existing shared projection work without explicit assignment.

## 4. Field Context page errors remain unlocalized

All four official terminal receipts also contain `[Context] provider missing for key: base-field`: WC once; React/Vue/Vue2 twice. These errors are additional failures, even though an earlier assertion prevented the final errors===[] check. The current capture stores only String(error), with no stack, URL or stage, so the artifact does not show whether they occur during mount, initial preview replacement, runtime switching, input, or final teardown.

The independent reviewer reports bare real Demo and RuntimePreviewSurface controls passing across all four runtimes without an unhandled error, and similar native errors on the Forms page. Those controls rule out a simple universal fixture mount failure but do not localize the real native path. Do not classify it as known Form debt or weaken required Context reads based on these strings. Next exact-source official evidence should preserve String(error) and additionally record error.stack, page URL and current test stage. Raw failures must remain unskipped and the existing errors assertion must stay strict.

The three shared mechanisms above predate this Slider change. The new passive paint and separate hit owner expose them as real Slider regressions; describing their shared ownership does not dismiss the failures as harmless historical debt.

## Scope and next step

The only proposed executable change is richer official Slider error receipts: preserve the original error strings and all strict assertions, add stack/name/message, requested journey runtime, synchronous runtime transition phase, URL, current stage, last interaction, receipt timestamp and error order. The transition phase distinguishes initial WC loading from switching/ready states; it is not an asynchronous claim about actual mounted ownership. No component, Adapter, Compiler or CLI behavior is repaired by that diagnostic change. No timeout extension or successful-native claim is made. Keep geometry expansion (inferred26px upstream hit and4px control, edge alignment, multi-thumb) in its separately scoped definitions. The Base expansion owner owns Base Slider paths; this diagnosis does not overwrite them.

Shared owners should receive the three independently bounded implementation/definition gaps above. Field needs richer exact-source native diagnostic capture before selecting a repair owner. The same original independent reviewer is reviewing these findings.

## Reproduce the commit-window red/green control

At the exact source commit above, save the following under `packages/adapters/react/test/slider-framework-corner.probe.test.ts` and explicitly run that one file with the repository Node24/pnpm10.32.1 Vitest command. It intentionally fails two pending-commit cases while six controls pass. This is a diagnostic fixture, not a skipped acceptance test or a suggested application workaround. Remove the temporary file after inspection; the formal repository suite is not silently changed to treat the failure as success. No browser or third-party source outside existing locked dependencies is needed.

```ts
import { afterEach, expect, it } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createReactAdapter } from '@proto.ui/adapter-react';
import { createVue2Adapter } from '@proto.ui/adapter-vue2';
import { Vue2Any, Vue2RuntimeAny, flushVue2 } from '../../vue2/test/utils/vue2';
import * as base from '../../../prototypes/base/src/slider';
import * as shadcn from '../../../prototypes/shadcn/src/slider';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let clean: (() => Promise<void>) | undefined;
afterEach(async () => {
  await clean?.();
  clean = undefined;
  document.body.replaceChildren();
});
const pointer = (type: string) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 7,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    clientX: 60,
    clientY: 6,
  });
for (const skin of ['base', 'shadcn'] as const)
  for (const runtime of ['react', 'vue2'] as const)
    for (const acknowledge of [false, true])
      it(`${runtime} ${skin} corner hover then pointer down preserves input, acknowledge=${acknowledge}`, async () => {
        const family = skin === 'base' ? base : shadcn;
        const host = document.createElement('div');
        document.body.append(host);
        if (runtime === 'react') {
          const adapt = createReactAdapter(React);
          const root = createRoot(host);
          const Root = adapt(family.sliderRoot),
            Track = adapt(family.sliderTrack),
            Thumb = adapt(family.sliderThumb);
          await act(async () =>
            root.render(
              React.createElement(
                Root,
                { defaultValue: 25 },
                React.createElement(Track, null, React.createElement(Thumb))
              )
            )
          );
          clean = async () => {
            await act(async () => root.unmount());
          };
        } else {
          const adapt = createVue2Adapter(Vue2RuntimeAny);
          const Root = adapt(family.sliderRoot),
            Track = adapt(family.sliderTrack),
            Thumb = adapt(family.sliderThumb);
          const App = Vue2Any.extend({
            render(h: any) {
              return h(Root, { props: { defaultValue: 25 } }, [h(Track, {}, [h(Thumb)])]);
            },
          });
          const vm = new App().$mount();
          host.append(vm.$el);
          await flushVue2();
          await flushVue2();
          clean = async () => {
            vm.$destroy();
            await flushVue2();
          };
        }
        const thumb = host.querySelector('[role="slider"]') as HTMLElement;
        const track = thumb.parentElement!;
        track.getBoundingClientRect = () => new DOMRect(10, 0, 200, 12);
        thumb.getBoundingClientRect = () => new DOMRect(46, -8, 28, 28);
        if (acknowledge) {
          if (runtime === 'react')
            await act(async () => {
              thumb.dispatchEvent(pointer('pointerenter'));
            });
          else {
            thumb.dispatchEvent(pointer('pointerenter'));
            await flushVue2();
            await flushVue2();
          }
        }
        const sequence = () => {
          if (!acknowledge) thumb.dispatchEvent(pointer('pointerenter'));
          expect(thumb.getAttribute('data-hovered')).not.toBeNull();
          thumb.dispatchEvent(pointer('pointerdown'));
          expect(thumb.getAttribute('data-pressed')).not.toBeNull();
          track.dispatchEvent(pointer('pointerup'));
        };
        if (runtime === 'react') await act(async () => sequence());
        else sequence();
      });
```
